import type { ValidationResult } from "@/lib/types";

// Deterministic checks — no AI needed for validation
export function runValidator(
  rows: Record<string, unknown>[],
  columns: string[]
): ValidationResult {
  const rowCount = rows.length;

  // Check 1: Zero rows = likely bad join or wrong column
  if (rowCount === 0) {
    return {
      status: "retry",
      diagnosis:
        "Query returned 0 rows. Likely cause: case mismatch in JOIN key or wrong column name. Try LOWER() on join columns.",
      rowCount: 0,
      nullPercentage: 100,
    };
  }

  // Check 2: High NULL percentage = join key not matching
  let totalCells = 0;
  let nullCells = 0;
  for (const row of rows) {
    for (const col of columns) {
      totalCells++;
      const val = row[col];
      if (val === null || val === undefined || val === "") {
        nullCells++;
      }
    }
  }
  const nullPercentage = totalCells > 0 ? (nullCells / totalCells) * 100 : 0;

  if (nullPercentage > 50) {
    return {
      status: "retry",
      diagnosis: `${nullPercentage.toFixed(0)}% NULL values detected. JOIN key is likely not matching correctly. Check column name spelling and case sensitivity.`,
      rowCount,
      nullPercentage,
    };
  }

  // Check 3: Only 1 column returned = probably missing the metric
  if (columns.length < 2 && rowCount > 1) {
    return {
      status: "retry",
      diagnosis:
        "Only 1 column returned. The query is missing the metric column. Add the aggregation (AVG, SUM, COUNT) for the requested metric.",
      rowCount,
      nullPercentage,
    };
  }

  // All checks passed
  return {
    status: "pass",
    diagnosis: `${rowCount} rows, ${nullPercentage.toFixed(0)}% nulls — looks good`,
    rowCount,
    nullPercentage,
  };
}
