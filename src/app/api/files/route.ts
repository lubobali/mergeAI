import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { uploadedFiles } from "@/drizzle/schema";
import { eq, or } from "drizzle-orm";

async function resolveUserId(req: Request): Promise<string> {
  // Priority: Clerk auth > x-session-id header > fallback
  try {
    const { userId } = await auth();
    if (userId) return userId;
  } catch {
    // Clerk not available
  }
  const sessionId = req.headers.get("x-session-id");
  if (sessionId) return sessionId;
  return `anon_${Date.now()}`;
}

export async function GET(req: Request) {
  try {
    const userId = await resolveUserId(req);

    const files = await db
      .select()
      .from(uploadedFiles)
      .where(or(eq(uploadedFiles.userId, userId), eq(uploadedFiles.isDemo, true)));

    return Response.json(
      files.map((f) => ({
        id: f.id,
        fileName: f.fileName,
        columns: f.columns,
        columnTypes: f.columnTypes,
        rowCount: f.rowCount,
        isDemo: f.isDemo,
      }))
    );
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("❌ Files API error:", errMsg);
    return Response.json({ error: errMsg }, { status: 500 });
  }
}
