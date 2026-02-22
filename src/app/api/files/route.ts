import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { uploadedFiles } from "@/drizzle/schema";
import { eq, or } from "drizzle-orm";

export async function GET() {
  try {
    // Server-side auth — never trust client-provided userId
    const { userId: clerkUserId } = await auth();
    const userId = clerkUserId || "demo_user";

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
