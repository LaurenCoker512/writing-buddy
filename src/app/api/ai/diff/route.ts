import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { decryptApiKey } from "@/lib/encryption";
import { tiptapToMarkdown } from "@/lib/tiptap-to-markdown";
import { getSectionMarkdown } from "@/lib/section-utils";
import type { TipTapNode } from "@/lib/tiptap-to-markdown";
import type { TipTapDoc } from "@/lib/section-utils";
import type { DiffProposal } from "@/types/diff";
import { AI_CONFIG } from "@/config/ai";

interface AiDiffItem {
  heading: unknown;
  headingLevel: unknown;
  newMarkdown: unknown;
  isNew: unknown;
}

interface AiDiffResponse {
  proposals?: AiDiffItem[];
}

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

  const body = (await req.json()) as { documentId?: unknown; instruction?: unknown };

  if (typeof body.documentId !== "string" || typeof body.instruction !== "string") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const result = await findOwnedDocument(body.documentId, session.user.id);
  if (!result) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { document } = result;

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

  const tiptapDoc = document.tiptapJson as TipTapDoc;
  const documentMarkdown = tiptapToMarkdown(tiptapDoc as TipTapNode);

  const userMessage = `Document:\n${documentMarkdown || "(empty document)"}\n\nEdit instruction: ${body.instruction}`;

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
        { role: "system", content: DIFF_SYSTEM_PROMPT },
        { role: "user", content: userMessage },
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

  let parsed: AiDiffResponse;
  try {
    parsed = JSON.parse(rawContent) as AiDiffResponse;
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
