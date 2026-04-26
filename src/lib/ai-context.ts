import { tiptapToMarkdown } from "@/lib/tiptap-to-markdown";
import type { TipTapNode } from "@/lib/tiptap-to-markdown";
import { AI_CONFIG } from "@/config/ai";
import { DOCUMENT_TYPE_ORDER } from "@/lib/documents";
import type { DocumentTypeValue } from "@/lib/documents";

export type MessageRole = "user" | "assistant";

export interface ChatMessage {
  role: MessageRole;
  content: string;
}

export interface SiblingDocument {
  id: string;
  type: string;
  name: string;
  contentSummary: string | null;
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function sortSiblingDocuments(
  documents: SiblingDocument[],
  currentDocumentType: string,
): SiblingDocument[] {
  return [...documents].sort((a, b) => {
    const aSameType = a.type === currentDocumentType ? 0 : 1;
    const bSameType = b.type === currentDocumentType ? 0 : 1;
    if (aSameType !== bSameType) return aSameType - bSameType;

    const aOrder = DOCUMENT_TYPE_ORDER.indexOf(a.type as DocumentTypeValue);
    const bOrder = DOCUMENT_TYPE_ORDER.indexOf(b.type as DocumentTypeValue);
    return (aOrder === -1 ? 999 : aOrder) - (bOrder === -1 ? 999 : bOrder);
  });
}

export function buildTier2Context(
  siblingDocuments: SiblingDocument[],
  currentDocumentType: string,
  budgetTokens: number = AI_CONFIG.AI_TIER2_BUDGET_TOKENS,
): string {
  const withSummaries = siblingDocuments.filter(
    (doc): doc is SiblingDocument & { contentSummary: string } =>
      doc.contentSummary !== null && doc.contentSummary.trim() !== "",
  );
  const sorted = sortSiblingDocuments(withSummaries, currentDocumentType);

  let usedTokens = 0;
  const included: string[] = [];

  for (const doc of sorted) {
    const entry = `### ${doc.name} (${doc.type})\n${doc.contentSummary}`;
    const entryTokens = estimateTokens(entry);
    if (usedTokens + entryTokens > budgetTokens) break;
    included.push(entry);
    usedTokens += entryTokens;
  }

  return included.join("\n\n");
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
  tier2Context?: string | null,
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

  if (tier2Context) {
    parts.push("", "Related documents in this story (summaries):", tier2Context);
  }

  if (chatSummary) {
    parts.push("", "Summary of earlier conversation:", chatSummary);
  }

  return parts.join("\n");
}
