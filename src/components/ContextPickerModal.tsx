"use client";

import { useState, useEffect } from "react";
import { DOCUMENT_SECTION_LABELS, DOCUMENT_TYPE_ORDER } from "@/lib/documents";
import type { DocumentTypeValue } from "@/lib/documents";

type ContextDoc = { id: string; name: string; type: string };

interface ScopeSection {
  label: string;
  docs: ContextDoc[];
}

interface ContextPickerModalProps {
  documentId: string;
  storyId: string | null;
  seriesId: string | null;
  universeId: string | null;
  initialSelectedIds: Set<string>;
  onConfirm: (docs: ContextDoc[]) => void;
  onClose: () => void;
}

function groupByType(docs: ContextDoc[]): Array<{ typeLabel: string; docs: ContextDoc[] }> {
  return DOCUMENT_TYPE_ORDER.flatMap((type) => {
    const typed = docs.filter((d) => d.type === type);
    return typed.length > 0
      ? [{ typeLabel: DOCUMENT_SECTION_LABELS[type as DocumentTypeValue] ?? type, docs: typed }]
      : [];
  });
}

export default function ContextPickerModal({
  documentId,
  storyId,
  seriesId,
  universeId,
  initialSelectedIds,
  onConfirm,
  onClose,
}: ContextPickerModalProps) {
  const [sections, setSections] = useState<ScopeSection[]>([]);
  const [allDocs, setAllDocs] = useState<ContextDoc[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(initialSelectedIds));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const scopes: Array<{ label: string; param: string }> = [];
    if (universeId) scopes.push({ label: "Universe", param: `universeId=${universeId}` });
    if (seriesId) scopes.push({ label: "Series", param: `seriesId=${seriesId}` });
    if (storyId) scopes.push({ label: "Story", param: `storyId=${storyId}` });

    async function fetchAll() {
      const results = await Promise.all(
        scopes.map(async ({ label, param }) => {
          try {
            const res = await fetch(`/api/documents?${param}`);
            if (!res.ok) return { label, docs: [] as ContextDoc[] };
            const docs = (await res.json()) as ContextDoc[];
            return { label, docs: docs.filter((d) => d.id !== documentId) };
          } catch {
            return { label, docs: [] as ContextDoc[] };
          }
        }),
      );

      const populated = results.filter((s) => s.docs.length > 0);
      setSections(populated);
      setAllDocs(populated.flatMap((s) => s.docs));
      setIsLoading(false);
    }

    void fetchAll();
  }, [documentId, storyId, seriesId, universeId]);

  function toggleDoc(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleConfirm() {
    onConfirm(allDocs.filter((d) => selectedIds.has(d.id)));
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[80vh] w-full max-w-md flex-col rounded-xl border border-border bg-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-heading text-base font-semibold text-text-primary">Add Context</h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-text-muted hover:text-text-primary"
            aria-label="Close context picker"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {isLoading && (
            <p className="py-6 text-center text-sm text-text-muted">Loading documents…</p>
          )}
          {!isLoading && sections.length === 0 && (
            <p className="py-6 text-center text-sm text-text-muted">No other documents available.</p>
          )}
          {!isLoading &&
            sections.map((section, index) => (
              <div key={section.label} className={index > 0 ? "mt-6" : undefined}>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
                  {section.label}
                </p>
                {groupByType(section.docs).map((group) => (
                  <div key={group.typeLabel} className="mb-3">
                    <p className="mb-1 pl-1 text-xs font-medium text-text-secondary">
                      {group.typeLabel}
                    </p>
                    {group.docs.map((doc) => (
                      <label
                        key={doc.id}
                        className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-background"
                      >
                        <input
                          type="checkbox"
                          checked={selectedIds.has(doc.id)}
                          onChange={() => toggleDoc(doc.id)}
                          className="rounded border-border accent-accent"
                        />
                        <span className="text-sm text-text-primary">{doc.name}</span>
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            ))}
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-text-muted hover:text-text-primary"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
