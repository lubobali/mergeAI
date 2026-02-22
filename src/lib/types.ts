// File schema as stored in DB and passed to agents
export interface FileSchema {
  fileId: string;
  fileName: string;
  columns: string[];
  columnTypes: Record<string, string>;
  sampleValues: Record<string, string[]>;
  rowCount: number;
}

// Schema Agent output — discovered relationships
export interface SchemaAnalysis {
  joinKey: {
    fileA: { column: string; file: string };
    fileB: { column: string; file: string };
    confidence: number;
    matchType: "exact" | "fuzzy" | "case_insensitive";
  } | null;
  metrics: {
    column: string;
    file: string;
    aggregation: "AVG" | "SUM" | "COUNT" | "MAX" | "MIN";
  }[];
  warnings: string[];
  singleFileQuery: boolean;
}

// Validator result
export interface ValidationResult {
  status: "pass" | "retry" | "fail";
  diagnosis: string;
  rowCount: number;
  nullPercentage: number;
}

// SSE events (AG-UI protocol naming)
export type AgentEventType =
  | "agent_start"
  | "agent_progress"
  | "agent_complete"
  | "round_retry"
  | "query_complete"
  | "query_error";

export interface AgentEvent {
  type: AgentEventType;
  agent?: "schema" | "sql" | "validator";
  status?: "active" | "done" | "retry" | "error";
  message?: string;
  data?: Record<string, unknown>;
}

// Query result
export interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  sql: string;
  rounds: number;
  timing: number;
  summary?: string;
}
