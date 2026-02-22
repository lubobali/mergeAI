"use client";

import Link from "next/link";
import { UserButton, useUser } from "@clerk/nextjs";
import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useAgentStream } from "@/hooks/use-agent-stream";
import type { AgentStatus } from "@/hooks/use-agent-stream";
import Papa from "papaparse";
import PlotlyChart from "@/components/PlotlyChart";

interface FileInfo {
  id: string;
  fileName: string;
  columns: string[];
  rowCount: number;
  isDemo?: boolean;
}

const EXAMPLE_QUERIES = [
  "Compare average training cost by department",
  "Show training outcome distribution breakdown",
  "Show average training cost trend over time by month",
  "What are the top 5 most expensive training programs?",
];

const agentVariants = {
  idle: { opacity: 0.4, scale: 0.95 },
  active: {
    opacity: 1,
    scale: 1.05,
    transition: { repeat: Infinity, repeatType: "reverse" as const, duration: 0.8 },
  },
  done: { opacity: 1, scale: 1 },
  retry: { opacity: 1, scale: 1 },
  error: { opacity: 1, scale: 1 },
};

const agentColors: Record<AgentStatus, string> = {
  idle: "border-[#1e3a5f]",
  active: "border-blue-500 shadow-lg shadow-blue-500/20",
  done: "border-green-500",
  retry: "border-orange-500",
  error: "border-red-500",
};

export default function Dashboard() {
  const { user } = useUser();
  const isLoggedIn = !!user;
  const [query, setQuery] = useState("");
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [showUserGuide, setShowUserGuide] = useState(false);
  const [expandedSql, setExpandedSql] = useState<Set<string>>(new Set());
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { agents, messages, isStreaming, runQuery, clearChat } =
    useAgentStream();

  const isAgentActive =
    isStreaming ||
    agents.schema.status === "active" ||
    agents.sql.status === "active" ||
    agents.validator.status === "active";

  // Load files from API (server derives userId from Clerk session)
  useEffect(() => {
    fetch("/api/files")
      .then((r) => r.json())
      .then((data) => setFiles(data))
      .catch(console.error);
  }, []);

  // Auto-scroll to bottom when messages or agents change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, agents, isStreaming]);

  const handleSubmit = async (q?: string) => {
    const question = q || query;
    if (!question.trim() || isAgentActive) return;
    setQuery("");
    runQuery(question);
  };

  const toggleSql = (msgId: string) => {
    setExpandedSql((prev) => {
      const next = new Set(prev);
      if (next.has(msgId)) next.delete(msgId);
      else next.add(msgId);
      return next;
    });
  };

  // CSV Upload handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data as Record<string, string>[];
        if (rows.length === 0) {
          setUploading(false);
          return;
        }

        const columns = Object.keys(rows[0]);
        const columnTypes: Record<string, string> = {};
        const sampleValues: Record<string, string[]> = {};

        for (const col of columns) {
          sampleValues[col] = rows
            .slice(0, 5)
            .map((r) => r[col])
            .filter(Boolean);
          const testVals = rows.slice(0, 20).map((r) => r[col]);
          const allNum = testVals.every(
            (v) => !v || !isNaN(Number(v.replace(/[,$]/g, "")))
          );
          columnTypes[col] = allNum ? "number" : "text";
        }

        try {
          const res = await fetch("/api/upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              fileName: file.name,
              columns,
              columnTypes,
              sampleValues,
              rows,
            }),
          });
          if (!res.ok) {
            console.error("Upload failed:", res.status);
            setUploading(false);
            return;
          }
          const newFile = await res.json();
          setFiles((prev) => [...prev, newFile]);
        } catch (err) {
          console.error("Upload failed:", err);
        }
        setUploading(false);
      },
    });

    // Reset input
    e.target.value = "";
  };

  // Format column header: snake_case / camelCase / lowercase → Title Case
  const formatHeader = (col: string) =>
    col
      .replace(/_/g, " ")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/\b\w/g, (c) => c.toUpperCase());

  // Format cell value: numbers get 2 decimals, text gets title case
  const formatCell = (val: unknown) => {
    if (val == null) return "—";
    const s = String(val);
    const num = Number(s);
    if (!isNaN(num) && s.length > 0) {
      if (Number.isInteger(num)) return num.toLocaleString();
      return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    const cleaned = s.replace(/(\d+\.\d{3,})/g, (match) => Number(match).toFixed(2));
    if (cleaned.length > 1 && cleaned === cleaned.toLowerCase()) {
      return cleaned.replace(/\b\w/g, (c) => c.toUpperCase());
    }
    return cleaned;
  };

  const demoFiles = files.filter((f) => f.isDemo);
  const userFiles = files.filter((f) => !f.isDemo);
  const hasMessages = messages.length > 0 || isAgentActive;

  return (
    <div className="h-screen bg-[#0c1929] text-white flex overflow-hidden">
      {/* File Sidebar — hidden on mobile */}
      <aside className="hidden md:flex w-64 bg-[#091320] border-r border-[#1e3a5f]/30 p-4 flex-col">
        <h2 className="text-sm font-semibold text-blue-200/60 uppercase tracking-wider mb-4">
          Your Data
        </h2>

        {/* Demo Files */}
        {demoFiles.length > 0 && (
          <div className="mb-6">
            <p className="text-xs text-blue-200/40 mb-2">Demo Files</p>
            {demoFiles.map((file) => (
              <div
                key={file.id}
                className="mb-2 p-2 bg-[#111d33]/70 rounded-lg hover:bg-[#111d33] transition cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span className="text-green-400 text-xs">●</span>
                  <span className="text-sm font-medium truncate">
                    {file.fileName}
                  </span>
                </div>
                <p className="text-xs text-blue-200/40 mt-1 pl-4">
                  {file.columns.length} cols · {file.rowCount} rows
                </p>
              </div>
            ))}
          </div>
        )}

        {/* User Files */}
        <div className="mb-4">
          <p className="text-xs text-blue-200/40 mb-2">Your Files</p>
          {userFiles.length === 0 ? (
            <p className="text-xs text-blue-200/30 italic px-2">
              None uploaded yet
            </p>
          ) : (
            userFiles.map((file) => (
              <div
                key={file.id}
                className="mb-2 p-2 bg-[#111d33]/70 rounded-lg hover:bg-[#111d33] transition cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span className="text-blue-400 text-xs">●</span>
                  <span className="text-sm font-medium truncate">
                    {file.fileName}
                  </span>
                </div>
                <p className="text-xs text-blue-200/40 mt-1 pl-4">
                  {file.columns.length} cols · {file.rowCount} rows
                </p>
              </div>
            ))
          )}
        </div>

        {/* Upload Button */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={handleFileUpload}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="mt-auto w-full py-2 px-4 border border-dashed border-[#1e3a5f] rounded-lg text-sm text-blue-200/60 hover:border-blue-500 hover:text-blue-400 transition disabled:opacity-50"
        >
          {uploading ? "Uploading..." : "+ Upload CSV"}
        </button>
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        {/* Blue sun radial glow */}
        <div className="absolute top-[30%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] rounded-full bg-[radial-gradient(circle,_#2563eb_0%,_#1e40af_20%,_#1e3a8a_35%,_#0c1929_65%)] opacity-30 blur-2xl pointer-events-none z-0" />

        {/* Top Nav */}
        <header className="flex items-center justify-between px-6 py-3 border-b border-[#1e3a5f]/30 relative z-10">
          <h1 className="text-lg font-bold">
            <span className="text-blue-400">Merge</span>AI
          </h1>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowUserGuide(!showUserGuide)}
              className="text-sm text-blue-200/60 hover:text-white transition px-3 py-1 border border-[#1e3a5f] rounded-lg"
            >
              User Guide
            </button>
            {isLoggedIn ? (
              <UserButton afterSignOutUrl="/" />
            ) : (
              <Link
                href="/sign-up"
                className="px-4 py-1.5 text-sm bg-blue-600 hover:bg-blue-500 rounded-lg transition"
              >
                Sign Up
              </Link>
            )}
          </div>
        </header>

        {/* Agent Cards — ALWAYS visible, pinned at top */}
        {hasMessages && (
          <div className="px-6 py-4 border-b border-[#1e3a5f]/20 relative z-10 bg-[#0c1929]/95 backdrop-blur-sm">
            <div className="flex flex-col md:flex-row items-center justify-center gap-4">
              {(["schema", "sql", "validator"] as const).map((agent, i) => (
                <div key={agent} className="flex flex-col md:flex-row items-center gap-4">
                  <motion.div
                    variants={agentVariants}
                    animate={agents[agent].status}
                    className={`bg-[#111d33] border-2 ${agentColors[agents[agent].status]} rounded-xl p-4 text-center w-44 transition-colors`}
                  >
                    <div className="text-2xl mb-1">
                      {agent === "schema"
                        ? "🔍"
                        : agent === "sql"
                          ? "🔨"
                          : "✓"}
                    </div>
                    <h3 className="font-semibold text-sm mb-1">
                      {agent === "schema"
                        ? "Schema Agent"
                        : agent === "sql"
                          ? "SQL Agent"
                          : "Validator Agent"}
                    </h3>
                    <p className="text-xs text-blue-200/60 h-8 overflow-hidden">
                      {agents[agent].message || (
                        <span className="text-blue-200/30">Waiting...</span>
                      )}
                    </p>
                    {agents[agent].status === "done" && (
                      <span className="text-green-400 text-xs">Done</span>
                    )}
                    {agents[agent].status === "retry" && (
                      <span className="text-orange-400 text-xs">
                        Retrying...
                      </span>
                    )}
                  </motion.div>
                  {i < 2 && (
                    <span className="text-blue-400/40 text-xl">→</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Main Content — Scrollable chat thread */}
        <div className="flex-1 overflow-y-auto px-6 py-8 relative z-10">
          {!hasMessages ? (
            /* Empty state — show example queries */
            <div className="max-w-2xl mx-auto text-center pt-16">
              <h2 className="text-3xl font-bold mb-2">
                <span className="text-blue-400">Merge</span>AI
              </h2>
              <p className="text-blue-200/60 mb-8">
                Your AI Data Analyst — ask anything about your data
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {EXAMPLE_QUERIES.map((eq) => (
                  <button
                    key={eq}
                    onClick={() => handleSubmit(eq)}
                    className="px-4 py-2 bg-[#111d33] border border-[#1e3a5f] rounded-full text-sm text-blue-100/70 hover:border-blue-500 hover:text-blue-400 transition"
                  >
                    {eq}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Chat Thread */
            <div className="max-w-4xl mx-auto space-y-6">
              {messages.map((msg) => (
                <div key={msg.id}>
                  {msg.role === "user" ? (
                    /* User question bubble — right aligned */
                    <div className="flex justify-end">
                      <div className="bg-blue-600/20 border border-blue-500/30 rounded-2xl rounded-br-sm px-4 py-2.5 max-w-[80%]">
                        <p className="text-blue-100">{msg.question}</p>
                      </div>
                    </div>
                  ) : (
                    /* Assistant response — left aligned */
                    <div className="space-y-3">
                      {/* Error */}
                      {msg.error && (
                        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-300 text-sm">
                          {msg.error}
                        </div>
                      )}

                      {/* NL Summary */}
                      {msg.result?.summary && (
                        <div className="bg-[#111d33]/80 border border-[#1e3a5f] rounded-xl p-4">
                          <p className="text-blue-100/90 text-sm leading-relaxed">
                            {msg.result.summary}
                          </p>
                        </div>
                      )}

                      {/* Interactive Chart */}
                      {msg.result?.chart && (
                        <div className="bg-[#111d33]/80 border border-[#1e3a5f] rounded-xl p-4 overflow-hidden">
                          <PlotlyChart config={msg.result.chart} />
                        </div>
                      )}

                      {/* Results Table */}
                      {msg.result && msg.result.rows.length > 0 && (
                        <div className="space-y-3">
                          <div className="flex items-center gap-4 text-sm text-blue-200/60">
                            <span>
                              {msg.result.chart && msg.result.rows.length > 10
                                ? `Showing 10 of ${msg.result.rowCount} rows`
                                : msg.result.rows.length > 50
                                  ? `Showing 50 of ${msg.result.rowCount} rows`
                                  : `${msg.result.rowCount} rows`}
                              {" "}· Round {msg.result.rounds}/3 ·{" "}
                              {(msg.result.timing / 1000).toFixed(1)}s
                            </span>
                            <button
                              onClick={() => toggleSql(msg.id)}
                              className="px-2 py-1 border border-[#1e3a5f] rounded text-xs hover:border-blue-500 transition"
                            >
                              {expandedSql.has(msg.id) ? "Hide SQL" : "View SQL"}
                            </button>
                          </div>

                          {/* SQL Viewer */}
                          {expandedSql.has(msg.id) && (
                            <pre className="bg-[#091320] border border-[#1e3a5f] rounded-lg p-4 text-sm text-blue-200/80 overflow-x-auto">
                              {msg.result.sql}
                            </pre>
                          )}

                          {/* Data Table */}
                          <div className="overflow-x-auto rounded-lg border border-[#1e3a5f]">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="bg-[#111d33] border-b border-[#1e3a5f]">
                                  {msg.result.columns.map((col) => (
                                    <th
                                      key={col}
                                      className="px-4 py-3 text-left text-blue-200/80 font-semibold whitespace-nowrap"
                                    >
                                      {formatHeader(col)}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {msg.result.rows.slice(0, msg.result.chart ? 10 : 50).map((row, i) => (
                                  <tr
                                    key={i}
                                    className="border-b border-[#1e3a5f]/30 hover:bg-[#111d33]/50"
                                  >
                                    {msg.result!.columns.map((col) => (
                                      <td
                                        key={col}
                                        className="px-4 py-2.5 text-blue-100/90 whitespace-nowrap"
                                      >
                                        {formatCell(row[col])}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* No results */}
                      {msg.result && msg.result.rows.length === 0 && !msg.error && (
                        <div className="text-center text-blue-200/60 py-4">
                          No results found. Try rephrasing your question.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {/* Loading indicator — shows while agents are working */}
              {isAgentActive && (
                <div className="flex justify-center py-4">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" />
                    <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:0.1s]" />
                    <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Chat Input */}
        <div className="px-6 py-4 border-t border-[#1e3a5f]/30 relative z-10">
          <div className="max-w-3xl mx-auto flex gap-3">
            {messages.length > 0 && (
              <button
                onClick={() => { clearChat(); setExpandedSql(new Set()); }}
                className="px-3 py-3 border border-[#1e3a5f] rounded-xl text-sm text-blue-200/60 hover:border-red-500/50 hover:text-red-400 transition whitespace-nowrap"
                title="Clear chat history"
              >
                Clear
              </button>
            )}
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder={messages.length > 0 ? "Ask a follow-up or new question..." : "Ask about your data..."}
              className="flex-1 bg-[#111d33] border border-[#1e3a5f] rounded-xl px-4 py-3 text-white placeholder-blue-200/30 focus:outline-none focus:border-blue-500 transition"
            />
            <button
              onClick={() => handleSubmit()}
              disabled={!query.trim() || isAgentActive}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-[#111d33] disabled:text-blue-200/30 rounded-xl font-medium transition"
            >
              →
            </button>
          </div>
        </div>
      </main>

      {/* User Guide Modal */}
      {showUserGuide && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-[#0c1929] border border-[#1e3a5f] rounded-2xl p-8 max-w-lg w-full mx-4">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">User Guide</h2>
              <button
                onClick={() => setShowUserGuide(false)}
                className="text-blue-200/60 hover:text-white text-2xl"
              >
                x
              </button>
            </div>
            <div className="space-y-4 text-sm">
              <div>
                <h3 className="font-semibold text-blue-400 mb-2">
                  Getting Started
                </h3>
                <p className="text-blue-200/60">
                  1. Demo files are pre-loaded (employee data + training data)
                  <br />
                  2. Type a question or click an example query
                  <br />
                  3. Watch 3 AI agents collaborate to answer
                  <br />
                  4. Upload your own CSV files for custom analysis
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-blue-400 mb-2">
                  Demo Files
                </h3>
                <ul className="text-blue-200/60 space-y-1">
                  <li>
                    📊 <strong>employee_data.csv</strong> — 3,000 employees with
                    department, salary, performance, demographics
                  </li>
                  <li>
                    📊 <strong>training_data.csv</strong> — 3,000 training records
                    with programs, costs, outcomes
                  </li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-blue-400 mb-2">
                  How the Agents Work
                </h3>
                <p className="text-blue-200/60">
                  🔍 <strong>Schema Agent</strong> (Nano 8B) — Finds
                  relationships between your files
                  <br />
                  🔨 <strong>SQL Agent</strong> (253B Ultra) — Generates
                  PostgreSQL queries
                  <br />
                  ✓ <strong>Validator</strong> — Checks results, retries if
                  needed (max 3 rounds)
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
