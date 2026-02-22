import { db } from "@/lib/db";
import { uploadedFiles } from "@/drizzle/schema";
import { eq, or } from "drizzle-orm";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return Response.json({ error: "Missing userId" }, { status: 400 });
    }

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
