export function isMode(value: unknown): value is "ORIGINAL" | "FANFIC" {
  return value === "ORIGINAL" || value === "FANFIC";
}

export function isRating(value: unknown): value is "G" | "T" | "M" | "E" {
  return value === "G" || value === "T" || value === "M" || value === "E";
}

export function toOptionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

export type HierarchyPatchData = {
  name?: string;
  mode?: "ORIGINAL" | "FANFIC";
  rating?: "G" | "T" | "M" | "E";
  sourceTitle?: string | null;
};

export type HierarchyPatchResult =
  | { ok: true; data: HierarchyPatchData }
  | { ok: false; error: string; status: 400 };

export function buildHierarchyPatchData(body: Record<string, unknown>): HierarchyPatchResult {
  const data: HierarchyPatchData = {};

  if (typeof body.name === "string" && body.name.trim() !== "") {
    data.name = body.name.trim();
  }
  if (body.mode !== undefined) {
    if (!isMode(body.mode)) return { ok: false, error: "Invalid mode", status: 400 };
    data.mode = body.mode;
  }
  if (body.rating !== undefined) {
    if (!isRating(body.rating)) return { ok: false, error: "Invalid rating", status: 400 };
    data.rating = body.rating;
  }
  if (body.sourceTitle !== undefined) {
    data.sourceTitle = toOptionalString(body.sourceTitle);
  }

  if (Object.keys(data).length === 0) {
    return { ok: false, error: "No valid fields to update", status: 400 };
  }

  return { ok: true, data };
}
