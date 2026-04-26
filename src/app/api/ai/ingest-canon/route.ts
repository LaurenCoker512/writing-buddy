import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { decryptApiKey } from "@/lib/encryption";
import { AI_CONFIG } from "@/config/ai";
import type { CanonProposal } from "@/types/diff";

interface AiCanonItem {
  documentName: unknown;
  documentType: unknown;
  markdown: unknown;
}

interface AiCanonResponse {
  proposals?: AiCanonItem[];
}

const INGEST_CANON_SYSTEM_PROMPT = `You are an AI writing assistant helping organize fanfiction source material.
Given raw source text (wiki pages, bios, character descriptions, world info), organize it into structured CHARACTER and WORLDBUILDING documents.

Return ONLY valid JSON (no markdown fences, no explanation) in this exact format:
{
  "proposals": [
    {
      "documentName": "Character Name",
      "documentType": "CHARACTER",
      "markdown": "## Overview\\n\\nDescription of the character.\\n\\n## Relationships\\n\\nKey relationships."
    },
    {
      "documentName": "Location Name",
      "documentType": "WORLDBUILDING",
      "markdown": "## Overview\\n\\nDescription of the location."
    }
  ]
}

Rules:
- Create one entry per distinct character mentioned in the source text
- Create one entry per distinct worldbuilding element (location, organization, magic system, history, etc.)
- Use CHARACTER for people and beings
- Use WORLDBUILDING for places, organizations, systems, history, and other non-character elements
- Each document should begin with a ## Overview section
- Keep content factual to the source material — do not invent details
- Return valid JSON only — no other text`;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as { universeId?: unknown; sourceText?: unknown };

  if (typeof body.universeId !== "string" || typeof body.sourceText !== "string") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (body.sourceText.trim().length === 0) {
    return NextResponse.json({ error: "Source text is required" }, { status: 400 });
  }

  const universe = await prisma.universe.findFirst({
    where: { id: body.universeId, userId: session.user.id },
  });
  if (!universe) {
    return NextResponse.json({ error: "Universe not found" }, { status: 404 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { openRouterKey: true },
  });

  if (!user?.openRouterKey) {
    return NextResponse.json(
      { error: "no_api_key", message: "Add your OpenRouter API key in Settings to use AI features." },
      { status: 402 },
    );
  }

  let apiKey: string;
  try {
    apiKey = decryptApiKey(user.openRouterKey);
  } catch {
    return NextResponse.json({ error: "Failed to decrypt API key" }, { status: 500 });
  }

  const openRouterResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
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
      messages: [
        { role: "system", content: INGEST_CANON_SYSTEM_PROMPT },
        { role: "user", content: `Source text:\n\n${body.sourceText}` },
      ],
    }),
  });

  if (!openRouterResponse.ok) {
    const errorText = await openRouterResponse.text();
    return NextResponse.json(
      { error: "OpenRouter API error", details: errorText },
      { status: 502 },
    );
  }

  const aiData = (await openRouterResponse.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const rawContent = aiData.choices?.[0]?.message?.content ?? "";

  let parsed: AiCanonResponse;
  try {
    parsed = JSON.parse(rawContent) as AiCanonResponse;
  } catch {
    return NextResponse.json({ error: "Failed to parse AI response" }, { status: 502 });
  }

  const rawProposals = Array.isArray(parsed.proposals) ? parsed.proposals : [];

  const proposals: CanonProposal[] = rawProposals
    .filter(
      (p): p is AiCanonItem & { documentName: string; documentType: string; markdown: string } =>
        typeof p.documentName === "string" &&
        p.documentName.trim().length > 0 &&
        typeof p.markdown === "string" &&
        p.markdown.trim().length > 0 &&
        (p.documentType === "CHARACTER" || p.documentType === "WORLDBUILDING"),
    )
    .map((p) => ({
      id: crypto.randomUUID(),
      documentName: p.documentName.trim(),
      documentType: p.documentType as "CHARACTER" | "WORLDBUILDING",
      markdown: p.markdown,
    }));

  return NextResponse.json({ proposals });
}
