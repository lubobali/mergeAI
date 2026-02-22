import { callSqlAgent } from "@/lib/nvidia";
import type { FileSchema, SchemaAnalysis } from "@/lib/types";

export async function runSqlAgent(
  question: string,
  schemas: FileSchema[],
  analysis: SchemaAnalysis
): Promise<string> {
  const fileContext = schemas
    .map(
      (s) =>
        `FILE: ${s.fileName} (file_id = '${s.fileId}')\nCOLUMNS: ${s.columns.join(", ")}\nSAMPLE VALUES: ${JSON.stringify(s.sampleValues)}`
    )
    .join("\n\n");

  const prompt = `You are an expert PostgreSQL query builder. All CSV data is stored in one table: uploaded_rows
- file_id: UUID (identifies which file)
- row_data: JSONB (each row as key-value pairs)

Access values: row_data->>'Column_Name' (text)
Cast numbers: (row_data->>'Column_Name')::NUMERIC
Use LOWER() for text JOINs. Use CTE for cross-file queries. GROUP BY dimensions. ORDER BY metric DESC. LIMIT 50.

IMPORTANT: Determine the correct JOIN key yourself by looking at column names and sample values.
Look for ID columns (EmpID, Employee ID, Product_ID, etc.) as the primary join key.
Do NOT join on descriptive columns like Location or Department unless the question specifically asks for it.

${fileContext}

QUESTION: "${question}"

Return ONLY the raw SQL. No markdown, no backticks, no explanation.`;

  const response = await callSqlAgent(prompt);

  let sql = response.trim();

  // Safety: strip <think>...</think> tags if model still includes them
  sql = sql.replace(/<think>[\s\S]*?<\/think>/g, "").trim();

  // Strip markdown code blocks
  if (sql.includes("```")) {
    sql = sql.replace(/```sql?\n?/gi, "").replace(/```\s*/g, "").trim();
  }

  console.log("🔨 SQL Agent generated:\n", sql);
  return sql;
}
