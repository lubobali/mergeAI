import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { parse } from "csv-parse/sync";
import { readFileSync } from "fs";
import { uploadedFiles, uploadedRows } from "../src/drizzle/schema";
import { eq } from "drizzle-orm";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

const DEMO_FILES = [
  {
    path: "/Users/lu/LuBot_hybrid/Test_files/Joins test/employee_data.csv",
    name: "employee_data.csv",
  },
  {
    path: "/Users/lu/LuBot_hybrid/Test_files/Joins test/training_and_development_data.csv",
    name: "training_and_development_data.csv",
  },
  {
    path: "/Users/lu/LuBot_hybrid/Test_files/Joins test/employee_engagement_survey_data.csv",
    name: "employee_engagement_survey_data.csv",
  },
  {
    path: "/Users/lu/LuBot_hybrid/Test_files/Joins test/recruitment_data.csv",
    name: "recruitment_data.csv",
  },
];

async function seed() {
  console.log("🌱 Seeding demo data...\n");

  // Clear existing demo data
  const existing = await db
    .select()
    .from(uploadedFiles)
    .where(eq(uploadedFiles.isDemo, true));

  for (const file of existing) {
    await db.delete(uploadedRows).where(eq(uploadedRows.fileId, file.id));
    await db.delete(uploadedFiles).where(eq(uploadedFiles.id, file.id));
  }
  console.log(`🗑️  Cleared ${existing.length} old demo files\n`);

  for (const demo of DEMO_FILES) {
    console.log(`📁 Processing ${demo.name}...`);

    // Read and parse CSV (strip BOM)
    const raw = readFileSync(demo.path, "utf-8").replace(/^\uFEFF/, "");
    const rows = parse(raw, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as Record<string, string>[];

    const columns = Object.keys(rows[0]);
    const columnTypes: Record<string, string> = {};
    const sampleValues: Record<string, string[]> = {};

    // Detect types and collect samples
    for (const col of columns) {
      sampleValues[col] = rows
        .slice(0, 5)
        .map((r) => r[col])
        .filter(Boolean);

      // Simple type detection
      const testValues = rows.slice(0, 20).map((r) => r[col]);
      const allNumeric = testValues.every(
        (v) => !v || !isNaN(Number(v.replace(/[,$]/g, "")))
      );
      const allDates = testValues.every(
        (v) => !v || /^\d{1,4}[-/]\d{1,2}[-/]\d{1,4}$/.test(v)
      );

      columnTypes[col] = allDates ? "date" : allNumeric ? "number" : "text";
    }

    // Insert file record
    const [fileRecord] = await db
      .insert(uploadedFiles)
      .values({
        userId: "demo",
        fileName: demo.name,
        columns,
        columnTypes,
        sampleValues,
        rowCount: rows.length,
        isDemo: true,
      })
      .returning();

    console.log(
      `   ✅ File record: ${fileRecord.id} (${columns.length} cols, ${rows.length} rows)`
    );

    // Batch insert rows (chunks of 500)
    const BATCH = 500;
    let inserted = 0;
    for (let i = 0; i < rows.length; i += BATCH) {
      const chunk = rows.slice(i, i + BATCH);
      await db.insert(uploadedRows).values(
        chunk.map((row) => ({
          fileId: fileRecord.id,
          userId: "demo",
          rowData: row,
        }))
      );
      inserted += chunk.length;
      process.stdout.write(
        `   📊 Inserted ${inserted}/${rows.length} rows\r`
      );
    }
    console.log(`   📊 Inserted ${inserted}/${rows.length} rows ✅\n`);
  }

  console.log("🎉 Seed complete!");
}

seed().catch(console.error);
