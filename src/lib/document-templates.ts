import type { Prisma } from "@prisma/client";
import type { DocumentTypeValue } from "@/lib/documents";

interface TipTapTextNode {
  type: "text";
  text: string;
}

export interface TipTapHeadingNode {
  type: "heading";
  attrs: { level: number };
  content: [TipTapTextNode];
}

export interface TipTapParagraphNode {
  type: "paragraph";
  content: [TipTapTextNode];
}

export interface TipTapTemplateDoc {
  type: "doc";
  content: TipTapHeadingNode[];
}

export interface TipTapPlotDoc {
  type: "doc";
  content: (TipTapHeadingNode | TipTapParagraphNode)[];
}

function heading(text: string): TipTapHeadingNode {
  return { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text }] };
}

const TEMPLATE_HEADINGS: Partial<Record<DocumentTypeValue, string[]>> = {
  BRAINSTORM: [
    "Ideas",
    "Questions to Explore",
    "Possible Directions",
  ],
  CHARACTER: [
    "Name / Aliases",
    "Role (Protagonist / Antagonist / Supporting / Other)",
    "Physical Description",
    "Personality",
    "Backstory",
    "Motivations",
    "Fears",
    "Secrets",
    "Voice & Manner of Speaking",
    "Character Arc (Starting State → Turning Points → End State)",
    "Thematic Function",
  ],
  RELATIONSHIP: [
    "Characters Involved",
    "Relationship Type (Family / Romantic / Rival / Mentor / Ally / Other)",
    "History",
    "Current Dynamic",
    "Trajectory / How It Evolves",
  ],
  PLOT: [
    "Premise",
    "Inciting Incident",
    "Act Structure (customizable — Acts, Parts, Chapters, or custom groupings)",
    "Midpoint",
    "Climax",
    "Resolution",
    "Key Themes",
  ],
  SCENE: [
    "POV Character",
    "Location",
    "Characters Present",
    "Scene Goal",
    "Conflict",
    "Outcome",
    "Tone / Mood",
    "Notes / Brainstorm",
  ],
};

export function buildTemplate(type: DocumentTypeValue): Prisma.InputJsonValue {
  const headings = TEMPLATE_HEADINGS[type];
  const doc: TipTapTemplateDoc = { type: "doc", content: headings ? headings.map(heading) : [] };
  return doc as unknown as Prisma.InputJsonValue;
}

export function buildBrainstormTemplateWithPrompt(prompt: string): Prisma.InputJsonValue {
  const headings = TEMPLATE_HEADINGS["BRAINSTORM"] ?? [];
  const content: (TipTapHeadingNode | TipTapParagraphNode)[] = [];
  for (const text of headings) {
    content.push(heading(text));
    if (text === "Ideas") {
      content.push({ type: "paragraph", content: [{ type: "text", text: prompt }] });
    }
  }
  const doc: TipTapPlotDoc = { type: "doc", content };
  return doc as unknown as Prisma.InputJsonValue;
}

export function buildPlotTemplateWithPremise(logline: string): Prisma.InputJsonValue {
  const headings = TEMPLATE_HEADINGS["PLOT"] ?? [];
  const content: (TipTapHeadingNode | TipTapParagraphNode)[] = [];
  for (const text of headings) {
    content.push(heading(text));
    if (text === "Premise") {
      content.push({ type: "paragraph", content: [{ type: "text", text: logline }] });
    }
  }
  const doc: TipTapPlotDoc = { type: "doc", content };
  return doc as unknown as Prisma.InputJsonValue;
}
