import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { tiptapToMarkdown } from "@/lib/tiptap-to-markdown";
import { getSectionMarkdown } from "@/lib/section-utils";
import type { TipTapNode } from "@/lib/tiptap-to-markdown";
import type { TipTapDoc } from "@/lib/section-utils";
import type { DiffProposal } from "@/types/diff";
import { resolveAiProvider, stripJsonFences } from "@/lib/ai-provider";

interface AiDiffItem {
  heading: unknown;
  headingLevel: unknown;
  newMarkdown: unknown;
  isNew: unknown;
}

interface AiDiffResponse {
  proposals?: AiDiffItem[];
}

const PREPOPULATE_SYSTEM_PROMPT = `You are an AI writing assistant that populates character documents from source material.
Given a character document template and source material, return ONLY valid JSON (no markdown fences, no explanation) in this exact format:
{
  "proposals": [
    {
      "heading": "Exact Section Heading",
      "headingLevel": 2,
      "newMarkdown": "## Exact Section Heading\\n\\nContent here.",
      "isNew": false
    }
  ]
}

Rules:
- Populate each section of the character document using relevant facts from the source material
- The "heading" must exactly match a heading in the document (case-sensitive), or null for new sections
- Always include the heading line in "newMarkdown"
- Stay faithful to the source material — do not invent details not present in the source
- Return valid JSON only — no other text`;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as { documentId?: unknown; sourceText?: unknown };

  if (typeof body.documentId !== "string" || typeof body.sourceText !== "string") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (body.sourceText.trim().length === 0) {
    return NextResponse.json({ error: "Source text is required" }, { status: 400 });
  }

  const document = await prisma.document.findFirst({
    where: { id: body.documentId },
    include: {
      story: { select: { userId: true } },
      series: { select: { userId: true } },
      universe: { select: { userId: true } },
    },
  });

  if (!document) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const owner = document.story ?? document.series ?? document.universe;
  if (!owner || owner.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { openRouterKey: true, anthropicKey: true, aiProvider: true, anthropicModel: true },
  });

  const providerResult = resolveAiProvider(user ?? { openRouterKey: null, anthropicKey: null, aiProvider: null });
  if (!providerResult.ok) {
    return NextResponse.json(
      { error: providerResult.error, message: providerResult.message },
      { status: 402 },
    );
  }

  const { provider } = providerResult;

  const tiptapDoc = document.tiptapJson as TipTapDoc;
  const documentMarkdown = tiptapToMarkdown(tiptapDoc as TipTapNode);

  const userMessage = `Character document:\n${documentMarkdown || "(empty document)"}\n\nSource material:\n${body.sourceText}`;

  let rawContent: string;
  try {
    rawContent = await provider.completeChat(
      [{ role: "user", content: userMessage }],
      PREPOPULATE_SYSTEM_PROMPT,
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
