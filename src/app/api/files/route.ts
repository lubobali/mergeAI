import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { uploadedFiles } from "@/drizzle/schema";
import { eq, or } from "drizzle-orm";

async function getAuthUserId(): Promise<string> {
  try {
    const { userId } = await auth();
    return userId || "demo_user";
  } catch {
    return "demo_user";
  }
}

export async function GET() {
  try {
    const userId = await getAuthUserId();

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
