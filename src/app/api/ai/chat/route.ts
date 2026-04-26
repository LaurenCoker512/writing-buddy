import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { decryptApiKey } from "@/lib/encryption";
import { buildTier1Context, buildSystemPrompt } from "@/lib/ai-context";
import type { ChatMessage } from "@/lib/ai-context";
import type { TipTapNode } from "@/lib/tiptap-to-markdown";
import { AI_CONFIG } from "@/config/ai";

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

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as {
    documentId?: unknown;
    content?: unknown;
    messages?: unknown;
  };

  if (typeof body.documentId !== "string" || typeof body.content !== "string") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const messages: ChatMessage[] = Array.isArray(body.messages)
    ? (body.messages as Array<{ role?: unknown; content?: unknown }>).filter(
        (m): m is ChatMessage =>
          (m.role === "user" || m.role === "assistant") &&
          typeof m.content === "string",
      )
    : [];

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

  const { documentMarkdown, recentMessages } = buildTier1Context(
    document.tiptapJson as TipTapNode,
    messages,
  );

  const systemPrompt = buildSystemPrompt(documentMarkdown, owner.mode, owner.rating);

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

  return new Response(openRouterResponse.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
