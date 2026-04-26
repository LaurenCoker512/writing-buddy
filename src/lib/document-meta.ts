export interface CharacterMeta {
  isCanon?: boolean;
  role?: string;
}

export interface RelationshipMeta {
  characterIds?: string[];
  relationshipType?: string;
}

export interface WorldbuildingMeta {
  category?: string;
  isCanon?: boolean;
}

export function isCharacterMeta(value: unknown): value is CharacterMeta {
  if (typeof value !== "object" || value === null) return false;
  const meta = value as Record<string, unknown>;
  return (
    (meta.isCanon === undefined || typeof meta.isCanon === "boolean") &&
    (meta.role === undefined || typeof meta.role === "string")
  );
}

export function isRelationshipMeta(value: unknown): value is RelationshipMeta {
  if (typeof value !== "object" || value === null) return false;
  const meta = value as Record<string, unknown>;
  return (
    (meta.characterIds === undefined ||
      (Array.isArray(meta.characterIds) &&
        meta.characterIds.every((id) => typeof id === "string"))) &&
    (meta.relationshipType === undefined || typeof meta.relationshipType === "string")
  );
}

export function isWorldbuildingMeta(value: unknown): value is WorldbuildingMeta {
  if (typeof value !== "object" || value === null) return false;
  const meta = value as Record<string, unknown>;
  return (
    (meta.category === undefined || typeof meta.category === "string") &&
    (meta.isCanon === undefined || typeof meta.isCanon === "boolean")
  );
}

export const CHARACTER_ROLES = [
  "Protagonist",
  "Antagonist",
  "Supporting",
  "Other",
] as const;

export const RELATIONSHIP_TYPES = [
  "Family",
  "Romantic",
  "Rival",
  "Mentor",
  "Ally",
  "Other",
] as const;

export const WORLDBUILDING_CATEGORIES = [
  "Location",
  "Faction / Organization",
  "History / Timeline Entry",
  "Magic / Technology System",
  "Culture",
  "Economy",
  "Religion",
  "Language",
  "Other",
] as const;
