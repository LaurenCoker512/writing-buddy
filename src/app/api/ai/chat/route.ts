import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { buildTier1Context, buildSystemPrompt, buildTier2Context, buildCanonContext } from "@/lib/ai-context";
import type { ChatMessage } from "@/lib/ai-context";
import type { TipTapNode } from "@/lib/tiptap-to-markdown";
import { AI_CONFIG } from "@/config/ai";
import { shouldPruneChatMessages } from "@/lib/chat-pruning";
import { ensureContentSummariesFresh } from "@/lib/content-summary";
import { resolveAiProvider } from "@/lib/ai-provider";
import type { ProviderAdapter } from "@/lib/ai-provider";

async function findOwnedDocument(id: string, userId: string) {
  const document = await prisma.document.findFirst({
    where: { id },
    include: {
      story: { select: { userId: true, mode: true, rating: true } },
      series: { select: { userId: true, mode: true, rating: true } },
      universe: { select: { userId: true, mode: true, rating: true } },
    },
  });
  if (!document) return null;

  const owner = document.story ?? document.series ?? document.universe;
  if (!owner || owner.userId !== userId) return null;

  return { document, owner };
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
  };

  if (typeof body.documentId !== "string" || typeof body.content !== "string") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const result = await findOwnedDocument(body.documentId, session.user.id);
  if (!result) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { document, owner } = result;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { openRouterKey: true, anthropicKey: true, aiProvider: true, explicitEnabled: true },
  });

  const providerResult = resolveAiProvider(user ?? { openRouterKey: null, anthropicKey: null, aiProvider: null });
  if (!providerResult.ok) {
    return NextResponse.json(
      { error: providerResult.error, message: providerResult.message },
      { status: 402 },
    );
  }

  const { provider } = providerResult;

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

  const tier2Context = buildTier2Context(freshSiblings, document.type);

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

  const systemPrompt = buildSystemPrompt(
    documentMarkdown,
    owner.mode,
    owner.rating,
    document.chatSummary,
    tier2Context || null,
    canonContext,
    user?.explicitEnabled ?? false,
  );

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
