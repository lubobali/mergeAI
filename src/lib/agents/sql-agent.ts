import { callSqlAgent } from "@/lib/nvidia";
import type { FileSchema, SchemaAnalysis, ConversationContext } from "@/lib/types";

export async function runSqlAgent(
  question: string,
  schemas: FileSchema[],
  analysis: SchemaAnalysis,
  context?: ConversationContext
): Promise<string> {
  const fileContext = schemas
    .map(
      (s) =>
        `FILE: ${s.fileName} (file_id = '${s.fileId}')\nCOLUMNS: ${s.columns.join(", ")}\nSAMPLE VALUES: ${JSON.stringify(s.sampleValues)}`
    )
    .join("\n\n");

  // Build follow-up context block (empty if first query in thread)
  const contextBlock = context
    ? `
PREVIOUS CONVERSATION:
- User asked: "${context.previousQuestion}"
- SQL that answered it:
${context.previousSql}
${context.previousSummary ? `- Result summary: "${context.previousSummary}"` : ""}

If the current question refers to "that", "those", "it", "the same", or asks to filter, modify, drill down, or break down the previous result, build upon the previous SQL by adding/changing WHERE, GROUP BY, or SELECT clauses. Otherwise treat it as a completely new independent query.
`
    : "";

  const prompt = `You are an expert PostgreSQL query builder. All CSV data is stored in one table: uploaded_rows
- file_id: UUID (identifies which file)
- row_data: JSONB (each row as key-value pairs)

CRITICAL: There are NO regular columns except file_id, user_id, and row_data. ALL data is inside row_data JSONB.
You MUST use row_data->>'Column Name' for EVERY column. NEVER use bare column names.

Examples:
  row_data->>'Training Program Name'     (text)
  (row_data->>'Training Cost')::NUMERIC  (number)
  (row_data->>'Salary')::NUMERIC         (number)

CRITICAL: ALL JSONB values are TEXT. You MUST cast to ::NUMERIC before ANY math operation (AVG, SUM, MIN, MAX, COUNT, comparisons like > < =).
  WRONG: AVG(row_data->>'Salary')           — ERROR: function avg(text) does not exist
  RIGHT: AVG((row_data->>'Salary')::NUMERIC) — correct
  WRONG: row_data->>'Score' > 80             — ERROR: text vs integer comparison
  RIGHT: (row_data->>'Score')::NUMERIC > 80  — correct

Use LOWER() for text JOINs. Use CTE for cross-file queries. GROUP BY dimensions. ORDER BY metric DESC. LIMIT 50.

IMPORTANT: Determine the correct JOIN key yourself by looking at column names and sample values.
Look for ID columns (EmpID, Employee ID, Product_ID, etc.) as the primary join key.
Do NOT join on descriptive columns like Location or Department unless the question specifically asks for it.

${fileContext}
${contextBlock}
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
