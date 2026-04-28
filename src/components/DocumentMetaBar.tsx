"use client";

import { useState, useEffect } from "react";
import { buildScopeParam } from "@/lib/documents";
import type { DocumentTypeValue } from "@/lib/documents";
import {
  CHARACTER_ROLES,
  RELATIONSHIP_TYPES,
  WORLDBUILDING_CATEGORIES,
  type CharacterMeta,
  type RelationshipMeta,
  type WorldbuildingMeta,
} from "@/lib/document-meta";

interface CharacterOption {
  id: string;
  name: string;
}

interface DocumentMetaBarProps {
  documentId: string;
  documentType: DocumentTypeValue;
  initialMeta: Record<string, unknown> | null;
  storyId?: string | null;
  seriesId?: string | null;
  universeId?: string | null;
}

const selectClass =
  "rounded border border-border bg-background px-2 py-1 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent";
const labelClass = "flex items-center gap-2 text-sm text-text-muted";

export default function DocumentMetaBar({
  documentId,
  documentType,
  initialMeta,
  storyId,
  seriesId,
  universeId,
}: DocumentMetaBarProps) {
  const [meta, setMeta] = useState<Record<string, unknown>>(initialMeta ?? {});
  const [characterOptions, setCharacterOptions] = useState<CharacterOption[]>([]);
  const [characterError, setCharacterError] = useState<string | null>(null);

  useEffect(() => {
    if (documentType !== "RELATIONSHIP") return;
    const scopeParam = buildScopeParam(storyId, seriesId, universeId);
    if (scopeParam === null) return;
    fetch(`/api/documents?${scopeParam}&types=CHARACTER`)
      .then((res) => (res.ok ? (res.json() as Promise<CharacterOption[]>) : Promise.resolve([])))
      .then(setCharacterOptions)
      .catch(() => setCharacterOptions([]));
  }, [documentType, storyId, seriesId, universeId]);

  async function saveMeta(updated: Record<string, unknown>): Promise<Response> {
    setMeta(updated);
    return fetch(`/api/documents/${documentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meta: updated }),
    });
  }

  if (documentType === "CHARACTER") {
    const characterMeta = meta as CharacterMeta;
    return (
      <div className="flex shrink-0 items-center gap-4 border-b border-border bg-surface px-6 py-2">
        <label className={labelClass} htmlFor="character-role">
          Role
          <select
            id="character-role"
            data-testid="meta-role-select"
            className={selectClass}
            value={characterMeta.role ?? ""}
            onChange={(e) => {
              const role = e.target.value || undefined;
              saveMeta({ ...meta, role });
            }}
          >
            <option value="">— No role —</option>
            {CHARACTER_ROLES.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </label>
      </div>
    );
  }

  if (documentType === "RELATIONSHIP") {
    const relMeta = meta as RelationshipMeta;
    const [charAId, charBId] = relMeta.characterIds ?? ["", ""];

    const saveCharacters = async (aId: string, bId: string) => {
      setCharacterError(null);
      const characterIds = [aId, bId].filter((id) => id !== "");
      const updated = { ...meta, characterIds: characterIds.length === 2 ? characterIds : characterIds.length === 0 ? undefined : characterIds };
      const res = await saveMeta(updated);
      if (res.status === 409) {
        const body = (await res.json()) as { error?: string };
        setCharacterError(body.error ?? "A relationship between these two characters already exists.");
        setMeta(meta);
      }
    };

    return (
      <div className="flex shrink-0 flex-wrap items-center gap-4 border-b border-border bg-surface px-6 py-2">
        <label className={labelClass} htmlFor="relationship-type">
          Type
          <select
            id="relationship-type"
            data-testid="meta-relationship-type-select"
            className={selectClass}
            value={relMeta.relationshipType ?? ""}
            onChange={(e) => {
              const relationshipType = e.target.value || undefined;
              saveMeta({ ...meta, relationshipType });
            }}
          >
            <option value="">— Select type —</option>
            {RELATIONSHIP_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>

        {characterOptions.length > 0 && (
          <>
            <label className={labelClass} htmlFor="relationship-char-a">
              Character A
              <select
                id="relationship-char-a"
                data-testid="meta-char-a-select"
                className={selectClass}
                value={charAId ?? ""}
                onChange={(e) => { void saveCharacters(e.target.value, charBId ?? ""); }}
              >
                <option value="">— Select —</option>
                {characterOptions.map((c) => (
                  <option key={c.id} value={c.id} disabled={c.id === charBId}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>

            <label className={labelClass} htmlFor="relationship-char-b">
              Character B
              <select
                id="relationship-char-b"
                data-testid="meta-char-b-select"
                className={selectClass}
                value={charBId ?? ""}
                onChange={(e) => { void saveCharacters(charAId ?? "", e.target.value); }}
              >
                <option value="">— Select —</option>
                {characterOptions.map((c) => (
                  <option key={c.id} value={c.id} disabled={c.id === charAId}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>

            {characterError !== null && (
              <p className="w-full text-xs text-red-600">{characterError}</p>
            )}
          </>
        )}
      </div>
    );
  }

  if (documentType === "WORLDBUILDING") {
    const wbMeta = meta as WorldbuildingMeta;
    return (
      <div className="flex shrink-0 items-center gap-4 border-b border-border bg-surface px-6 py-2">
        <label className={labelClass} htmlFor="worldbuilding-category">
          Category
          <select
            id="worldbuilding-category"
            data-testid="meta-category-select"
            className={selectClass}
            value={wbMeta.category ?? ""}
            onChange={(e) => {
              const category = e.target.value || undefined;
              saveMeta({ ...meta, category });
            }}
          >
            <option value="">— Select category —</option>
            {WORLDBUILDING_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </label>
      </div>
    );
  }

  return null;
}
