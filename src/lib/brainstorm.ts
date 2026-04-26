import { AI_CONFIG } from "@/config/ai";

export interface BrainstormRequest {
  mode: "ORIGINAL" | "FANFIC";
  sourceTitle?: string;
  seed?: string;
}

export interface LoglineCard {
  id: string;
  text: string;
}

interface OpenRouterResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

export function parseLoglines(content: string, count: number): string[] {
  const lines = content
    .split("\n")
    .map((line) => line.replace(/^\s*\d+[\.\)]\s*/, "").trim())
    .filter((line) => line.length > 0);

  const result = lines.slice(0, count);

  while (result.length < count) {
    result.push("");
  }

  return result.filter((line) => line.length > 0);
}

function buildBrainstormPrompt(req: BrainstormRequest): string {
  const count = AI_CONFIG.BRAINSTORM_LOGLINE_COUNT;
  const modeText =
    req.mode === "FANFIC"
      ? `a fanfiction story${req.sourceTitle ? ` based on "${req.sourceTitle}"` : ""}`
      : "an original fiction story";

  const seedText = req.seed?.trim()
    ? `\n\nUse this seed idea as inspiration: ${req.seed.trim()}`
    : "";

  return `Generate exactly ${count} distinct, compelling story loglines for ${modeText}. Each logline should be 1-2 sentences that capture the central conflict and stakes.${seedText}

Format your response as a numbered list with exactly ${count} items. Each item on its own line. No introductory text, no explanations, just the numbered loglines.`;
}

export async function generateLoglines(
  req: BrainstormRequest,
  apiKey: string,
): Promise<string[]> {
  const prompt = buildBrainstormPrompt(req);

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://writing-buddy.app",
      "X-Title": "Writing Buddy",
    },
    body: JSON.stringify({
      model: AI_CONFIG.OPENROUTER_DEFAULT_MODEL,
      stream: false,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenRouter error: ${res.status}`);
  }

  const data = (await res.json()) as OpenRouterResponse;
  const content = data.choices?.[0]?.message?.content ?? "";

  return parseLoglines(content, AI_CONFIG.BRAINSTORM_LOGLINE_COUNT);
}
