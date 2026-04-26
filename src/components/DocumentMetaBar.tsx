"use client";

import { useState } from "react";
import type { DocumentTypeValue } from "@/lib/documents";
import {
  CHARACTER_ROLES,
  RELATIONSHIP_TYPES,
  WORLDBUILDING_CATEGORIES,
  type CharacterMeta,
  type RelationshipMeta,
  type WorldbuildingMeta,
} from "@/lib/document-meta";

interface DocumentMetaBarProps {
  documentId: string;
  documentType: DocumentTypeValue;
  initialMeta: Record<string, unknown> | null;
}

const selectClass =
  "rounded border border-border bg-background px-2 py-1 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent";
const labelClass = "flex items-center gap-2 text-sm text-text-muted";

export default function DocumentMetaBar({
  documentId,
  documentType,
  initialMeta,
}: DocumentMetaBarProps) {
  const [meta, setMeta] = useState<Record<string, unknown>>(initialMeta ?? {});

  async function saveMeta(updated: Record<string, unknown>) {
    setMeta(updated);
    await fetch(`/api/documents/${documentId}`, {
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
    return (
      <div className="flex shrink-0 items-center gap-4 border-b border-border bg-surface px-6 py-2">
        <label className={labelClass} htmlFor="relationship-type">
          Relationship Type
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
