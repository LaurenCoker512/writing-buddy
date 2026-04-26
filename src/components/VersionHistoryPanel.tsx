"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";

const ReadOnlyEditor = dynamic(() => import("@/components/ReadOnlyEditor"), {
  ssr: false,
  loading: () => (
    <p className="p-5 text-sm text-text-muted">Loading preview…</p>
  ),
});

interface VersionSummary {
  id: string;
  label: string | null;
  createdAt: string;
}

interface VersionHistoryPanelProps {
  documentId: string;
  versionKey: number;
  onClose: () => void;
  onRestore: (tiptapJson: object) => void;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function VersionHistoryPanel({
  documentId,
  versionKey,
  onClose,
  onRestore,
}: VersionHistoryPanelProps) {
  const [versions, setVersions] = useState<VersionSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewContent, setPreviewContent] = useState<object | null>(null);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  const fetchVersions = useCallback(async () => {
    setIsLoadingVersions(true);
    try {
      const res = await fetch(`/api/documents/${documentId}/versions`);
      if (res.ok) {
        const data = (await res.json()) as VersionSummary[];
        setVersions(data);
        if (data.length > 0) {
          setSelectedId((prev) => prev ?? data[0].id);
        }
      }
    } finally {
      setIsLoadingVersions(false);
    }
  }, [documentId]);

  useEffect(() => {
    void fetchVersions();
  }, [fetchVersions, versionKey]);

  useEffect(() => {
    if (!selectedId) {
      setPreviewContent(null);
      return;
    }
    setIsLoadingPreview(true);
    setPreviewContent(null);
    fetch(`/api/documents/${documentId}/versions/${selectedId}`)
      .then(async (res) => {
        if (res.ok) {
          const data = (await res.json()) as { tiptapJson: object };
          setPreviewContent(data.tiptapJson);
        }
      })
      .finally(() => setIsLoadingPreview(false));
  }, [documentId, selectedId]);

  async function handleRestore() {
    if (!selectedId) return;
    setIsRestoring(true);
    try {
      const res = await fetch(
        `/api/documents/${documentId}/restore/${selectedId}`,
        { method: "POST" },
      );
      if (res.ok) {
        const data = (await res.json()) as {
          tiptapJson: object;
          version: VersionSummary;
        };
        onRestore(data.tiptapJson);
        await fetchVersions();
        setSelectedId(data.version.id);
      }
    } finally {
      setIsRestoring(false);
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/30"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="fixed inset-y-0 right-0 z-50 flex w-[480px] flex-col border-l border-border bg-surface shadow-2xl"
        role="dialog"
        aria-label="Version history"
        aria-modal="true"
        data-testid="version-history-panel"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-heading text-lg font-semibold text-text-primary">
            Version History
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close version history"
            className="rounded p-1 text-text-muted transition-colors hover:bg-background hover:text-text-primary"
          >
            ✕
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          {/* Version list */}
          <div
            className="shrink-0 overflow-y-auto border-b border-border"
            style={{ maxHeight: "45%" }}
          >
            {isLoadingVersions ? (
              <p className="p-4 text-sm text-text-muted">Loading…</p>
            ) : versions.length === 0 ? (
              <p className="p-4 text-sm text-text-muted">
                No versions yet. Accept an AI diff to create the first version.
              </p>
            ) : (
              <ul aria-label="Document versions">
                {versions.map((version) => (
                  <li key={version.id}>
                    <button
                      type="button"
                      aria-pressed={selectedId === version.id}
                      onClick={() => setSelectedId(version.id)}
                      data-testid={`version-item-${version.id}`}
                      className={`w-full px-5 py-3 text-left transition-colors ${
                        selectedId === version.id
                          ? "bg-accent/10"
                          : "hover:bg-background"
                      }`}
                    >
                      <div className="text-sm font-medium text-text-primary">
                        {version.label ?? "Saved version"}
                      </div>
                      <div className="text-xs text-text-muted">
                        {formatDate(version.createdAt)}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Preview */}
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {selectedId === null ? (
              <p className="p-4 text-sm text-text-muted">
                Select a version to preview.
              </p>
            ) : (
              <>
                <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-text-muted">
                    Preview
                  </span>
                  <button
                    type="button"
                    onClick={handleRestore}
                    disabled={isRestoring || isLoadingPreview}
                    data-testid="restore-version-button"
                    className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    {isRestoring ? "Restoring…" : "Restore this version"}
                  </button>
                </div>
                <div className="flex-1 overflow-auto">
                  {isLoadingPreview ? (
                    <p className="p-5 text-sm text-text-muted">
                      Loading preview…
                    </p>
                  ) : previewContent ? (
                    <ReadOnlyEditor content={previewContent} />
                  ) : null}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
