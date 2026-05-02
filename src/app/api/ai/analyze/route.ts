import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import type { AnalysisSection } from "@/types/analysis";
import { resolveProviderForUser, stripJsonFences } from "@/lib/ai-provider";
import { findOwnedDocument } from "@/lib/db-helpers";
import { AI_CONFIG } from "@/config/ai";

const TYPE_EXTRACTION_FOCUS: Record<string, string> = {
  CHARACTER:
    "Extract ONLY details about this character directly observable in the content: personality traits, behaviors, speech patterns, mannerisms, emotional reactions, physical details, decisions, and revealed backstory. Do NOT extract relationship dynamics, other characters' traits, plot events, or worldbuilding.",
  RELATIONSHIP:
    "Extract ONLY observations about the relationship between these characters: interaction patterns, power dynamics, communication styles, emotional undertones, conflict or affection, and any history revealed. Do NOT extract individual character personalities, plot events, or worldbuilding.",
  WORLDBUILDING:
    "Extract ONLY world-building details: geography, culture, society, history, technology, magic systems, rules, or lore. Do NOT extract character personalities, individual behaviors, or plot events.",
  PLOT: "Extract ONLY plot-relevant information: events that occur, causal chains, timeline details, conflicts introduced, foreshadowing, and consequences. Do NOT extract character personality analysis or worldbuilding.",
  SCENE: "Extract ONLY scene-specific details: setting description, POV character, characters present, scene goal, conflict, mood, pacing, and outcome. Do NOT extract broader plot implications, character backstory, or worldbuilding beyond the immediate setting.",
  BRAINSTORM:
    "Extract any interesting ideas, potential directions, open questions, recurring themes, or noteworthy observations that could inform further development. Be expansive.",
  OTHER:
    "Extract any relevant details, observations, or notes worth preserving from the submitted content.",
};

interface AiAnalysisResponse {
  sections?: Array<{ heading?: unknown; content?: unknown }>;
}

function buildAnalyzeSystemPrompt(documentType: string): string {
  const focus =
    TYPE_EXTRACTION_FOCUS[documentType] ?? TYPE_EXTRACTION_FOCUS["OTHER"]!;

  return `You are a writing analysis assistant. Given a content snippet (scene, transcript, summary, or other material), extract observations about a specific story subject. The document name and type are provided only to identify the subject of analysis — use them to focus your extraction, not to filter or frame what you find. Do not let any prior knowledge of the subject influence the analysis; report only what is directly present in the submitted content.

Document type: ${documentType}
${focus}

Return ONLY valid JSON (no markdown fences, no explanation) in this exact format:
{
  "sections": [
    {
      "heading": "Section Name",
      "content": "- Observation one\\n- Observation two\\n- Observation three"
    }
  ]
}

Rules:
- Use section headings that are relevant to the document type (e.g. Personality, Backstory, Speech Patterns for a CHARACTER document)
- Format each section's content as bullet points, one observation per line, starting with "- "
- Only include sections that have actual findings — omit sections with nothing to report
- Only record observations directly present in the submitted content — do not speculate or invent details
- Return valid JSON only — no other text`;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as { documentId?: unknown; content?: unknown };

  if (typeof body.documentId !== "string" || typeof body.content !== "string") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (body.content.length > AI_CONFIG.MAX_SOURCE_TEXT_LENGTH) {
    return NextResponse.json({ error: "Content too long" }, { status: 400 });
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

  const systemPrompt = buildAnalyzeSystemPrompt(document.type);
  const userMessage = `Document: "${document.name}" (${document.type})\n\nContent to analyze:\n${body.content}`;

  let rawContent: string;
  try {
    rawContent = await provider.completeChat(
      [{ role: "user", content: userMessage }],
      systemPrompt,
    );
  } catch {
    return NextResponse.json({ error: "AI provider error" }, { status: 502 });
  }

  let parsed: AiAnalysisResponse;
  try {
    parsed = JSON.parse(stripJsonFences(rawContent)) as AiAnalysisResponse;
  } catch {
    return NextResponse.json({ error: "Failed to parse AI response" }, { status: 502 });
  }

  const sections: AnalysisSection[] = (Array.isArray(parsed.sections) ? parsed.sections : [])
    .filter(
      (s): s is { heading: string; content: string } =>
        typeof s.heading === "string" &&
        s.heading.length > 0 &&
        typeof s.content === "string" &&
        s.content.length > 0,
    )
    .map((s) => ({ heading: s.heading, content: s.content }));

  return NextResponse.json({ sections });
}
