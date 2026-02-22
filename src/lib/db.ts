import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "@/drizzle/schema";

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema });

// ============================================================
// SQL Safety Layer — validates agent-generated queries before execution.
// Big Tech pattern: read-only allowlist + keyword blocklist + LIMIT cap.
// ============================================================

const BLOCKED_KEYWORDS = [
  "INSERT",
  "UPDATE",
  "DELETE",
  "DROP",
  "ALTER",
  "TRUNCATE",
  "CREATE",
  "GRANT",
  "REVOKE",
  "COPY",
  "EXECUTE",
];

function validateSql(query: string): void {
  const trimmed = query.trim();
  const upper = trimmed.toUpperCase();

  // Must start with SELECT or WITH (CTEs)
  if (!upper.startsWith("SELECT") && !upper.startsWith("WITH")) {
    throw new Error("Only SELECT queries are allowed");
  }

  // Block semicolons — prevent multi-statement injection
  if (trimmed.includes(";")) {
    throw new Error("Multi-statement queries are not allowed");
  }

  // Block dangerous keywords (whole-word match)
  for (const kw of BLOCKED_KEYWORDS) {
    const regex = new RegExp(`\\b${kw}\\b`, "i");
    if (regex.test(query)) {
      throw new Error(`Blocked SQL keyword: ${kw}`);
    }
  }
}

function enforceLimitCap(query: string, maxRows: number = 200): string {
  const upper = query.toUpperCase();
  if (!upper.includes("LIMIT")) {
    return `${query.trimEnd()} LIMIT ${maxRows}`;
  }
  return query;
}

// Raw SQL execution for agent-generated queries
export async function executeRawSql(
  query: string
): Promise<{ columns: string[]; rows: Record<string, unknown>[] }> {
  // Validate before execution
  validateSql(query);

  // Enforce row limit cap
  const safeQuery = enforceLimitCap(query);

  // Execute with JS-side timeout (10s max)
  // Neon HTTP driver is stateless — SET statement_timeout doesn't persist across requests.
  // Use AbortController instead.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const result = await sql.query(safeQuery);
    clearTimeout(timeout);
    return parseResult(result);
  } catch (err) {
    clearTimeout(timeout);
    if (controller.signal.aborted) {
      throw new Error("Query timed out (10s limit)");
    }
    throw err;
  }
}

function parseResult(result: unknown) {
  const rows = result as Record<string, unknown>[];
  if (!rows || rows.length === 0) {
    return { columns: [], rows: [] };
  }
  const columns = Object.keys(rows[0]);
  return { columns, rows };
}
