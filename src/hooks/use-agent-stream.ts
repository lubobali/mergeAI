import { useState, useCallback } from "react";
import type { AgentEvent, QueryResult } from "@/lib/types";

export type AgentStatus = "idle" | "active" | "done" | "retry" | "error";

export interface AgentState {
  schema: { status: AgentStatus; message: string };
  sql: { status: AgentStatus; message: string };
  validator: { status: AgentStatus; message: string };
}

const INITIAL_STATE: AgentState = {
  schema: { status: "idle", message: "" },
  sql: { status: "idle", message: "" },
  validator: { status: "idle", message: "" },
};

export function useAgentStream() {
  const [agents, setAgents] = useState<AgentState>(INITIAL_STATE);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runQuery = useCallback(async (question: string) => {
    setAgents(INITIAL_STATE);
    setResult(null);
    setError(null);
    setIsStreaming(true);

    try {
      const response = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Query failed");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events from buffer
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;

          try {
            const event = JSON.parse(jsonStr);

            if (event.type === "result") {
              setResult(event.data as QueryResult);
            } else if (event.type === "query_error") {
              setError(event.message);
            } else {
              // Agent event — update agent state
              const agentEvent = event as AgentEvent;
              if (agentEvent.agent) {
                setAgents((prev) => ({
                  ...prev,
                  [agentEvent.agent!]: {
                    status: agentEvent.status || "active",
                    message: agentEvent.message || "",
                  },
                }));
              }
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      setError(errMsg);
    } finally {
      setIsStreaming(false);
    }
  }, []);

  const reset = useCallback(() => {
    setAgents(INITIAL_STATE);
    setResult(null);
    setError(null);
  }, []);

  return { agents, result, isStreaming, error, runQuery, reset };
}
