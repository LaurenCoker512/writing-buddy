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

const UNIFIED_SYSTEM_PROMPT = `You are an AI writing assistant helping a writer develop their story documents. First determine whether the user's message is requesting a document edit or asking a question/discussing the document.

Be proactive and confident. Use the document content, your knowledge of the source material (for fanfic or adaptation work), and reasonable creative judgment to complete tasks directly — do not ask clarifying questions when you have enough to work with. If the document provides context, treat it as sufficient. Make your best attempt and the writer can refine from there.

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

  const additionalDocsMarkdown = additionalDocs
    .map((d) => tiptapToMarkdown(d.tiptapJson as TipTapNode))
    .filter((md) => md.length > 0)
    .join("\n\n---\n\n");

  const tiptapDoc = document.tiptapJson as TipTapDoc;
  const documentMarkdown = tiptapToMarkdown(tiptapDoc as TipTapNode);

  const dbMessages = await prisma.chatMessage.findMany({
    where: { documentId: body.documentId },
    orderBy: { createdAt: "asc" },
  });

  const chatMessages: ChatMessage[] = dbMessages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  const { recentMessages } = buildTier1Context(document.tiptapJson as TipTapNode, chatMessages);

  let userMessage = `Document:\n${documentMarkdown || "(empty document)"}`;
  if (additionalDocsMarkdown) {
    userMessage += `\n\nAdditional context documents:\n\n${additionalDocsMarkdown}`;
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
