import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { decryptApiKey } from "@/lib/encryption";
import { tiptapToMarkdown } from "@/lib/tiptap-to-markdown";
import type { TipTapNode } from "@/lib/tiptap-to-markdown";
import { estimateContradictionTokens } from "@/lib/contradiction";
import { AI_CONFIG } from "@/config/ai";

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

  const userMessage =
    docTexts.length === 0
      ? "This story has no documents yet."
      : docTexts.map((d) => `### ${d.name} (${d.type})\n${d.content}`).join("\n\n");

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
        { role: "system", content: CONTRADICTION_SYSTEM_PROMPT },
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
