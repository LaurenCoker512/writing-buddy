import { prisma } from "@/lib/prisma";
import { tiptapToMarkdown } from "@/lib/tiptap-to-markdown";
import type { TipTapNode } from "@/lib/tiptap-to-markdown";
import type { SiblingDocument } from "@/lib/ai-context";
import type { ProviderAdapter } from "@/lib/ai-provider";

type SiblingDocRecord = SiblingDocument & {
  updatedAt: Date;
  contentSummaryGeneratedAt: Date | null;
};

async function generateSummary(
  markdown: string,
  name: string,
  provider: ProviderAdapter,
): Promise<string | null> {
  const prompt = `Summarize the following story document in 2-4 sentences. Focus on the most important details for writing assistance context.\n\nDocument: "${name}"\n\n${markdown || "(empty)"}\n\nSummary:`;

  try {
    const summary = await provider.completeChat([{ role: "user", content: prompt }], "");
    return summary || null;
  } catch {
    return null;
  }
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
  provider: ProviderAdapter,
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
  const updatedSummaries = new Map<string, string>();

  await Promise.all(
    stale.map(async (doc) => {
      const markdown = tiptapToMarkdown(doc.tiptapJson as TipTapNode);
      const summary = await generateSummary(markdown, doc.name, provider);
      if (summary === null) return;

      await prisma.document.update({
        where: { id: doc.id },
        data: {
          contentSummary: summary,
          contentSummaryGeneratedAt: new Date(),
        },
      });

      updatedSummaries.set(doc.id, summary);
    }),
  );

  return documents.map((doc) => ({
    id: doc.id,
    type: doc.type,
    name: doc.name,
    contentSummary: updatedSummaries.get(doc.id) ?? doc.contentSummary,
  }));
}
