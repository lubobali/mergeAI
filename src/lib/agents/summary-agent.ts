import { callSummaryAgent } from "@/lib/nvidia";

export async function runSummaryAgent(
  question: string,
  columns: string[],
  rows: Record<string, unknown>[]
): Promise<string> {
  // Send only first 10 rows to keep prompt small
  const preview = rows.slice(0, 10);

  const prompt = `You are a data analyst. The user asked: "${question}"

The query returned ${rows.length} rows with columns: ${columns.join(", ")}

Data (first ${preview.length} rows):
${JSON.stringify(preview, null, 2)}

Write a 2-3 sentence plain English summary of the results. Highlight the key insight (highest/lowest value, trend, comparison). Be specific with numbers. Do NOT use markdown or bullet points.`;

  const response = await callSummaryAgent(prompt);
  return response.trim();
}
