import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { uploadedFiles, uploadedRows } from "@/drizzle/schema";

const MAX_ROWS = 10_000;
const MAX_COLUMNS = 50;

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

export async function POST(req: Request) {
  try {
    const userId = await resolveUserId(req);

    const { fileName, columns, columnTypes, sampleValues, rows } =
      await req.json();

    if (!fileName || !columns || !rows) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Server-side safety net — enforce limits
    if (rows.length > MAX_ROWS) {
      return Response.json(
        { error: `Too many rows (${rows.length.toLocaleString()}). Maximum is ${MAX_ROWS.toLocaleString()}.` },
        { status: 413 }
      );
    }
    if (columns.length > MAX_COLUMNS) {
      return Response.json(
        { error: `Too many columns (${columns.length}). Maximum is ${MAX_COLUMNS}.` },
        { status: 413 }
      );
    }

    console.log(`📤 Upload: ${fileName} (${rows.length} rows, ${columns.length} cols) for user ${userId}`);

    // Insert file record
    const [fileRecord] = await db
      .insert(uploadedFiles)
      .values({
        userId,
        fileName,
        columns,
        columnTypes: columnTypes || {},
        sampleValues: sampleValues || {},
        rowCount: rows.length,
        isDemo: false,
      })
      .returning();

    console.log(`✅ File record created: ${fileRecord.id}`);

    // Batch insert rows (chunks of 500)
    const BATCH = 500;
    let inserted = 0;
    for (let i = 0; i < rows.length; i += BATCH) {
      const chunk = rows.slice(i, i + BATCH);
      await db.insert(uploadedRows).values(
        chunk.map((row: Record<string, unknown>) => ({
          fileId: fileRecord.id,
          userId,
          rowData: row,
        }))
      );
      inserted += chunk.length;
    }

    console.log(`✅ Inserted ${inserted} rows for ${fileName}`);

    return Response.json({
      id: fileRecord.id,
      fileName,
      columns,
      rowCount: rows.length,
    });
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`❌ Upload error:`, errMsg);
    return Response.json({ error: errMsg }, { status: 500 });
  }
}
