import { AI_CONFIG } from "@/config/ai";
import type { ProviderAdapter } from "@/lib/ai-provider";

export interface UniverseDoc {
  name: string;
  type: string;
  summary: string;
}

export interface UniverseContext {
  universeName: string;
  sourceTitle?: string;
  docs: UniverseDoc[];
}

export interface BrainstormRequest {
  mode: "ORIGINAL" | "FANFIC";
  sourceTitle?: string;
  seed?: string;
  universeContext?: UniverseContext;
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

  let universeText = "";
  if (req.universeContext && req.universeContext.docs.length > 0) {
    const { universeName, sourceTitle, docs } = req.universeContext;
    const universeLabel = sourceTitle
      ? `"${universeName}" (fanfic universe based on "${sourceTitle}")`
      : `"${universeName}"`;
    const docEntries = docs.map((d) => `### ${d.name} (${d.type})\n${d.summary}`).join("\n\n");
    universeText = `\n\nUse the following universe context as reference for tone, characters, worldbuilding, and existing story elements when generating loglines:\n\nUniverse: ${universeLabel}\n\n${docEntries}`;
  }

  return `Generate exactly ${count} distinct, compelling story loglines for ${modeText}. Each logline should be 1-2 sentences that capture the central conflict and stakes.${seedText}${universeText}

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
