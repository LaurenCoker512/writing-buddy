import { prisma } from "@/lib/prisma";
import { tiptapToMarkdown } from "@/lib/tiptap-to-markdown";
import type { TipTapNode } from "@/lib/tiptap-to-markdown";
import { AI_CONFIG } from "@/config/ai";
import type { SiblingDocument } from "@/lib/ai-context";

type SiblingDocRecord = SiblingDocument & {
  updatedAt: Date;
  contentSummaryGeneratedAt: Date | null;
};

async function generateSummary(
  markdown: string,
  name: string,
  apiKey: string,
): Promise<string | null> {
  const prompt = `Summarize the following story document in 2-4 sentences. Focus on the most important details for writing assistance context.\n\nDocument: "${name}"\n\n${markdown || "(empty)"}\n\nSummary:`;

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

  if (!res.ok) return null;

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content ?? null;
}

function isStale(doc: SiblingDocRecord): boolean {
  return (
    !doc.contentSummary ||
    !doc.contentSummaryGeneratedAt ||
    doc.updatedAt > doc.contentSummaryGeneratedAt
  );
}

export async function ensureContentSummariesFresh(
  documentIds: string[],
  apiKey: string,
): Promise<SiblingDocument[]> {
  if (documentIds.length === 0) return [];

  const documents = await prisma.document.findMany({
    where: { id: { in: documentIds } },
    select: {
      id: true,
      type: true,
      name: true,
      tiptapJson: true,
      contentSummary: true,
      contentSummaryGeneratedAt: true,
      updatedAt: true,
    },
  });

  const stale = documents.filter(isStale);

  await Promise.all(
    stale.map(async (doc) => {
      const markdown = tiptapToMarkdown(doc.tiptapJson as TipTapNode);
      const summary = await generateSummary(markdown, doc.name, apiKey);
      if (summary === null) return;

      await prisma.document.update({
        where: { id: doc.id },
        data: {
          contentSummary: summary,
          contentSummaryGeneratedAt: new Date(),
        },
      });

      doc.contentSummary = summary;
    }),
  );

  return documents.map((doc) => ({
    id: doc.id,
    type: doc.type,
    name: doc.name,
    contentSummary: doc.contentSummary,
  }));
}
