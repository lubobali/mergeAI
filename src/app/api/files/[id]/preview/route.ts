import { db } from "@/lib/db";
import { uploadedRows, uploadedFiles } from "@/drizzle/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";

async function resolveUserId(req: Request): Promise<string> {
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

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: fileId } = await params;
    const userId = await resolveUserId(req);

    // Verify file belongs to this user (or is a demo file)
    const [file] = await db
      .select()
      .from(uploadedFiles)
      .where(eq(uploadedFiles.id, fileId))
      .limit(1);

    if (!file) {
      return Response.json({ error: "File not found" }, { status: 404 });
    }

    // Security: only allow owner or demo files
    if (file.userId !== userId && !file.isDemo) {
      return Response.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Fetch first 20 rows
    const rows = await db
      .select({ rowData: uploadedRows.rowData })
      .from(uploadedRows)
      .where(eq(uploadedRows.fileId, fileId))
      .limit(20);

    return Response.json({
      id: file.id,
      fileName: file.fileName,
      columns: file.columns,
      columnTypes: file.columnTypes,
      rowCount: file.rowCount,
      rows: rows.map((r) => r.rowData),
    });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("❌ Preview API error:", errMsg);
    return Response.json({ error: errMsg }, { status: 500 });
  }
}
