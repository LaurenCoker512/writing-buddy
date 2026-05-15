import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  buildTier1Context,
  buildSystemPrompt,
  buildTier2Context,
  buildCanonContext,
} from "@/lib/ai-context";
import type { ChatMessage } from "@/lib/ai-context";
import { tiptapToMarkdown } from "@/lib/tiptap-to-markdown";
import type { TipTapNode } from "@/lib/tiptap-to-markdown";
import { getSectionMarkdown } from "@/lib/section-utils";
import type { TipTapDoc } from "@/lib/section-utils";
import type { DiffProposal } from "@/types/diff";
import { AI_CONFIG } from "@/config/ai";
import { shouldPruneChatMessages } from "@/lib/chat-pruning";
import { ensureContentSummariesFresh } from "@/lib/content-summary";
import { resolveProviderForUser, stripJsonFences } from "@/lib/ai-provider";
import type { ProviderAdapter } from "@/lib/ai-provider";
import { findOwnedDocument } from "@/lib/db-helpers";

const DIFF_SYSTEM_PROMPT = `You are an AI writing assistant that proposes document edits.
Given a document and an edit instruction, return ONLY valid JSON (no markdown fences, no explanation) in this exact format:
{
  "proposals": [
    {
      "heading": "Exact Section Heading",
      "headingLevel": 2,
      "newMarkdown": "## Exact Section Heading\\n\\nReplacement content here.",
      "isNew": false
    }
  ]
}

For new sections (to be appended to the document end), use null for heading and isNew: true:
{
  "heading": null,
  "headingLevel": 2,
  "newMarkdown": "## New Section Name\\n\\nNew content here.",
  "isNew": true
}

Rules:
- Only propose changes that address the instruction
- The "heading" must exactly match a heading in the document (case-sensitive), or null for new sections
- Always include the heading line in "newMarkdown"
- Preserve content in the section you are not asked to change
- Return valid JSON only — no other text`;

interface AiDiffItem {
  heading: unknown;
  headingLevel: unknown;
  newMarkdown: unknown;
  isNew: unknown;
}

interface AiDiffResponse {
  proposals?: AiDiffItem[];
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

  const body = (await req.json()) as {
    documentId?: unknown;
    content?: unknown;
    additionalDocumentIds?: unknown;
    responseType?: unknown;
  };

  if (
    typeof body.documentId !== "string" ||
    typeof body.content !== "string" ||
    !Array.isArray(body.additionalDocumentIds) ||
    (body.responseType !== "chat" && body.responseType !== "edit")
  ) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (body.content.length > AI_CONFIG.MAX_CHAT_CONTENT_LENGTH) {
    return NextResponse.json({ error: "Message too long" }, { status: 400 });
  }

  const document = await findOwnedDocument(body.documentId, session.user.id);
  if (!document) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const owner = (document.story ?? document.series ?? document.universe)!;

  const [providerResult, userSettings] = await Promise.all([
    resolveProviderForUser(session.user.id),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { explicitEnabled: true } }),
  ]);

  if (!providerResult.ok) {
    return NextResponse.json(
      { error: providerResult.error, message: providerResult.message },
      { status: 402 },
    );
  }

  const { provider } = providerResult;

  // Fetch additional context docs — silently exclude any not owned by this user
  const additionalDocIds = body.additionalDocumentIds.filter(
    (id): id is string => typeof id === "string",
  );

  const additionalDocs =
    additionalDocIds.length > 0
      ? await Promise.all(
          additionalDocIds.map((id) => findOwnedDocument(id, session.user.id)),
        ).then((docs) => docs.filter((d) => d !== null))
      : [];

  const additionalDocsMarkdown = additionalDocs
    .map((d) => tiptapToMarkdown(d.tiptapJson as TipTapNode))
    .filter((md) => md.length > 0)
    .join("\n\n---\n\n");

  const tiptapDoc = document.tiptapJson as TipTapDoc;

  if (body.responseType === "edit") {
    const documentMarkdown = tiptapToMarkdown(tiptapDoc as TipTapNode);

    let userMessage = `Document:\n${documentMarkdown || "(empty document)"}`;
    if (additionalDocsMarkdown) {
      userMessage += `\n\nAdditional context documents:\n\n${additionalDocsMarkdown}`;
    }
    userMessage += `\n\nEdit instruction: ${body.content}`;

    let rawContent: string;
    try {
      rawContent = await provider.completeChat(
        [{ role: "user", content: userMessage }],
        DIFF_SYSTEM_PROMPT,
      );
    } catch {
      return NextResponse.json({ error: "AI provider error" }, { status: 502 });
    }

    let parsed: AiDiffResponse;
    try {
      parsed = JSON.parse(stripJsonFences(rawContent)) as AiDiffResponse;
    } catch {
      return NextResponse.json({ error: "Failed to parse AI response" }, { status: 502 });
    }

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

    return NextResponse.json({ proposals });
  }

  // responseType === "chat"
  const dbMessages = await prisma.chatMessage.findMany({
    where: { documentId: body.documentId },
    orderBy: { createdAt: "asc" },
  });

  const chatMessages: ChatMessage[] = dbMessages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  const siblingWhere = document.storyId
    ? { storyId: document.storyId }
    : document.seriesId
      ? { seriesId: document.seriesId }
      : document.universeId
        ? { universeId: document.universeId }
        : null;

  const freshSiblings =
    siblingWhere !== null
      ? await ensureContentSummariesFresh(
          await prisma.document
            .findMany({
              where: { ...siblingWhere, id: { not: document.id } },
              select: { id: true },
            })
            .then((docs) => docs.map((d) => d.id)),
          provider,
        )
      : [];

  const structuredSiblings = freshSiblings.filter((s) => s.type !== "BRAINSTORM");
  const tier2Context = buildTier2Context(structuredSiblings, document.type);

  let canonContext: string | null = null;
  if (owner.mode === "FANFIC") {
    let universeId: string | null = document.universeId ?? null;
    if (!universeId && document.storyId) {
      const story = await prisma.story.findUnique({
        where: { id: document.storyId },
        select: { universeId: true },
      });
      universeId = story?.universeId ?? null;
    }
    if (!universeId && document.seriesId) {
      const series = await prisma.series.findUnique({
        where: { id: document.seriesId },
        select: { universeId: true },
      });
      universeId = series?.universeId ?? null;
    }

    if (universeId) {
      const universeDocs = await prisma.document.findMany({
        where: { universeId },
        select: { id: true, meta: true },
      });
      const canonDocIds = universeDocs
        .filter((d) => {
          if (typeof d.meta !== "object" || d.meta === null || Array.isArray(d.meta)) return false;
          return (d.meta as Record<string, unknown>).isCanon === true;
        })
        .map((d) => d.id);

      if (canonDocIds.length > 0) {
        const freshCanonDocs = await ensureContentSummariesFresh(canonDocIds, provider);
        const ctx = buildCanonContext(freshCanonDocs);
        if (ctx) canonContext = ctx;
      }
    }
  }

  const { documentMarkdown, recentMessages } = buildTier1Context(
    document.tiptapJson as TipTapNode,
    chatMessages,
  );

  let systemPrompt = buildSystemPrompt(
    documentMarkdown,
    owner.mode,
    owner.rating,
    document.chatSummary,
    tier2Context || null,
    canonContext,
    userSettings?.explicitEnabled ?? false,
    document.type,
  );

  if (additionalDocsMarkdown) {
    systemPrompt += `\n\nAdditional context documents:\n\n${additionalDocsMarkdown}`;
  }

  let providerStream: ReadableStream<Uint8Array>;
  try {
    providerStream = await provider.streamChat(
      [...recentMessages, { role: "user" as const, content: body.content }],
      systemPrompt,
    );
  } catch {
    return NextResponse.json({ error: "AI provider error" }, { status: 502 });
  }

  const documentId = body.documentId;
  const userContent = body.content;
  const decoder = new TextDecoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = providerStream.getReader();
      let assistantContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        for (const line of text.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;
          try {
            const parsed = JSON.parse(data) as {
              choices?: Array<{ delta?: { content?: string } }>;
            };
            assistantContent += parsed.choices?.[0]?.delta?.content ?? "";
          } catch {
            // ignore malformed SSE lines
          }
        }

        controller.enqueue(value);
      }

      try {
        await prisma.chatMessage.createMany({
          data: [
            { documentId, role: "user", content: userContent },
            { documentId, role: "assistant", content: assistantContent },
          ],
        });

        const count = await prisma.chatMessage.count({ where: { documentId } });
        if (shouldPruneChatMessages(count)) {
          await pruneMessages(documentId, provider);
        }
      } catch (err) {
        console.error("[collab] Failed to persist messages after stream:", err);
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
