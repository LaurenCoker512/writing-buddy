import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { buildTier1Context } from "@/lib/ai-context";
import type { ChatMessage } from "@/lib/ai-context";
import { tiptapToMarkdown } from "@/lib/tiptap-to-markdown";
import type { TipTapNode } from "@/lib/tiptap-to-markdown";
import { getSectionMarkdown } from "@/lib/section-utils";
import type { TipTapDoc } from "@/lib/section-utils";
import type { DiffProposal } from "@/types/diff";
import { AI_CONFIG } from "@/config/ai";
import { shouldPruneChatMessages } from "@/lib/chat-pruning";
import { resolveProviderForUser, stripJsonFences } from "@/lib/ai-provider";
import type { ProviderAdapter } from "@/lib/ai-provider";
import { findOwnedDocument } from "@/lib/db-helpers";
import { DOCUMENT_TYPE_LABELS } from "@/lib/documents";
import type { DocumentTypeValue } from "@/lib/documents";

const UNIFIED_SYSTEM_PROMPT = `You are an AI writing assistant helping a writer develop their story documents. First determine whether the user's message is requesting a document edit or asking a question/discussing the document.

Be proactive and confident. Use the document content, your knowledge of the source material (for fanfic or adaptation work), and reasonable creative judgment to complete tasks directly — do not ask clarifying questions when you have enough to work with. If the document provides context, treat it as sufficient. Make your best attempt and the writer can refine from there.

Documents exist at three scope levels, from most specific to most general: Story → Series → Universe. When context documents from multiple scopes are provided, give higher precedence to the more specific (lower) scope. A Story-level document overrides a Series-level document, which overrides a Universe-level document. This is intentional: the writer may be using a fanfic universe with established canon at the Universe level, adapting that canon at the Series level, and then making story-specific choices at the Story level. Always prefer the most specific version available when there are conflicts.

Return ONLY valid JSON (no markdown fences, no explanation) in one of these two formats:

For edit instructions (adding, modifying, rewriting, or removing content in the document):
{
  "intent": "edit",
  "proposals": [
    {
      "heading": "Exact Section Heading",
      "headingLevel": 2,
      "newMarkdown": "## Exact Section Heading\\n\\nReplacement content here.",
      "isNew": false
    }
  ]
}

For new sections to append to the document end, use null for heading and isNew: true:
  { "heading": null, "headingLevel": 2, "newMarkdown": "## New Section Name\\n\\nNew content here.", "isNew": true }

For questions, feedback requests, or general discussion:
{
  "intent": "chat",
  "message": "Your response here."
}

Edit rules:
- Only propose changes that address the instruction
- "heading" must exactly match a heading in the document (case-sensitive), or null for new sections
- Always include the heading line in "newMarkdown"
- Preserve content in sections you are not asked to change

Return valid JSON only — no other text.`;

type ScopedDoc = Awaited<ReturnType<typeof findOwnedDocument>> & object;

function documentScopeLabel(doc: { storyId: string | null; seriesId: string | null }): "Story" | "Series" | "Universe" {
  if (doc.storyId !== null) return "Story";
  if (doc.seriesId !== null) return "Series";
  return "Universe";
}

function documentTypeLabel(type: string): string {
  return DOCUMENT_TYPE_LABELS[type as DocumentTypeValue] ?? type;
}

function formatContextDoc(doc: ScopedDoc): string {
  const scope = documentScopeLabel(doc);
  const typeLabel = documentTypeLabel(doc.type);
  const markdown = tiptapToMarkdown(doc.tiptapJson as TipTapNode);
  return `[${scope}-level ${typeLabel}] ${doc.name}\n\n${markdown}`;
}

interface AiDiffItem {
  heading: unknown;
  headingLevel: unknown;
  newMarkdown: unknown;
  isNew: unknown;
}

interface AiUnifiedResponse {
  intent: unknown;
  proposals?: AiDiffItem[];
  message?: unknown;
}

async function pruneMessages(documentId: string, provider: ProviderAdapter): Promise<void> {
  const oldest = await prisma.chatMessage.findMany({
    where: { documentId },
    orderBy: { createdAt: "asc" },
    take: AI_CONFIG.CHAT_SUMMARIZE_BATCH,
  });

  if (oldest.length === 0) return;

  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: { chatSummary: true },
  });

  const previousSummary = document?.chatSummary ?? "";
  const messageText = oldest
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n\n");

  const summaryPrompt = previousSummary
    ? `You are summarizing a conversation. Update the existing summary with new messages.\n\nExisting summary:\n${previousSummary}\n\nNew messages to incorporate:\n${messageText}\n\nProvide an updated concise summary:`
    : `Summarize this conversation concisely, capturing key points and decisions:\n\n${messageText}\n\nSummary:`;

  let newSummary: string;
  try {
    newSummary = await provider.completeChat([{ role: "user", content: summaryPrompt }], "");
  } catch {
    return;
  }

  if (!newSummary) return;

  await prisma.$transaction([
    prisma.document.update({
      where: { id: documentId },
      data: { chatSummary: newSummary },
    }),
    prisma.chatMessage.deleteMany({
      where: { id: { in: oldest.map((m) => m.id) } },
    }),
  ]);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  const body = (await req.json()) as {
    documentId?: unknown;
    content?: unknown;
    additionalDocumentIds?: unknown;
  };

  if (
    typeof body.documentId !== "string" ||
    typeof body.content !== "string" ||
    !Array.isArray(body.additionalDocumentIds)
  ) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (body.content.length > AI_CONFIG.MAX_CHAT_CONTENT_LENGTH) {
    return NextResponse.json({ error: "Message too long" }, { status: 400 });
  }

  const document = await findOwnedDocument(body.documentId, userId);
  if (!document) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const providerResult = await resolveProviderForUser(userId);
  if (!providerResult.ok) {
    return NextResponse.json(
      { error: providerResult.error, message: providerResult.message },
      { status: 402 },
    );
  }

  const { provider } = providerResult;

  const additionalDocIds = body.additionalDocumentIds.filter(
    (id): id is string => typeof id === "string",
  );

  const additionalDocs =
    additionalDocIds.length > 0
      ? await Promise.all(
          additionalDocIds.map((id) => findOwnedDocument(id, userId)),
        ).then((docs) => docs.filter((d) => d !== null))
      : [];

  // For SCENE documents, automatically include the story's Plot doc as context.
  if (document.type === "SCENE" && document.storyId !== null) {
    const plotDoc = await prisma.document.findFirst({
      where: {
        storyId: document.storyId,
        type: "PLOT",
        id: { notIn: additionalDocIds },
      },
    });
    if (plotDoc !== null) {
      additionalDocs.unshift(plotDoc as Awaited<ReturnType<typeof findOwnedDocument>> & object);
    }
  }

  const additionalDocsMarkdown = additionalDocs
    .map((d) => formatContextDoc(d as ScopedDoc))
    .filter((md) => md.length > 0)
    .join("\n\n---\n\n");

  const tiptapDoc = document.tiptapJson as TipTapDoc;
  const documentMarkdown = tiptapToMarkdown(tiptapDoc as TipTapNode);
  const primaryScope = documentScopeLabel(document);
  const primaryTypeLabel = documentTypeLabel(document.type);

  const dbMessages = await prisma.chatMessage.findMany({
    where: { documentId: body.documentId },
    orderBy: { createdAt: "asc" },
  });

  const chatMessages: ChatMessage[] = dbMessages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  const { recentMessages } = buildTier1Context(document.tiptapJson as TipTapNode, chatMessages);

  let userMessage = `You are working on a ${primaryScope}-level ${primaryTypeLabel} document titled "${document.name}".\n\nDocument:\n${documentMarkdown || "(empty document)"}`;
  if (additionalDocsMarkdown) {
    userMessage += `\n\nAdditional context documents (each labeled with its scope level):\n\n${additionalDocsMarkdown}`;
  }
  userMessage += `\n\nMessage: ${body.content}`;

  let rawContent: string;
  try {
    rawContent = await provider.completeChat(
      [...recentMessages, { role: "user", content: userMessage }],
      UNIFIED_SYSTEM_PROMPT,
    );
  } catch {
    return NextResponse.json({ error: "AI provider error" }, { status: 502 });
  }

  let parsed: AiUnifiedResponse;
  try {
    parsed = JSON.parse(stripJsonFences(rawContent)) as AiUnifiedResponse;
  } catch {
    return NextResponse.json({ error: "Failed to parse AI response" }, { status: 502 });
  }

  const documentId = body.documentId;
  const userContent = body.content;

  if (parsed.intent === "edit") {
    const rawProposals = Array.isArray(parsed.proposals) ? parsed.proposals : [];

    const proposals: DiffProposal[] = rawProposals
      .filter(
        (p): p is AiDiffItem & { newMarkdown: string } =>
          typeof p.newMarkdown === "string" && p.newMarkdown.length > 0,
      )
      .map((p) => {
        const heading = typeof p.heading === "string" ? p.heading : null;
        const isNew = p.isNew === true || heading === null;
        const beforeMarkdown =
          !isNew && heading !== null ? getSectionMarkdown(tiptapDoc, heading) : "";

        return {
          id: crypto.randomUUID(),
          heading,
          headingLevel: typeof p.headingLevel === "number" ? p.headingLevel : 2,
          beforeMarkdown,
          newMarkdown: p.newMarkdown,
          isNew,
        };
      });

    return NextResponse.json({ intent: "edit", proposals });
  }

  if (parsed.intent === "chat" && typeof parsed.message === "string") {
    try {
      await prisma.chatMessage.createMany({
        data: [
          { documentId, role: "user", content: userContent },
          { documentId, role: "assistant", content: parsed.message },
        ],
      });

      const count = await prisma.chatMessage.count({ where: { documentId } });
      if (shouldPruneChatMessages(count)) {
        await pruneMessages(documentId, provider);
      }
    } catch (err) {
      console.error("[collab] Failed to persist messages:", err);
    }

    return NextResponse.json({ intent: "chat", message: parsed.message });
  }

  return NextResponse.json({ error: "Unexpected AI response format" }, { status: 502 });
}
