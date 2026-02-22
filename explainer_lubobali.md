# MergeAI — Your AI Data Analyst

**Product name:** MergeAI

**One-line description:** Upload spreadsheets, ask in plain English, watch 3 AI agents find the answer — live.

**Team members:** Lubo Bali (solo) — lubo@lubot.ai

**Live deployment URL:** https://merge-ai-omega.vercel.app/

**GitHub repository URL:** https://github.com/lubobali/mergeAI

## Problem Solved

Every company has data trapped in disconnected spreadsheets. One file has employees, another has training records, a third has sales. To get answers across these files you need Tableau, Power BI, or a data engineer who writes SQL. MergeAI makes that instant — upload any CSV files, ask a question like "Which department spends the most on training?", and 3 AI agents figure out how to connect your data automatically.

What makes it different: MergeAI doesn't just answer simple questions from a single file. It discovers relationships between files that have never seen each other — matching "EmpID" in one file to "Employee ID" in another — and writes real PostgreSQL cross-file JOIN queries with CTEs, JSONB extraction, and case-insensitive matching. No drag-and-drop. No mapping. No SQL knowledge needed.

The agents work live in front of your eyes: Schema Agent discovers connections (Nano 8B), SQL Agent writes the query (253B Ultra), and a deterministic Validator checks the results. If something fails — wrong column, zero rows, case mismatch — the agents retry and self-correct up to 3 rounds. You see every step, every retry, and can view the exact SQL generated. Full transparency, real database, real queries.
