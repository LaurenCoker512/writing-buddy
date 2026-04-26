import type { DocumentTypeValue } from "@/lib/documents";

interface TipTapTextNode {
  type: "text";
  text: string;
}

interface TipTapHeadingNode {
  type: "heading";
  attrs: { level: number };
  content: [TipTapTextNode];
}

export interface TipTapTemplateDoc {
  type: "doc";
  content: TipTapHeadingNode[];
}

function heading(text: string): TipTapHeadingNode {
  return { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text }] };
}

const TEMPLATE_HEADINGS: Partial<Record<DocumentTypeValue, string[]>> = {
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

export function buildTemplate(type: DocumentTypeValue): TipTapTemplateDoc {
  const headings = TEMPLATE_HEADINGS[type];
  if (!headings) {
    return { type: "doc", content: [] };
  }
  return { type: "doc", content: headings.map(heading) };
}
