import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { decryptApiKey } from "@/lib/encryption";
import { buildTier1Context, buildSystemPrompt } from "@/lib/ai-context";
import type { ChatMessage } from "@/lib/ai-context";
import type { TipTapNode } from "@/lib/tiptap-to-markdown";
import { AI_CONFIG } from "@/config/ai";
import { shouldPruneChatMessages } from "@/lib/chat-pruning";

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

async function pruneMessages(documentId: string, apiKey: string): Promise<void> {
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
      messages: [{ role: "user", content: summaryPrompt }],
    }),
  });

  if (!res.ok) return;

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const newSummary = data.choices?.[0]?.message?.content ?? previousSummary;

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
    select: { openRouterKey: true },
  });

  if (!user?.openRouterKey) {
    return NextResponse.json(
      {
        error: "no_api_key",
        message: "Add your OpenRouter API key in Settings to use AI features.",
      },
      { status: 402 },
    );
  }

  let apiKey: string;
  try {
    apiKey = decryptApiKey(user.openRouterKey);
  } catch {
    return NextResponse.json({ error: "Failed to decrypt API key" }, { status: 500 });
  }

  const dbMessages = await prisma.chatMessage.findMany({
    where: { documentId: body.documentId },
    orderBy: { createdAt: "asc" },
  });

  const chatMessages: ChatMessage[] = dbMessages.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  const { documentMarkdown, recentMessages } = buildTier1Context(
    document.tiptapJson as TipTapNode,
    chatMessages,
  );

  const systemPrompt = buildSystemPrompt(
    documentMarkdown,
    owner.mode,
    owner.rating,
    document.chatSummary,
  );

  const openRouterResponse = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://writing-buddy.app",
        "X-Title": "Writing Buddy",
      },
      body: JSON.stringify({
        model: AI_CONFIG.OPENROUTER_DEFAULT_MODEL,
        stream: true,
        messages: [
          { role: "system", content: systemPrompt },
          ...recentMessages,
          { role: "user", content: body.content },
        ],
      }),
    },
  );

  if (!openRouterResponse.ok) {
    const errorText = await openRouterResponse.text();
    return NextResponse.json(
      { error: "OpenRouter API error", details: errorText },
      { status: 502 },
    );
  }

  if (!openRouterResponse.body) {
    return NextResponse.json({ error: "No response body" }, { status: 502 });
  }

  const documentId = body.documentId;
  const userContent = body.content;
  const decoder = new TextDecoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = openRouterResponse.body!.getReader();
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
        await pruneMessages(documentId, apiKey);
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
