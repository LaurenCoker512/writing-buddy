export type DocumentTypeValue =
  | "BRAINSTORM"
  | "CHARACTER"
  | "RELATIONSHIP"
  | "WORLDBUILDING"
  | "PLOT"
  | "SCENE"
  | "OTHER";

export function isDocumentType(value: unknown): value is DocumentTypeValue {
  return (
    value === "BRAINSTORM" ||
    value === "CHARACTER" ||
    value === "RELATIONSHIP" ||
    value === "WORLDBUILDING" ||
    value === "PLOT" ||
    value === "SCENE" ||
    value === "OTHER"
  );
}

export function buildScopeParam(
  storyId: string | null | undefined,
  seriesId: string | null | undefined,
  universeId: string | null | undefined,
): string | null {
  if (storyId) return `storyId=${storyId}`;
  if (seriesId) return `seriesId=${seriesId}`;
  if (universeId) return `universeId=${universeId}`;
  return null;
}

export function isValidDocumentScope(
  storyId: string | null,
  seriesId: string | null,
  universeId: string | null,
): boolean {
  return !!(storyId || seriesId || universeId);
}

export const DOCUMENT_SECTION_LABELS: Record<DocumentTypeValue, string> = {
  BRAINSTORM: "Brainstorm",
  CHARACTER: "Characters",
  RELATIONSHIP: "Relationships",
  WORLDBUILDING: "Worldbuilding",
  PLOT: "Plot",
  SCENE: "Scenes",
  OTHER: "Other",
};

export const DOCUMENT_TYPE_LABELS: Record<DocumentTypeValue, string> = {
  BRAINSTORM: "Brainstorm",
  CHARACTER: "Character",
  RELATIONSHIP: "Relationship",
  WORLDBUILDING: "Worldbuilding",
  PLOT: "Plot",
  SCENE: "Scene",
  OTHER: "Other",
};

export const DOCUMENT_TYPE_ORDER: DocumentTypeValue[] = [
  "BRAINSTORM",
  "CHARACTER",
  "RELATIONSHIP",
  "WORLDBUILDING",
  "PLOT",
  "SCENE",
  "OTHER",
];
