import { AI_CONFIG } from "@/config/ai";
import type { ProviderAdapter } from "@/lib/ai-provider";

export interface BrainstormRequest {
  mode: "ORIGINAL" | "FANFIC";
  sourceTitle?: string;
  seed?: string;
}

export interface LoglineCard {
  id: string;
  text: string;
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
  provider: ProviderAdapter,
): Promise<string[]> {
  const prompt = buildBrainstormPrompt(req);
  const content = await provider.completeChat([{ role: "user", content: prompt }], "");
  return parseLoglines(content, AI_CONFIG.BRAINSTORM_LOGLINE_COUNT);
}
