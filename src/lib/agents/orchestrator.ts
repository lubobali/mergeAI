import { runSchemaAgent } from "./schema-agent";
import { runSqlAgent } from "./sql-agent";
import { runValidator } from "./validator-agent";
import { runSummaryAgent } from "./summary-agent";
import { executeRawSql } from "@/lib/db";
import type { FileSchema, AgentEvent, QueryResult } from "@/lib/types";

const MAX_ROUNDS = 3;

export async function runAgentPipeline(
  question: string,
  schemas: FileSchema[],
  onEvent: (event: AgentEvent) => void
): Promise<QueryResult> {
  const startTime = Date.now();
  let feedback: string | undefined;

  for (let round = 1; round <= MAX_ROUNDS; round++) {
    // --- Schema Agent ---
    onEvent({
      type: "agent_start",
      agent: "schema",
      status: "active",
      message: round === 1 ? "Analyzing file schemas..." : `Re-analyzing with feedback (round ${round})...`,
    });

    const analysis = await runSchemaAgent(question, schemas, feedback);
    console.log("🔍 Schema Agent analysis:", JSON.stringify(analysis, null, 2));

    const jk = analysis.joinKey;
    const schemaMsg = jk?.fileA?.column && jk?.fileB?.column
      ? `Found join: ${jk.fileA.column} ↔ ${jk.fileB.column} (${Math.round((jk.confidence || 0) * 100)}% confidence)`
      : `Analyzing ${schemas.length} files — ${schemas.map(s => s.fileName).join(", ")}`;

    onEvent({
      type: "agent_complete",
      agent: "schema",
      status: "done",
      message: schemaMsg,
      data: { analysis },
    });

    // --- SQL Agent ---
    onEvent({
      type: "agent_start",
      agent: "sql",
      status: "active",
      message: "Generating PostgreSQL query...",
    });

    const sql = await runSqlAgent(question, schemas, analysis);
    console.log("🔨 SQL Agent generated:\n", sql);

    onEvent({
      type: "agent_complete",
      agent: "sql",
      status: "done",
      message: `Query generated (${sql.split("\n").length} lines)`,
      data: { sql },
    });

    // --- Execute SQL ---
    onEvent({
      type: "agent_start",
      agent: "validator",
      status: "active",
      message: "Executing query...",
    });

    let rows: Record<string, unknown>[] = [];
    let columns: string[] = [];

    try {
      const result = await executeRawSql(sql);
      rows = result.rows;
      columns = result.columns;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);

      if (round < MAX_ROUNDS) {
        feedback = `SQL ERROR: ${errMsg}. Fix the query.`;
        onEvent({
          type: "round_retry",
          agent: "validator",
          status: "retry",
          message: `SQL error — retrying (round ${round + 1})`,
          data: { error: errMsg },
        });
        continue;
      }

      onEvent({
        type: "query_error",
        agent: "validator",
        status: "error",
        message: `Query failed after ${MAX_ROUNDS} attempts: ${errMsg}`,
      });

      return {
        columns: [],
        rows: [],
        rowCount: 0,
        sql,
        rounds: round,
        timing: Date.now() - startTime,
      };
    }

    // --- Validator ---
    const validation = runValidator(rows, columns);

    if (validation.status === "pass") {
      onEvent({
        type: "agent_complete",
        agent: "validator",
        status: "done",
        message: `${validation.rowCount} rows, ${validation.nullPercentage.toFixed(0)}% nulls — PASS`,
      });

      // Generate NL summary (non-blocking — don't fail the pipeline)
      let summary: string | undefined;
      try {
        summary = await runSummaryAgent(question, columns, rows);
      } catch {
        console.log("⚠️ Summary agent failed — skipping");
      }

      onEvent({
        type: "query_complete",
        message: "Done",
        data: { rowCount: rows.length, rounds: round },
      });

      return {
        columns,
        rows,
        rowCount: rows.length,
        sql,
        summary,
        rounds: round,
        timing: Date.now() - startTime,
      };
    }

    // Retry
    if (round < MAX_ROUNDS) {
      feedback = validation.diagnosis;
      onEvent({
        type: "round_retry",
        agent: "validator",
        status: "retry",
        message: `${validation.diagnosis} — retrying (round ${round + 1})`,
      });
    } else {
      // Return whatever we got on final round
      onEvent({
        type: "agent_complete",
        agent: "validator",
        status: "done",
        message: `${validation.rowCount} rows returned (best effort after ${MAX_ROUNDS} rounds)`,
      });

      onEvent({
        type: "query_complete",
        message: "Done",
        data: { rowCount: rows.length, rounds: round },
      });

      return {
        columns,
        rows,
        rowCount: rows.length,
        sql,
        rounds: round,
        timing: Date.now() - startTime,
      };
    }
  }

  // Should never reach here
  return {
    columns: [],
    rows: [],
    rowCount: 0,
    sql: "",
    rounds: MAX_ROUNDS,
    timing: Date.now() - startTime,
  };
}
