import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { resolveProviderForUser, stripJsonFences } from "@/lib/ai-provider";
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

  if (body.sourceText.length > AI_CONFIG.MAX_SOURCE_TEXT_LENGTH) {
    return NextResponse.json({ error: "Source text too long" }, { status: 400 });
  }

  const universe = await prisma.universe.findFirst({
    where: { id: body.universeId, userId: session.user.id },
  });
  if (!universe) {
    return NextResponse.json({ error: "Universe not found" }, { status: 404 });
  }

  const providerResult = await resolveProviderForUser(session.user.id);
  if (!providerResult.ok) {
    return NextResponse.json(
      { error: providerResult.error, message: providerResult.message },
      { status: 402 },
    );
  }

  const { provider } = providerResult;

  let rawContent: string;
  try {
    rawContent = await provider.completeChat(
      [{ role: "user", content: `Source text:\n\n${body.sourceText}` }],
      INGEST_CANON_SYSTEM_PROMPT,
    );
  } catch {
    return NextResponse.json({ error: "AI provider error" }, { status: 502 });
  }

  let parsed: AiCanonResponse;
  try {
    parsed = JSON.parse(stripJsonFences(rawContent)) as AiCanonResponse;
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
