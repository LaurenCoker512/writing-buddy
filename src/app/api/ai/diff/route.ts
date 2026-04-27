import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

import { tiptapToMarkdown } from "@/lib/tiptap-to-markdown";
import { getSectionMarkdown } from "@/lib/section-utils";
import type { TipTapNode } from "@/lib/tiptap-to-markdown";
import type { TipTapDoc } from "@/lib/section-utils";
import type { DiffProposal } from "@/types/diff";
import { resolveProviderForUser, stripJsonFences } from "@/lib/ai-provider";
import { findOwnedDocument } from "@/lib/db-helpers";

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

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as { documentId?: unknown; instruction?: unknown };

  if (typeof body.documentId !== "string" || typeof body.instruction !== "string") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const document = await findOwnedDocument(body.documentId, session.user.id);
  if (!document) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const providerResult = await resolveProviderForUser(session.user.id);
  if (!providerResult.ok) {
    return NextResponse.json(
      { error: providerResult.error, message: providerResult.message },
      { status: 402 },
    );
  }

  const { provider } = providerResult;

  const tiptapDoc = document.tiptapJson as TipTapDoc;
  const documentMarkdown = tiptapToMarkdown(tiptapDoc as TipTapNode);

  const userMessage = `Document:\n${documentMarkdown || "(empty document)"}\n\nEdit instruction: ${body.instruction}`;

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
