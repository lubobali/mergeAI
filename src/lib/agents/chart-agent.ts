import { callChartAgent } from "@/lib/nvidia";
import type { ChartConfig } from "@/lib/types";

// Deterministic chart type detection (LuBot pattern: keywords first, LLM fallback)
function detectChartType(question: string, columns: string[], rowCount: number): string | null {
  const q = question.toLowerCase();
  const colsLower = columns.map((c) => c.toLowerCase());

  // Pie: percentage, breakdown, distribution, proportion, share (≤10 categories)
  if (rowCount <= 10 && /\b(percentage|percent|breakdown|distribution|proportion|share|pie)\b/.test(q)) {
    return "pie";
  }

  // Line: trend, over time, timeline, by date/month/year/week
  if (/\b(trend|over time|timeline|by (date|month|year|week|day)|monthly|yearly|daily|by month)\b/.test(q)) {
    return "line";
  }

  // Heatmap: explicit request
  if (/\b(heatmap|heat map)\b/.test(q)) {
    return "heatmap";
  }

  // Scatter: correlation, scatter, relationship, vs
  if (/\b(scatter|correlation|relationship)\b/.test(q) || /\bvs\.?\b/.test(q)) {
    return "scatter";
  }

  // Pie: column named "percentage" or "percent" or "count" with few rows
  if (rowCount <= 10 && colsLower.some((c) => /percent|share|proportion/.test(c))) {
    return "pie";
  }

  // Line: if a column looks like a date/month and there are many rows
  if (rowCount > 5 && colsLower.some((c) => /date|month|year|period|time/.test(c))) {
    return "line";
  }

  return null; // Let LLM decide
}

// Find the best numeric column(s) from results
function findNumericColumns(columns: string[], rows: Record<string, unknown>[]): string[] {
  return columns.filter((c) => {
    // Check first 5 non-null values
    let numCount = 0;
    let checked = 0;
    for (const row of rows) {
      const v = row[c];
      if (v == null || v === "" || v === "—") continue;
      checked++;
      if (!isNaN(Number(v))) numCount++;
      if (checked >= 5) break;
    }
    return checked > 0 && numCount / checked >= 0.8;
  });
}

// Find the best categorical column (non-numeric, non-null)
function findCategoricalColumn(columns: string[], rows: Record<string, unknown>[], numericCols: string[]): string | null {
  for (const c of columns) {
    if (numericCols.includes(c)) continue;
    const hasValues = rows.some((r) => r[c] != null && r[c] !== "" && r[c] !== "—");
    if (hasValues) return c;
  }
  return null;
}

// Check if all y-values are null/zero (skip chart in this case)
function hasValidData(rows: Record<string, unknown>[], yColumns: string[]): boolean {
  for (const yCol of yColumns) {
    for (const row of rows) {
      const v = row[yCol];
      if (v != null && v !== "" && v !== "—" && Number(v) !== 0) return true;
    }
  }
  return false;
}

export async function runChartAgent(
  question: string,
  columns: string[],
  rows: Record<string, unknown>[]
): Promise<ChartConfig | undefined> {
  if (rows.length === 0 || columns.length < 2) return undefined;

  // Tier 1: Deterministic detection (fast, reliable)
  const detectedType = detectChartType(question, columns, rows.length);
  const numericCols = findNumericColumns(columns, rows);
  const categoricalCol = findCategoricalColumn(columns, rows, numericCols);

  const preview = rows.slice(0, 15);

  const chartTypeHint = detectedType
    ? `\n\nIMPORTANT: Based on the question, use chartType "${detectedType}". Do NOT override this.`
    : "";

  const prompt = `You are a data visualization expert. Given query results, pick the best chart type and axis mapping.

RULES:
- Categorical + numeric → "bar"
- Time/date column + numeric → "line"
- Parts of a whole, percentages, breakdown (≤10 categories) → "pie"
- Two numeric columns → "scatter"
- Two categoricals + one numeric → "heatmap"
- If question asks about percentage/breakdown/distribution → ALWAYS use "pie"
- For xColumn: pick the categorical/label column (NOT the numeric value column)
- For yColumns: pick the numeric/value column(s)
- Default to "bar" if unsure${chartTypeHint}

NUMERIC COLUMNS: ${numericCols.join(", ") || "none detected"}
CATEGORICAL COLUMNS: ${columns.filter((c) => !numericCols.includes(c)).join(", ") || "none"}

ALL COLUMNS: ${columns.join(", ")}

DATA (first ${preview.length} rows):
${JSON.stringify(preview, null, 2)}

USER QUESTION: "${question}"

Return ONLY valid JSON (no markdown, no backticks, no explanation):
{"chartType": "${detectedType || "bar"}", "xColumn": "column_name", "yColumns": ["column_name"], "title": "Short Chart Title"}`;

  const response = await callChartAgent(prompt);

  // Strip any markdown/think tags
  let cleaned = response.trim();
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  if (cleaned.includes("```")) {
    cleaned = cleaned.replace(/```json?\n?/gi, "").replace(/```\s*/g, "").trim();
  }

  // Parse JSON
  let parsed: { chartType: string; xColumn: string; yColumns: string[]; title: string };
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    // Try to extract JSON from response
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      // Total fallback: use deterministic detection
      return buildFallbackChart(detectedType || "bar", columns, rows, numericCols, categoricalCol, question);
    }
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      return buildFallbackChart(detectedType || "bar", columns, rows, numericCols, categoricalCol, question);
    }
  }

  // Validate chart type — deterministic detection overrides LLM
  const validTypes = ["bar", "line", "pie", "scatter", "heatmap"];
  const llmType = validTypes.includes(parsed.chartType) ? parsed.chartType : "bar";
  const chartType = detectedType || llmType;

  // Validate columns exist
  const xCol = columns.includes(parsed.xColumn) ? parsed.xColumn : (categoricalCol || columns[0]);
  const yCols = (parsed.yColumns || []).filter((c: string) => columns.includes(c));
  if (yCols.length === 0) {
    // Pick first numeric column that isn't the x column
    const fallbackY = numericCols.find((c) => c !== xCol);
    if (fallbackY) yCols.push(fallbackY);
    else return undefined;
  }

  // Skip chart if all y-values are null/zero
  if (!hasValidData(rows, yCols)) return undefined;

  // Build chart data from rows
  const xValues = rows.map((r) => {
    const v = r[xCol];
    return v != null ? String(v) : "";
  });

  const series = yCols.map((yCol: string) => ({
    name: yCol,
    values: rows.map((r) => {
      const v = r[yCol];
      return v != null ? Number(v) || 0 : 0;
    }),
  }));

  return {
    type: chartType as ChartConfig["type"],
    title: parsed.title || "Query Results",
    xColumn: xCol,
    yColumns: yCols,
    xValues,
    series,
  };
}

// Fallback chart builder when LLM fails to return valid JSON
function buildFallbackChart(
  chartType: string,
  columns: string[],
  rows: Record<string, unknown>[],
  numericCols: string[],
  categoricalCol: string | null,
  question: string
): ChartConfig | undefined {
  const xCol = categoricalCol || columns[0];
  const yCol = numericCols.find((c) => c !== xCol);
  if (!yCol) return undefined;

  if (!hasValidData(rows, [yCol])) return undefined;

  const xValues = rows.map((r) => (r[xCol] != null ? String(r[xCol]) : ""));
  const series = [{
    name: yCol,
    values: rows.map((r) => (r[yCol] != null ? Number(r[yCol]) || 0 : 0)),
  }];

  // Generate a title from the question
  const title = question.length > 50 ? question.slice(0, 47) + "..." : question;

  return {
    type: chartType as ChartConfig["type"],
    title,
    xColumn: xCol,
    yColumns: [yCol],
    xValues,
    series,
  };
}
