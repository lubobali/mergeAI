import OpenAI from "openai";

const nvidia = new OpenAI({
  apiKey: process.env.NVIDIA_API_KEY!,
  baseURL: "https://integrate.api.nvidia.com/v1",
});

// Schema Agent — Nano 8B (fast, structured output)
export async function callSchemaAgent(prompt: string): Promise<string> {
  const res = await nvidia.chat.completions.create({
    model: "nvidia/llama-3.1-nemotron-nano-8b-v1",
    messages: [{ role: "user", content: prompt }],
    temperature: 0,
    max_tokens: 2048,
  });
  return res.choices[0].message.content || "";
}

// Summary Agent — Nano 8B (fast NL summary of query results)
export async function callSummaryAgent(prompt: string): Promise<string> {
  const res = await nvidia.chat.completions.create({
    model: "nvidia/llama-3.1-nemotron-nano-8b-v1",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
    max_tokens: 512,
  });
  return res.choices[0].message.content || "";
}

// Chart Agent — Nano 8B (fast chart type selection)
export async function callChartAgent(prompt: string): Promise<string> {
  const res = await nvidia.chat.completions.create({
    model: "nvidia/llama-3.1-nemotron-nano-8b-v1",
    messages: [{ role: "user", content: prompt }],
    temperature: 0,
    max_tokens: 1024,
  });
  return res.choices[0].message.content || "";
}

// SQL Agent — 253B Ultra (most accurate, production-grade)
// Per NVIDIA docs: "detailed thinking off" disables <think> tags for clean output
export async function callSqlAgent(prompt: string): Promise<string> {
  const res = await nvidia.chat.completions.create({
    model: "nvidia/llama-3.1-nemotron-ultra-253b-v1",
    messages: [
      { role: "system", content: "detailed thinking off" },
      { role: "user", content: prompt },
    ],
    temperature: 0,
    max_tokens: 4096,
  });
  return res.choices[0].message.content || "";
}
