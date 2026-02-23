import { db } from "@/lib/db";
import { uploadedFiles } from "@/drizzle/schema";
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

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: fileId } = await params;
    const userId = await resolveUserId(req);

    // Verify file belongs to this user and is NOT a demo file
    const [file] = await db
      .select()
      .from(uploadedFiles)
      .where(and(eq(uploadedFiles.id, fileId), eq(uploadedFiles.userId, userId)))
      .limit(1);

    if (!file) {
      return Response.json({ error: "File not found" }, { status: 404 });
    }

    if (file.isDemo) {
      return Response.json({ error: "Cannot delete demo files" }, { status: 403 });
    }

    // Delete file — uploaded_rows cascade-deletes automatically (FK constraint)
    await db.delete(uploadedFiles).where(eq(uploadedFiles.id, fileId));

    return Response.json({ success: true });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("❌ Delete file error:", errMsg);
    return Response.json({ error: errMsg }, { status: 500 });
  }
}
