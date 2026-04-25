export type DocumentTypeValue =
  | "CHARACTER"
  | "RELATIONSHIP"
  | "WORLDBUILDING"
  | "PLOT"
  | "SCENE"
  | "OTHER";

export function isDocumentType(value: unknown): value is DocumentTypeValue {
  return (
    value === "CHARACTER" ||
    value === "RELATIONSHIP" ||
    value === "WORLDBUILDING" ||
    value === "PLOT" ||
    value === "SCENE" ||
    value === "OTHER"
  );
}

export function isValidDocumentScope(
  storyId: string | null,
  seriesId: string | null,
  universeId: string | null,
): boolean {
  return !!(storyId || seriesId || universeId);
}

export const DOCUMENT_SECTION_LABELS: Record<DocumentTypeValue, string> = {
  CHARACTER: "Characters",
  RELATIONSHIP: "Relationships",
  WORLDBUILDING: "Worldbuilding",
  PLOT: "Plot",
  SCENE: "Scenes",
  OTHER: "Other",
};

export const DOCUMENT_TYPE_LABELS: Record<DocumentTypeValue, string> = {
  CHARACTER: "Character",
  RELATIONSHIP: "Relationship",
  WORLDBUILDING: "Worldbuilding",
  PLOT: "Plot",
  SCENE: "Scene",
  OTHER: "Other",
};

export const DOCUMENT_TYPE_ORDER: DocumentTypeValue[] = [
  "CHARACTER",
  "RELATIONSHIP",
  "WORLDBUILDING",
  "PLOT",
  "SCENE",
  "OTHER",
];
