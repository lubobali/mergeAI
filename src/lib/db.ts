import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "@/drizzle/schema";

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema });

// Raw SQL execution for agent-generated queries
export async function executeRawSql(
  query: string
): Promise<{ columns: string[]; rows: Record<string, unknown>[] }> {
  // Use sql.query() for dynamic SQL strings (not tagged template)
  const result = await sql.query(query);

  if (!result || result.length === 0) {
    return { columns: [], rows: [] };
  }

  const columns = Object.keys(result[0]);
  return { columns, rows: result as Record<string, unknown>[] };
}
