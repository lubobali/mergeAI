"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { SignedIn, SignedOut } from "@clerk/nextjs";
import { useState, useEffect, useRef } from "react";

const agents = [
  { icon: "🔍", name: "Schema Agent", desc: "Discovers relationships", model: "Nano 8B", action: "Analyzing schema..." },
  { icon: "🔨", name: "SQL Agent", desc: "Builds the query", model: "Ultra 253B", action: "Generating SQL..." },
  { icon: "✓", name: "Validator Agent", desc: "Ensures accuracy", model: "Deterministic", action: "Validating results..." },
];

function AgentPipelineSection() {
  const [activeAgent, setActiveAgent] = useState(-1);
  const [doneAgents, setDoneAgents] = useState<Set<number>>(new Set());
  const sectionRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold: 0.3 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    let step = 0;
    const timeline = [
      // Agent 0: running
      () => { setActiveAgent(0); setDoneAgents(new Set()); },
      // Agent 0: done, Agent 1: running
      () => { setActiveAgent(1); setDoneAgents(new Set([0])); },
      // Agent 1: done, Agent 2: running
      () => { setActiveAgent(2); setDoneAgents(new Set([0, 1])); },
      // All done
      () => { setActiveAgent(-1); setDoneAgents(new Set([0, 1, 2])); },
      // Reset
      () => { setActiveAgent(-1); setDoneAgents(new Set()); },
    ];

    const delays = [0, 1500, 1500, 1200, 2000];

    let timeout: NodeJS.Timeout;
    const runStep = () => {
      if (step < timeline.length) {
        timeline[step]();
        step++;
        if (step < timeline.length) {
          timeout = setTimeout(runStep, delays[step]);
        } else {
          // Loop
          timeout = setTimeout(() => { step = 0; runStep(); }, delays[delays.length - 1]);
        }
      }
    };
    timeout = setTimeout(runStep, 500);
    return () => clearTimeout(timeout);
  }, [isVisible]);

  return (
    <section ref={sectionRef} className="max-w-5xl mx-auto py-20 px-6 relative z-10">
      <h2 className="text-3xl font-bold text-center mb-4">
        3 AI Agents That Talk To Each Other
      </h2>
      <p className="text-blue-200/60 text-center mb-16 max-w-2xl mx-auto">
        Not just one AI. Three specialized agents that collaborate, retry, and
        self-correct — live, in front of your eyes.
      </p>
      <div className="flex flex-col md:flex-row items-center justify-center gap-6">
        {agents.map((agent, i) => {
          const isRunning = activeAgent === i;
          const isDone = doneAgents.has(i);
          return (
            <div key={agent.name} className="flex items-center gap-6">
              <div
                className={`relative bg-[#111d33] rounded-xl p-6 text-center w-48 transition-all duration-500 ${
                  isRunning
                    ? "border-2 border-blue-400 shadow-lg shadow-blue-500/20"
                    : isDone
                    ? "border-2 border-green-400/60"
                    : "border border-[#1e3a5f]"
                }`}
              >
                {isRunning && (
                  <div className="absolute inset-0 rounded-xl border-2 border-blue-400 animate-pulse pointer-events-none" />
                )}
                <div className="text-3xl mb-2">
                  {isDone ? (
                    <span className="text-green-400">✓</span>
                  ) : (
                    agent.icon
                  )}
                </div>
                <h3 className="font-semibold mb-1">{agent.name}</h3>
                <p className={`text-sm mb-2 transition-all duration-300 ${
                  isRunning ? "text-blue-300" : "text-blue-200/60"
                }`}>
                  {isRunning ? agent.action : isDone ? "Done" : agent.desc}
                </p>
                <span className={`text-xs px-2 py-1 rounded-full transition-all duration-300 ${
                  isRunning
                    ? "bg-blue-500/30 text-blue-200"
                    : isDone
                    ? "bg-green-500/20 text-green-300"
                    : "bg-[#1e3a5f] text-blue-200"
                }`}>
                  {agent.model}
                </span>
              </div>
              {i < 2 && (
                <div className={`text-2xl hidden md:block transition-all duration-500 ${
                  activeAgent === i + 1
                    ? "text-blue-400 translate-x-1 scale-125"
                    : doneAgents.has(i)
                    ? "text-green-400/60"
                    : "text-blue-400/40"
                }`}>
                  →
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0c1929] text-white relative">
      {/* Blue sun radial glow — center shining outward */}
      <div className="absolute top-[20%] left-1/2 w-[1200px] h-[1200px] rounded-full bg-[radial-gradient(circle,_#2563eb_0%,_#1e40af_20%,_#1e3a8a_35%,_#0c1929_65%)] blur-2xl pointer-events-none z-0 overflow-hidden sun-breathe" />
      {/* Navbar */}
      <nav className="sticky top-2 flex items-center justify-between px-8 py-4 max-w-6xl mx-auto z-20 bg-[#0c1929]/70 backdrop-blur-xl border border-white/10 rounded-2xl shadow-lg shadow-black/20 transition-all">
        <div className="text-2xl font-bold tracking-tight">
          <span className="text-blue-400">Merge</span>AI
        </div>
        <div className="flex gap-4">
          <a
            href="https://youtu.be/Yr0CkXKNF0M"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-4 py-2 text-sm text-red-400/80 hover:text-red-300 transition"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
            Full Demo
          </a>
          <a
            href="https://www.youtube.com/watch?v=_BmN9YIQXGw"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-4 py-2 text-sm text-red-400/80 hover:text-red-300 transition"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
            Vibes Demo
          </a>
          <a
            href="/architecture.html"
            className="px-4 py-2 text-sm text-blue-100/70 hover:text-white transition"
          >
            Architecture
          </a>
          <SignedOut>
            <Link
              href="/sign-in"
              className="px-4 py-2 text-sm text-blue-100/70 hover:text-white transition"
            >
              Sign In
            </Link>
            <Link
              href="/sign-up"
              className="btn-shimmer px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 rounded-lg transition"
            >
              Get Started Free
            </Link>
          </SignedOut>
          <SignedIn>
            <Link
              href="/dashboard"
              className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-500 rounded-lg transition"
            >
              Dashboard →
            </Link>
          </SignedIn>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto text-center pt-24 pb-16 px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-block px-4 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-full text-blue-400 text-sm mb-6">
            3 AI Agents Working Together
          </div>
          <h1 className="text-5xl md:text-7xl font-bold leading-tight mb-6">
            <span className="text-shimmer-white">
              Upload. Ask.
            </span>
            <br />
            <span className="text-shimmer-gradient">
              Watch AI Think.
            </span>
          </h1>
          <p className="text-xl text-blue-100/90 max-w-2xl mx-auto mb-4">
            Your AI data analyst. Upload spreadsheets, ask anything in plain
            English.
            <br />
            3 AI agents discover how your data connects — and show you
            exactly how they think.
          </p>
          <p className="text-sm text-blue-200/40 mb-10">
            Built with Adal CLI · Joins across files automatically · Real PostgreSQL · SQL you can inspect
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link
              href="/dashboard"
              className="btn-shimmer px-8 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg text-lg font-medium transition"
            >
              Try with Sample Data →
            </Link>
            <Link
              href="/sign-up"
              className="px-8 py-3 border border-blue-500/40 hover:border-blue-400 rounded-lg text-lg text-blue-100/80 transition"
            >
              Sign Up Free
            </Link>
            <a
              href="#how-it-works"
              className="px-8 py-3 border border-[#1e3a5f] hover:border-blue-400 rounded-lg text-lg text-blue-100/80 transition"
            >
              See How It Works
            </a>
          </div>
        </motion.div>
      </section>

      {/* Agent Architecture — Animated Pipeline */}
      <AgentPipelineSection />

      {/* How It Works */}
      <section id="how-it-works" className="max-w-5xl mx-auto py-20 px-6 relative z-10">
        <h2 className="text-3xl font-bold text-center mb-16">How It Works</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            {
              step: "1",
              icon: "📁",
              title: "Upload Your Files",
              desc: "Drag and drop Excel or CSV files. We auto-detect columns, types, and relationships.",
            },
            {
              step: "2",
              icon: "💬",
              title: "Ask in Plain English",
              desc: '"Compare salary vs training cost by department" — just type naturally.',
            },
            {
              step: "3",
              icon: "🤖",
              title: "Watch 3 Agents Collaborate",
              desc: "Schema Agent finds connections. SQL Agent builds queries. Validator checks results.",
            },
          ].map((item) => (
            <motion.div
              key={item.step}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: Number(item.step) * 0.15 }}
              className="bg-[#111d33]/70 border border-[#1e3a5f]/50 rounded-xl p-8 text-center"
            >
              <div className="text-4xl mb-4">{item.icon}</div>
              <div className="text-sm text-blue-400 mb-2">
                Step {item.step}
              </div>
              <h3 className="text-xl font-semibold mb-3">{item.title}</h3>
              <p className="text-blue-200/60">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto py-20 px-6 relative z-10">
        <h2 className="text-3xl font-bold text-center mb-4">Powerful Features</h2>
        <p className="text-blue-200/60 text-center mb-16 max-w-2xl mx-auto">
          Everything you need to go from raw spreadsheets to actionable insights.
        </p>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              icon: "📊",
              title: "Interactive Charts",
              desc: "Plotly.js visualizations with hover tooltips, zoom, pan, and PNG download.",
            },
            {
              icon: "🔗",
              title: "Schema Tables Map",
              desc: "See file relationships as an interactive diagram. Drag, zoom, explore joins.",
            },
            {
              icon: "🔍",
              title: "Data Table Preview",
              desc: "Inspect your uploaded data instantly. Color-coded columns by type.",
            },
            {
              icon: "⚡",
              title: "AI-Suggested Queries",
              desc: "Smart questions generated from YOUR data. One click to run.",
            },
            {
              icon: "🔀",
              title: "Cross-File Joins",
              desc: "Upload multiple files. AI automatically discovers connections between them.",
            },
            {
              icon: "📁",
              title: "Excel & CSV Upload",
              desc: "Upload .xlsx, .xls, or .csv files. We handle the parsing automatically.",
            },
            {
              icon: "⬇️",
              title: "Export Results Excel & CSV",
              desc: "Download query results as Excel or CSV. Take your insights anywhere.",
            },
            {
              icon: "💬",
              title: "Follow-up Questions",
              desc: "Ask follow-ups naturally. AI remembers context from previous queries.",
            },
          ].map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="bg-[#111d33]/70 border border-[#1e3a5f]/50 rounded-xl p-5 hover:border-blue-400/50 hover:shadow-lg hover:shadow-blue-500/10 hover:-translate-y-1 transition-all duration-300 cursor-default"
            >
              <div className="text-2xl mb-2">{item.icon}</div>
              <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
              <p className="text-sm text-blue-200/60 leading-relaxed">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Comparison */}
      <section className="max-w-4xl mx-auto py-20 px-6 text-center relative z-10">
        <h2 className="text-3xl font-bold mb-12">Why MergeAI?</h2>
        <div className="grid md:grid-cols-2 gap-4 text-left">
          {[
            { tool: "Tableau", pain: "Drag-and-drop join configuration" },
            { tool: "Power BI", pain: "Composite model setup required" },
            { tool: "Looker", pain: "Write LookML to define relationships" },
            { tool: "ChatGPT", pain: "Unreliable pandas code, no database" },
          ].map((item) => (
            <div
              key={item.tool}
              className="flex items-center gap-3 bg-[#111d33]/50 border border-[#1e3a5f]/30 rounded-lg p-4"
            >
              <span className="text-red-400">✕</span>
              <span>
                <strong>{item.tool}:</strong>{" "}
                <span className="text-blue-200/60">{item.pain}</span>
              </span>
            </div>
          ))}
        </div>
        <div className="mt-8 bg-blue-500/10 border border-blue-500/20 rounded-lg p-6">
          <span className="text-blue-400 text-lg">
            ✓ <strong>MergeAI:</strong> One sentence. That&apos;s it.
          </span>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#1e3a5f]/30 py-8 text-center text-blue-200/40 text-sm relative z-10">
        <p>
          Built with{" "}
          <span className="text-blue-400 font-semibold">Adal CLI</span>{" "}
          powered by{" "}
          <span className="text-[#76b900] font-semibold">NVIDIA</span>
        </p>
        <p className="mt-2">
          Created by{" "}
          <a
            href="https://www.linkedin.com/in/lubo-bali/"
            className="text-blue-400 hover:underline"
            target="_blank"
          >
            Lubo Bali
          </a>{" "}
          — creator of{" "}
          <a
            href="https://lubot.ai"
            className="text-blue-400 hover:underline"
            target="_blank"
          >
            LuBot.ai
          </a>
          {" "}&middot;{" "}
          <a
            href="/architecture.html"
            className="text-blue-400 hover:underline"
          >
            Architecture
          </a>
        </p>
      </footer>
    </div>
  );
}
