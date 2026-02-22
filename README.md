<h2 align="center">MergeAI — Your AI Data Analyst</h2>

<p align="center"><strong>Upload spreadsheets. Ask in plain English. Watch 3 AI agents find the answer — live.</strong></p>

<p align="center">
  <a href="#"><strong>Try Live</strong></a> &nbsp;|&nbsp;
  <a href="#how-it-works">How It Works</a> &nbsp;|&nbsp;
  <a href="#the-tech">Tech Stack</a>
</p>

<p align="center"><i>Built solo in 48 hours for the Vibe Coding Hackathon 2026. Powered by NVIDIA NIM.</i></p>

---

Most analytics tools make you drag and drop, write formulas, or learn SQL. MergeAI doesn't. You upload your CSV files, type a question like *"which department spends the most on training?"*, and three AI agents collaborate in real-time to find the answer. No setup. No mapping. No SQL.

<!-- Screenshots will be added after deployment -->

---

## **HOW IT WORKS**

You upload two spreadsheets that have never seen each other. One has employee data, the other has training records. You type: *"Compare training cost by department."*

Here's what happens — and you watch it happen live:

```
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│  Schema Agent │  ──→  │  SQL Agent   │  ──→  │  Validator   │
│  (Nano 8B)   │       │  (253B Ultra)│       │ (Deterministic)│
│              │  ←──  │              │  ←──  │              │
│ Finds joins  │ retry │ Writes SQL   │ retry │ Checks results│
└──────────────┘       └──────────────┘       └──────────────┘
```

1. **Schema Agent** reads both files, understands the columns, spots that `EmpID` in one file matches `Employee ID` in the other
2. **SQL Agent** writes a real PostgreSQL query — CTEs, JSONB extraction, proper JOINs — to merge the data across files
3. **Validator** executes the query and checks the results. Zero rows? Case mismatch? Wrong column? It sends feedback and the agents retry. Up to 3 rounds of self-correction.

Results appear in a clean table with a plain English summary:

> *"Software Engineering has the highest average training cost at $596.71, while Sales has the lowest at $536.76."*

The whole thing takes about 8 seconds.

---

## **WHY THIS EXISTS**

| Tool | What You Need To Do |
|------|-------------------|
| **Tableau** | Manually drag-and-drop join configuration |
| **Power BI** | Create composite data models |
| **Looker** | Write LookML definitions |
| **ChatGPT** | Hope that in-memory pandas doesn't crash |
| **MergeAI** | Type one sentence |

Your data lives in a real PostgreSQL database. The queries are real SQL. The joins are real joins. Click "View SQL" to see exactly what the AI wrote — full transparency.

---

## **TECHNICAL INNOVATION**

### 3-Agent Pipeline with Self-Correction

Not a single LLM call that hopes for the best. Three specialized agents with a feedback loop:

```
Round 1: Schema Agent analyzes → SQL Agent generates → Validator checks
         ↓ (if 0 rows or errors)
Round 2: Schema Agent re-analyzes with feedback → SQL Agent regenerates → Validator re-checks
         ↓ (if still failing)
Round 3: Final attempt with accumulated context → Best-effort result
```

### NVIDIA NIM — Two Models Collaborating

| Agent | Model | Why |
|-------|-------|-----|
| **Schema Agent** | Nemotron Nano 8B | Fast schema analysis, JSON output, ~200ms |
| **SQL Agent** | Nemotron Ultra 253B | Most accurate SQL generation, handles complex CTEs |
| **Summary Agent** | Nemotron Nano 8B | Quick NL summary of results |

Per NVIDIA docs: `"detailed thinking off"` system prompt disables reasoning traces for clean SQL output from 253B.

### Universal JSONB Storage

Every CSV file — any schema, any columns — gets stored the same way:

```sql
-- One table handles ALL CSV files
uploaded_rows (
  file_id   UUID,        -- which file
  row_data  JSONB        -- {"Name": "Alice", "Salary": "85000", "Dept": "Engineering"}
)

-- Agent-generated query (real example):
WITH employees AS (
  SELECT row_data->>'EmpID' AS emp_id,
         row_data->>'DepartmentType' AS dept
  FROM uploaded_rows WHERE file_id = 'abc-123'
),
training AS (
  SELECT row_data->>'Employee ID' AS emp_id,
         (row_data->>'Training Cost')::NUMERIC AS cost
  FROM uploaded_rows WHERE file_id = 'def-456'
)
SELECT dept, AVG(cost) AS avg_training_cost
FROM employees JOIN training ON LOWER(emp_id) = LOWER(emp_id)
GROUP BY dept ORDER BY avg_training_cost DESC;
```

### Real-Time Agent Visualization (SSE + Framer Motion)

Server-Sent Events stream agent status to the browser. Framer Motion animates each agent card through states:

```
idle → active (pulsing blue) → done (green) → or retry (orange) → back to active
```

AG-UI Protocol event naming: `agent_start`, `agent_complete`, `round_retry`, `query_complete`.

---

## **THE TECH**

| Layer | Tech | Why |
|-------|------|-----|
| Framework | Next.js 15 (App Router) | React 19, server components, API routes |
| AI Models | NVIDIA NIM API | Nemotron 253B + Nano 8B via OpenAI-compatible SDK |
| Database | Neon PostgreSQL | Serverless HTTP mode, zero connection overhead |
| ORM | Drizzle v0.45.1 | Typed JSONB, lightest ORM, SQL-first |
| Streaming | SSE (ReadableStream) | Native, zero deps, real-time agent updates |
| Animation | Framer Motion | Agent card state transitions |
| Auth | Clerk | Sign-up/sign-in in 10 minutes, free tier |
| CSV Parsing | Papa Parse | Client-side, fast, handles any format |
| Deploy | Vercel | Auto-deploy from GitHub |

---

## **TRY IT**

Demo data is pre-loaded — 3,000 employees + 3,000 training records. Click any example query and watch the agents work.

Then upload your own CSV files. Any schema. Any columns. Any data. The agents figure it out.

---

## **LOCAL SETUP**

```bash
git clone https://github.com/lubobali/mergeAI.git
cd mergeAI
npm install
```

Create `.env.local`:
```
DATABASE_URL=your_neon_connection_string
NVIDIA_API_KEY=your_nvidia_nim_key
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_key
CLERK_SECRET_KEY=your_clerk_secret
```

```bash
npx drizzle-kit push    # create tables
npm run dev             # start dev server
```

---

<p align="center"><i>Built for Vibe Coding Hackathon 2026 with AdaL CLI</i></p>
