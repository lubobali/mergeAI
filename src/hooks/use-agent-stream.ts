import { useState, useCallback, useRef } from "react";
import type { AgentEvent, QueryResult, ChatMessage, ConversationContext } from "@/lib/types";
import { getSessionId } from "@/lib/session";

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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  // Ref to always read latest messages inside runQuery closure
  const messagesRef = useRef<ChatMessage[]>([]);
  messagesRef.current = messages;

  const runQuery = useCallback(async (question: string) => {
    // Reset agent cards for this new query
    setAgents(INITIAL_STATE);
    setIsStreaming(true);

    // Append user message to thread
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      question,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);

    // Auto-build context from the last assistant message (if any)
    let context: ConversationContext | undefined;
    const lastAssistant = [...messagesRef.current]
      .reverse()
      .find((m) => m.role === "assistant" && m.result);
    if (lastAssistant?.result) {
      context = {
        previousQuestion: lastAssistant.question,
        previousSql: lastAssistant.result.sql,
        previousSummary: lastAssistant.result.summary,
      };
    }

    // Prepare assistant message ID (will be appended when result arrives)
    const assistantId = crypto.randomUUID();

    try {
      const response = await fetch("/api/query", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session-id": getSessionId(),
        },
        body: JSON.stringify({ question, context }),
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
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;

          try {
            const event = JSON.parse(jsonStr);

            if (event.type === "result") {
              // Append assistant message with result to thread
              const assistantMsg: ChatMessage = {
                id: assistantId,
                role: "assistant",
                question,
                result: event.data as QueryResult,
                timestamp: Date.now(),
              };
              setMessages((prev) => [...prev, assistantMsg]);
            } else if (event.type === "query_error") {
              // Append assistant message with error to thread
              const assistantMsg: ChatMessage = {
                id: assistantId,
                role: "assistant",
                question,
                error: event.message,
                timestamp: Date.now(),
              };
              setMessages((prev) => [...prev, assistantMsg]);
            } else {
              // Agent event — update agent cards
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
      const assistantMsg: ChatMessage = {
        id: assistantId,
        role: "assistant",
        question,
        error: errMsg,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } finally {
      setIsStreaming(false);
    }
  }, []);

  const clearChat = useCallback(() => {
    setAgents(INITIAL_STATE);
    setMessages([]);
  }, []);

  return { agents, messages, isStreaming, runQuery, clearChat };
}
