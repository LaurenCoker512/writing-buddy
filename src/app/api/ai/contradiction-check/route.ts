import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { tiptapToMarkdown } from "@/lib/tiptap-to-markdown";
import type { TipTapNode } from "@/lib/tiptap-to-markdown";
import { estimateContradictionTokens } from "@/lib/contradiction";
import { resolveAiProvider } from "@/lib/ai-provider";

interface AiIssueRaw {
  description: unknown;
  documentsInvolved: unknown;
  suggestedResolution: unknown;
}

interface AiContradictionResponse {
  issues?: AiIssueRaw[];
}

export interface ContradictionIssue {
  description: string;
  documentsInvolved: string[];
  suggestedResolution: string;
}

const CONTRADICTION_SYSTEM_PROMPT = `You are an AI writing assistant that checks for contradictions and inconsistencies in a story's documents.

Given a collection of story documents, identify contradictions or inconsistencies between them. Return ONLY valid JSON (no markdown fences, no explanation) in this exact format:
{
  "issues": [
    {
      "description": "Brief description of the contradiction or inconsistency",
      "documentsInvolved": ["Document Name 1", "Document Name 2"],
      "suggestedResolution": "A suggestion for how to resolve this inconsistency"
    }
  ]
}

Rules:
- Only flag genuine contradictions where two documents directly contradict each other
- Do not flag intentional tension or unresolved mystery
- If no contradictions are found, return { "issues": [] }
- Return valid JSON only — no other text`;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as { storyId?: unknown; estimateOnly?: unknown };

  if (typeof body.storyId !== "string") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const story = await prisma.story.findFirst({
    where: { id: body.storyId, userId: session.user.id },
    select: { id: true },
  });

  if (!story) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const documents = await prisma.document.findMany({
    where: { storyId: body.storyId },
    select: { id: true, name: true, type: true, tiptapJson: true, contentSummary: true },
  });

  const docTexts = documents.map((doc) => {
    const markdown = tiptapToMarkdown(doc.tiptapJson as TipTapNode);
    const content = markdown.length > 2000 && doc.contentSummary ? doc.contentSummary : markdown;
    return { name: doc.name, type: doc.type, content };
  });

  const tokenEstimate = estimateContradictionTokens(docTexts);

  if (body.estimateOnly === true) {
    return NextResponse.json({ tokenEstimate });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { openRouterKey: true, anthropicKey: true, aiProvider: true },
  });

  const providerResult = resolveAiProvider(user ?? { openRouterKey: null, anthropicKey: null, aiProvider: null });
  if (!providerResult.ok) {
    return NextResponse.json(
      { error: providerResult.error, message: providerResult.message },
      { status: 402 },
    );
  }

  const { provider } = providerResult;

  const userMessage =
    docTexts.length === 0
      ? "This story has no documents yet."
      : docTexts.map((d) => `### ${d.name} (${d.type})\n${d.content}`).join("\n\n");

  let rawContent: string;
  try {
    rawContent = await provider.completeChat(
      [{ role: "user", content: userMessage }],
      CONTRADICTION_SYSTEM_PROMPT,
    );
  } catch {
    return NextResponse.json({ error: "AI provider error" }, { status: 502 });
  }

  let parsed: AiContradictionResponse;
  try {
    parsed = JSON.parse(rawContent) as AiContradictionResponse;
  } catch {
    return NextResponse.json({ error: "Failed to parse AI response" }, { status: 502 });
  }

  const rawIssues = Array.isArray(parsed.issues) ? parsed.issues : [];

  const issues: ContradictionIssue[] = rawIssues
    .filter(
      (issue): issue is AiIssueRaw & { description: string; suggestedResolution: string } =>
        typeof issue.description === "string" && typeof issue.suggestedResolution === "string",
    )
    .map((issue) => ({
      description: issue.description,
      documentsInvolved: Array.isArray(issue.documentsInvolved)
        ? (issue.documentsInvolved as unknown[]).filter((d): d is string => typeof d === "string")
        : [],
      suggestedResolution: issue.suggestedResolution,
    }));

  return NextResponse.json({ tokenEstimate, issues });
}
