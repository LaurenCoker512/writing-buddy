"use client";

import { useEffect, useState } from "react";
import { buildScopeParam } from "@/lib/documents";

interface RelatedDoc {
  id: string;
  name: string;
  type: string;
  meta: unknown;
}

interface DocumentLinksBarProps {
  documentId: string;
  documentType: string;
  meta: Record<string, unknown> | null;
  storyId?: string | null;
  seriesId?: string | null;
  universeId?: string | null;
}

function docLink(id: string) {
  return `/dashboard/documents/${id}`;
}

export default function DocumentLinksBar({
  documentId,
  documentType,
  meta,
  storyId,
  seriesId,
  universeId,
}: DocumentLinksBarProps) {
  const [relatedDocs, setRelatedDocs] = useState<RelatedDoc[]>([]);

  const isCharacter = documentType === "CHARACTER";
  const isRelationship = documentType === "RELATIONSHIP";

  useEffect(() => {
    if (!isCharacter && !isRelationship) return;

    const scopeParam = buildScopeParam(storyId, seriesId, universeId);
    if (scopeParam === null) return;

    const types = isCharacter ? "RELATIONSHIP,CHARACTER" : "CHARACTER";
    fetch(`/api/documents?${scopeParam}&types=${types}`)
      .then((res) => (res.ok ? (res.json() as Promise<RelatedDoc[]>) : Promise.resolve([])))
      .then(setRelatedDocs)
      .catch(() => setRelatedDocs([]));
  }, [documentId, documentType, isCharacter, isRelationship, storyId, seriesId, universeId]);

  if (isCharacter) {
    const characterMap = new Map(
      relatedDocs.filter((d) => d.type === "CHARACTER").map((d) => [d.id, d]),
    );
    const relationships = relatedDocs.filter((d) => {
      if (d.type !== "RELATIONSHIP") return false;
      const ids = getMeta(d.meta, "characterIds");
      return Array.isArray(ids) && ids.includes(documentId);
    });

    if (relationships.length === 0) return null;

    return (
      <div className="shrink-0 bg-surface px-6 py-2">
        <span className="mr-3 text-xs font-medium text-text-muted">Relationships</span>
        <span className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
          {relationships.map((rel) => {
            const ids = getMeta(rel.meta, "characterIds");
            const otherId = Array.isArray(ids)
              ? ids.find((id): id is string => typeof id === "string" && id !== documentId)
              : undefined;
            const other = otherId !== undefined ? characterMap.get(otherId) : undefined;
            return (
              <span key={rel.id} className="flex items-center gap-1 text-xs">
                <a
                  href={docLink(rel.id)}
                  className="text-accent hover:underline"
                >
                  {rel.name}
                </a>
                {other !== undefined && (
                  <>
                    <span className="text-text-muted">with</span>
                    <a
                      href={docLink(other.id)}
                      className="text-accent hover:underline"
                    >
                      {other.name}
                    </a>
                  </>
                )}
              </span>
            );
          })}
        </span>
      </div>
    );
  }

  if (isRelationship) {
    const characterIds = getMeta(meta, "characterIds");
    if (!Array.isArray(characterIds) || characterIds.length === 0) return null;

    const linkedChars = relatedDocs.filter(
      (d) => d.type === "CHARACTER" && characterIds.includes(d.id),
    );
    if (linkedChars.length === 0) return null;

    return (
      <div className="shrink-0 bg-surface px-6 py-2">
        <span className="mr-3 text-xs font-medium text-text-muted">Characters</span>
        <span className="inline-flex flex-wrap gap-x-3 gap-y-1 mt-1">
          {linkedChars.map((char) => (
            <a
              key={char.id}
              href={docLink(char.id)}
              className="text-xs text-accent hover:underline"
            >
              {char.name}
            </a>
          ))}
        </span>
      </div>
    );
  }

  return null;
}

function getMeta(meta: unknown, key: string): unknown {
  if (typeof meta !== "object" || meta === null || Array.isArray(meta)) return undefined;
  return (meta as Record<string, unknown>)[key];
}
