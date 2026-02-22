import { callSchemaAgent } from "@/lib/nvidia";
import type { FileSchema, SchemaAnalysis } from "@/lib/types";

const SCHEMA_PROMPT = `You are a data schema analyst. Given file schemas, analyze the user's question and find how to answer it.

RULES:
1. If the question only needs ONE file, set singleFileQuery=true and joinKey=null
2. If the question needs TWO files, find the best JOIN key between them
3. Identify which columns contain the metrics the user is asking about
4. Note any data quality issues (case differences, abbreviations, NULLs)

IMPORTANT for join keys:
- Look for columns that represent the SAME entity (Department↔Dept, Product_ID↔Product_ID)
- If column names differ but mean the same thing, that's a "fuzzy" match
- If exact same name, that's "exact" match
- Check sample values to verify the match makes sense

Return ONLY valid JSON, no markdown, no explanation:
{
  "joinKey": {
    "fileA": { "column": "col_name", "file": "filename.csv" },
    "fileB": { "column": "col_name", "file": "filename.csv" },
    "confidence": 0.95,
    "matchType": "fuzzy"
  },
  "metrics": [
    { "column": "Salary", "file": "employees.csv", "aggregation": "AVG" }
  ],
  "warnings": ["Department vs Dept — abbreviation detected"],
  "singleFileQuery": false
}`;

export async function runSchemaAgent(
  question: string,
  schemas: FileSchema[],
  feedback?: string
): Promise<SchemaAnalysis> {
  const schemaDescriptions = schemas
    .map(
      (s) =>
        `FILE: ${s.fileName}\nCOLUMNS: ${s.columns.join(", ")}\nTYPES: ${JSON.stringify(s.columnTypes)}\nSAMPLE VALUES: ${JSON.stringify(s.sampleValues)}\nROWS: ${s.rowCount}`
    )
    .join("\n\n");

  const prompt = `${SCHEMA_PROMPT}

FILES:
${schemaDescriptions}

USER QUESTION: "${question}"
${feedback ? `\nPREVIOUS ATTEMPT FEEDBACK: ${feedback}` : ""}

Return JSON only:`;

  const response = await callSchemaAgent(prompt);

  // Parse JSON from response (handle markdown code blocks)
  let jsonStr = response.trim();
  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/```json?\n?/g, "").replace(/```$/g, "").trim();
  }

  try {
    return JSON.parse(jsonStr) as SchemaAnalysis;
  } catch {
    // Fallback: single file query with first metric column
    console.error("Schema Agent JSON parse failed:", jsonStr);
    return {
      joinKey: null,
      metrics: [],
      warnings: ["Schema Agent returned invalid JSON — using fallback"],
      singleFileQuery: true,
    };
  }
}
