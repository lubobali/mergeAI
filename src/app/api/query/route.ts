import { auth } from "@clerk/nextjs/server";
import { runAgentPipeline } from "@/lib/agents/orchestrator";
import { db } from "@/lib/db";
import { uploadedFiles } from "@/drizzle/schema";
import { eq, or } from "drizzle-orm";
import type { FileSchema, AgentEvent } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // Server-side auth — never trust client-provided userId
  const { userId: clerkUserId } = await auth();
  const userId = clerkUserId || "demo_user";

  const { question } = await req.json();

  if (!question) {
    return Response.json({ error: "Missing question" }, { status: 400 });
  }

  // Get all files for this user (their uploads + demo files)
  const files = await db
    .select()
    .from(uploadedFiles)
    .where(or(eq(uploadedFiles.userId, userId), eq(uploadedFiles.isDemo, true)));

  if (files.length === 0) {
    return Response.json({ error: "No data files available" }, { status: 400 });
  }

  // Build schemas for agents
  const schemas: FileSchema[] = files.map((f) => ({
    fileId: f.id,
    fileName: f.fileName,
    columns: f.columns as string[],
    columnTypes: f.columnTypes as Record<string, string>,
    sampleValues: (f.sampleValues as Record<string, string[]>) || {},
    rowCount: f.rowCount || 0,
  }));

  // SSE stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: AgentEvent) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
        );
      };

      try {
        const result = await runAgentPipeline(question, schemas, sendEvent);

        // Send final result
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "result", data: result })}\n\n`
          )
        );
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "query_error", message: errMsg })}\n\n`
          )
        );
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
