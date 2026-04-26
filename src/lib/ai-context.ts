import { tiptapToMarkdown } from "@/lib/tiptap-to-markdown";
import type { TipTapNode } from "@/lib/tiptap-to-markdown";
import { AI_CONFIG } from "@/config/ai";

export type MessageRole = "user" | "assistant";

export interface ChatMessage {
  role: MessageRole;
  content: string;
}

const RATING_DESCRIPTIONS: Record<string, string> = {
  G: "suitable for all ages, no adult content",
  T: "teen-appropriate, mild themes",
  M: "mature themes, some adult content",
  E: "explicit adult content",
};

export function buildTier1Context(
  tiptapJson: TipTapNode,
  messages: ChatMessage[],
): { documentMarkdown: string; recentMessages: ChatMessage[] } {
  const documentMarkdown = tiptapToMarkdown(tiptapJson);
  const recentMessages = messages.slice(-AI_CONFIG.CHAT_FULL_WINDOW);
  return { documentMarkdown, recentMessages };
}

export function buildSystemPrompt(
  documentMarkdown: string,
  mode: string,
  rating: string,
  chatSummary?: string | null,
): string {
  const modeLabel = mode === "FANFIC" ? "fanfiction" : "original fiction";
  const ratingDesc = RATING_DESCRIPTIONS[rating] ?? "general";

  const parts = [
    `You are a writing assistant helping with a ${modeLabel} story (rated ${rating} — ${ratingDesc}).`,
    "Your role is to help the writer develop characters, plot, worldbuilding, and prose. Be creative, collaborative, and responsive to the writer's vision.",
    "",
    "Current document:",
    documentMarkdown || "(empty document)",
  ];

  if (chatSummary) {
    parts.push("", "Summary of earlier conversation:", chatSummary);
  }

  return parts.join("\n");
}
