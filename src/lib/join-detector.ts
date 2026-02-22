/**
 * Client-side join detection + column categorization.
 *
 * Compares columns across files to find join relationships and
 * categorizes columns for smart query suggestions.
 *
 * Column categories:
 *   id         — primary/foreign keys (EmpID, Employee ID, Applicant ID)
 *   metric     — numeric values you aggregate (Salary, Cost, Score, Duration)
 *   dimension  — categories you group by (Department, Type, Gender, Status)
 *   date       — temporal columns (StartDate, Survey Date, Application Date)
 *   identifier — names/contact info, noise for analytics (FirstName, Email, Phone)
 *   other      — anything else
 */

/* ── Types ──────────────────────────────────────────── */

export type ColumnCategory =
  | "id"
  | "metric"
  | "dimension"
  | "date"
  | "identifier"
  | "other";

export interface CategorizedColumn {
  name: string;
  category: ColumnCategory;
}

interface FileInput {
  id: string;
  fileName: string;
  columns: string[];
}

export interface DetectedJoin {
  fileA: { id: string; fileName: string; column: string };
  fileB: { id: string; fileName: string; column: string };
  joinType: "exact_id" | "fuzzy_id" | "possible_id";
  label: string;
}

/* ── Column Categorization ──────────────────────────── */

const METRIC_KEYWORDS = [
  "salary", "cost", "price", "amount", "revenue", "fee",
  "score", "rating", "duration", "budget", "hours",
  "experience", "rate", "income", "profit", "balance",
  "total", "size", "weight", "height", "volume",
  "percentage", "ratio", "wage", "bonus", "commission",
];

const DIMENSION_KEYWORDS = [
  "department", "type", "category", "status", "outcome",
  "level", "group", "class", "tier", "zone", "region",
  "location", "city", "state", "country", "gender",
  "title", "role", "position", "program", "trainer",
  "supervisor", "education", "marital", "mode", "method",
  "source", "channel", "division", "unit", "team",
  "shift", "grade", "race", "ethnicity",
];

const IDENTIFIER_KEYWORDS = [
  "name", "first", "last", "email", "phone", "address",
  "zip", "description", "comment", "note", "url", "link",
  "bio", "image", "photo", "avatar", "password", "token",
  "ssn", "social",
];

/** Categorize a single column by its name. */
export function categorizeColumn(col: string): ColumnCategory {
  const norm = col.toLowerCase().replace(/[\s_\-()]/g, "");

  // 1. ID columns — join keys
  if (norm.endsWith("id") || norm === "id" || /\bid\b/i.test(col)) {
    return "id";
  }

  // 2. Identifier columns — names/contact (check before metric to catch "Phone Number")
  if (IDENTIFIER_KEYWORDS.some((kw) => norm.includes(kw))) {
    return "identifier";
  }

  // 3. Date/time columns
  if (
    norm.includes("date") ||
    norm.includes("timestamp") ||
    /\b(month|year|quarter|week)\b/i.test(col)
  ) {
    return "date";
  }

  // 4. Metric columns — numeric values you aggregate
  if (METRIC_KEYWORDS.some((kw) => norm.includes(kw))) {
    return "metric";
  }

  // 5. Dimension columns — categories you group by
  if (DIMENSION_KEYWORDS.some((kw) => norm.includes(kw))) {
    return "dimension";
  }

  return "other";
}

/** Categorize all columns for a file. */
export function categorizeColumns(columns: string[]): CategorizedColumn[] {
  return columns.map((name) => ({ name, category: categorizeColumn(name) }));
}

/** Sort columns by analytical relevance: id → metric → dimension → date → other → identifier */
export function sortColumnsByRelevance(
  columns: CategorizedColumn[]
): CategorizedColumn[] {
  const order: Record<ColumnCategory, number> = {
    id: 0,
    metric: 1,
    dimension: 2,
    date: 3,
    other: 4,
    identifier: 5,
  };
  return [...columns].sort((a, b) => order[a.category] - order[b.category]);
}

/* ── Normalization ──────────────────────────────────── */

/** Normalize a column name for comparison: lowercase, strip separators. */
function normalize(col: string): string {
  return col.toLowerCase().replace(/[\s_\-]/g, "");
}

/* ── Join Detection ─────────────────────────────────── */

/**
 * Detect joins between all file pairs.
 * Prioritizes ID columns. Returns clean labels (no percentages).
 */
export function detectJoins(files: FileInput[]): DetectedJoin[] {
  const joins: DetectedJoin[] = [];

  for (let i = 0; i < files.length; i++) {
    for (let j = i + 1; j < files.length; j++) {
      const fileA = files[i];
      const fileB = files[j];

      // Collect ID-column matches between this pair
      let exactIdMatch: { colA: string; colB: string } | null = null;
      let fuzzyIdMatch: { colA: string; colB: string } | null = null;

      for (const colA of fileA.columns) {
        if (categorizeColumn(colA) !== "id") continue;
        for (const colB of fileB.columns) {
          if (categorizeColumn(colB) !== "id") continue;

          const normA = normalize(colA);
          const normB = normalize(colB);

          // Exact or case-insensitive ID match
          if (normA === normB) {
            exactIdMatch = { colA, colB };
            break;
          }

          // Fuzzy ID match: roots share a prefix
          // "employeeid" → root "employee", "empid" → root "emp"
          // "employee" contains "emp" → fuzzy match
          if (!fuzzyIdMatch) {
            const rootA = normA.replace(/id$/, "");
            const rootB = normB.replace(/id$/, "");
            if (
              rootA.length > 1 &&
              rootB.length > 1 &&
              (rootA.includes(rootB) || rootB.includes(rootA))
            ) {
              fuzzyIdMatch = { colA, colB };
            }
          }
        }
        if (exactIdMatch) break;
      }

      // Pick the best match
      const bestMatch = exactIdMatch || fuzzyIdMatch;
      if (bestMatch) {
        // Use the longer/cleaner column name as the display label
        const label =
          bestMatch.colA.length >= bestMatch.colB.length
            ? bestMatch.colA
            : bestMatch.colB;
        joins.push({
          fileA: {
            id: fileA.id,
            fileName: fileA.fileName,
            column: bestMatch.colA,
          },
          fileB: {
            id: fileB.id,
            fileName: fileB.fileName,
            column: bestMatch.colB,
          },
          joinType: exactIdMatch ? "exact_id" : "fuzzy_id",
          label: `via ${label}`,
        });
      }
    }
  }

  // For isolated files (no edges), add one "possible" connection
  // if they have an ID column. Prevents orphan nodes.
  const connectedIds = new Set<string>();
  for (const j of joins) {
    connectedIds.add(j.fileA.id);
    connectedIds.add(j.fileB.id);
  }

  for (const file of files) {
    if (connectedIds.has(file.id)) continue;
    const fileIdCols = file.columns.filter(
      (c) => categorizeColumn(c) === "id"
    );
    if (fileIdCols.length === 0) continue;

    // Find the first connected file that also has ID columns
    const target = files.find(
      (f) =>
        f.id !== file.id &&
        connectedIds.has(f.id) &&
        f.columns.some((c) => categorizeColumn(c) === "id")
    );
    // Fallback: any other file with ID columns
    const fallback =
      target ||
      files.find(
        (f) =>
          f.id !== file.id &&
          f.columns.some((c) => categorizeColumn(c) === "id")
      );

    if (fallback) {
      const targetIdCols = fallback.columns.filter(
        (c) => categorizeColumn(c) === "id"
      );
      joins.push({
        fileA: {
          id: file.id,
          fileName: file.fileName,
          column: fileIdCols[0],
        },
        fileB: {
          id: fallback.id,
          fileName: fallback.fileName,
          column: targetIdCols[0],
        },
        joinType: "possible_id",
        label: `${fileIdCols[0]} ↔ ${targetIdCols[0]}`,
      });
      connectedIds.add(file.id);
    }
  }

  return joins;
}
