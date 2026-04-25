export function isMode(value: unknown): value is "ORIGINAL" | "FANFIC" {
  return value === "ORIGINAL" || value === "FANFIC";
}

export function isRating(value: unknown): value is "G" | "T" | "M" | "E" {
  return value === "G" || value === "T" || value === "M" || value === "E";
}

export function toOptionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}
