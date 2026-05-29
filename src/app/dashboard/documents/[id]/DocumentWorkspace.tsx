"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DOCUMENT_TYPE_LABELS } from "@/lib/documents";
import type { DocumentTypeValue } from "@/lib/documents";
import SplitView from "@/components/SplitView";
import ChatPanel from "@/components/ChatPanel";
import VersionHistoryPanel from "@/components/VersionHistoryPanel";
import DocumentMetaBar from "@/components/DocumentMetaBar";
import DocumentLinksBar from "@/components/DocumentLinksBar";
import ContradictionCheckerModal from "@/components/ContradictionCheckerModal";
import ReadOnlyEditor from "@/components/ReadOnlyEditor";
import PlotBoard from "@/components/PlotBoard";
import { isSceneMeta } from "@/lib/document-meta";
import type { DiffProposal } from "@/types/diff";
import { consumePrepopulateProposals } from "@/lib/prepopulate-store";

const TipTapEditor = dynamic(() => import("@/components/TipTapEditor"), {
  ssr: false,
  loading: () => (
    <div className="flex flex-1 items-center justify-center p-8 text-text-muted">
      Loading editor…
    </div>
  ),
});

type SaveStatus = "idle" | "saving" | "saved" | "error";

type ParentView = { id: string; name: string; tiptapJson: object; label: string };
type ParentCandidate = { id: string; name: string; scopeLabel: string };

interface DocumentWorkspaceProps {
  documentId: string;
  documentName: string;
  documentType: string;
  initialJson: object;
  initialMeta: Record<string, unknown> | null;
  storyId: string | null;
  seriesId: string | null;
  universeId: string | null;
  parentDocumentId: string | null;
  parentDocumentName: string | null;
  parentCandidates: ParentCandidate[];
  parentViews: ParentView[];
  currentLabel: string;
  plotDocId?: string | null;
}

export default function DocumentWorkspace({
  documentId,
  documentName,
  documentType,
  initialJson,
  initialMeta,
  storyId,
  seriesId,
  universeId,
  parentDocumentId: initialParentDocumentId,
  parentDocumentName: initialParentDocumentName,
  parentCandidates,
  parentViews,
  currentLabel,
  plotDocId,
}: DocumentWorkspaceProps) {
  const router = useRouter();
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  useEffect(() => {
    if (saveStatus === "saved") {
      router.refresh();
    }
  }, [saveStatus, router]);
  const [externalContent, setExternalContent] = useState<
    { json: object; nonce: number } | undefined
  >();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [contradictionOpen, setContradictionOpen] = useState(false);
  const [versionKey, setVersionKey] = useState(0);
  const [parentDocumentId, setParentDocumentId] = useState<string | null>(
    initialParentDocumentId,
  );
  const [parentDocumentName, setParentDocumentName] = useState<string | null>(
    initialParentDocumentName,
  );
  const [showParentSelector, setShowParentSelector] = useState(false);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const activeView = parentViews.find((v) => v.id === activeViewId) ?? null;
  const [pendingDiffs, setPendingDiffs] = useState<DiffProposal[]>(() =>
    consumePrepopulateProposals(documentId),
  );
  const editorContentRef = useRef<object>(initialJson);

  const isStoryPlot = documentType === "PLOT" && storyId !== null;
  const isSeriesPlot = documentType === "PLOT" && seriesId !== null;
  const isScene = documentType === "SCENE";

  // For scenes: track the plotSummary field locally (persisted via PATCH on blur).
  const [plotSummary, setPlotSummary] = useState<string>(() => {
    if (!isScene) return "";
    return isSceneMeta(initialMeta) ? (initialMeta.plotSummary ?? "") : "";
  });

  const typeLabel = isStoryPlot ? "" : (DOCUMENT_TYPE_LABELS[documentType as DocumentTypeValue] ?? documentType);

  function handleDiffProposals(proposals: DiffProposal[]) {
    setPendingDiffs(proposals);
  }

  async function handleResolveDiff(proposalId: string, accept: boolean) {
    setPendingDiffs((prev) => prev.filter((p) => p.id !== proposalId));

    if (accept) {
      await fetch(`/api/documents/${documentId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tiptapJson: editorContentRef.current }),
      });
      setVersionKey((k) => k + 1);
    }
  }

  function handleRestore(tiptapJson: object) {
    setExternalContent({ json: tiptapJson, nonce: Date.now() });
    setVersionKey((k) => k + 1);
  }

  async function handlePlotSummaryBlur(value: string) {
    await fetch(`/api/documents/${documentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meta: { plotSummary: value } }),
    });
  }

  async function handleSetParent(candidateId: string | null) {
    const candidate = parentCandidates.find((c) => c.id === candidateId) ?? null;
    setParentDocumentId(candidateId);
    setParentDocumentName(candidate?.name ?? null);
    setShowParentSelector(false);
    await fetch(`/api/documents/${documentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parentDocumentId: candidateId }),
    });
  }

  const editorPanel = (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 flex-col bg-surface px-6 py-4">
        <div className="flex items-baseline gap-3">
          <h1 className="font-heading text-xl font-semibold text-text-primary">
            {documentName}
          </h1>
          {typeLabel && <span className="text-xs text-text-muted">{typeLabel}</span>}
          {/* TODO: AU vs Canon feature — expand into a full workflow before re-enabling.
               Canon badge (isCanon === true → amber "C") hidden until the feature is complete.
          {initialMeta?.isCanon === true && (
            <span
              className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-xs font-semibold text-amber-700"
              aria-label="Canon document"
            >
              C
            </span>
          )} */}
          <div className="ml-auto flex items-center gap-1">
            {storyId !== null && activeViewId === null && (
              <button
                type="button"
                onClick={() => setContradictionOpen(true)}
                aria-label="Check for contradictions"
                data-testid="contradiction-checker-button"
                className="rounded px-2 py-1 text-sm text-text-muted transition-colors hover:bg-background hover:text-text-primary"
              >
                Contradictions
              </button>
            )}
            {activeViewId === null && (
              <button
                type="button"
                onClick={() => setHistoryOpen(true)}
                aria-label="View version history"
                data-testid="version-history-button"
                className="rounded px-2 py-1 text-sm text-text-muted transition-colors hover:bg-background hover:text-text-primary"
              >
                History
              </button>
            )}
          </div>
        </div>

        {parentViews.length > 0 && (
          <div className="mt-3 flex gap-1" role="tablist" aria-label="Document scope">
            <button
              role="tab"
              aria-selected={activeViewId === null}
              onClick={() => setActiveViewId(null)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                activeViewId === null
                  ? "bg-accent text-white"
                  : "text-text-muted hover:bg-background hover:text-text-primary"
              }`}
            >
              {currentLabel}
            </button>
            {parentViews.map((view) => (
              <button
                key={view.id}
                role="tab"
                aria-selected={activeViewId === view.id}
                onClick={() => setActiveViewId(view.id)}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  activeViewId === view.id
                    ? "bg-accent text-white"
                    : "text-text-muted hover:bg-background hover:text-text-primary"
                }`}
              >
                {view.label}
              </button>
            ))}
          </div>
        )}

        {isScene && activeViewId === null && (
          <div className="mt-2 flex items-start gap-2">
            <div className="flex-1">
              <label className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                Plot Summary
              </label>
              <input
                type="text"
                value={plotSummary}
                onChange={(e) => setPlotSummary(e.target.value)}
                onBlur={(e) => void handlePlotSummaryBlur(e.target.value)}
                placeholder="One-line description of this scene's role in the plot…"
                className="w-full rounded border border-border bg-background px-2 py-1 text-sm text-text-primary outline-none placeholder:text-text-muted/50 focus:ring-1 focus:ring-accent"
                aria-label="Plot summary for this scene"
              />
            </div>
            {plotDocId != null && (
              <Link
                href={`/dashboard/documents/${plotDocId}`}
                className="mt-5 shrink-0 text-xs text-accent hover:underline"
              >
                View Plot →
              </Link>
            )}
          </div>
        )}

        {activeViewId === null && parentCandidates.length > 0 && (
          <div className="relative mt-1 flex items-center gap-2">
            {parentDocumentName !== null ? (
              <>
                <span className="text-xs text-text-muted">
                  Specialization of:{" "}
                  <span className="font-medium text-text-primary">{parentDocumentName}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowParentSelector(true)}
                  className="text-xs text-accent hover:underline"
                  aria-label="Change parent document"
                >
                  Change
                </button>
                <button
                  type="button"
                  onClick={() => handleSetParent(null)}
                  className="text-xs text-text-muted hover:text-text-primary hover:underline"
                  aria-label="Remove parent document link"
                >
                  Remove
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setShowParentSelector(true)}
                className="text-xs text-accent hover:underline"
                aria-label="Link to parent document"
                data-testid="link-parent-button"
              >
                + Link to parent document
              </button>
            )}
            {showParentSelector && (
              <div className="absolute left-0 top-6 z-20 min-w-[220px] rounded border border-border bg-surface shadow-lg">
                <div className="p-2 text-xs font-medium text-text-muted">
                  Select parent document
                </div>
                <ul>
                  {parentCandidates.map((candidate) => (
                    <li key={candidate.id}>
                      <button
                        type="button"
                        onClick={() => handleSetParent(candidate.id)}
                        className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-background ${
                          candidate.id === parentDocumentId
                            ? "font-medium text-accent"
                            : "text-text-primary"
                        }`}
                      >
                        <span>{candidate.name}</span>
                        <span className="ml-3 shrink-0 text-xs text-text-muted">
                          {candidate.scopeLabel}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => setShowParentSelector(false)}
                  className="block w-full px-3 py-2 text-left text-xs text-text-muted hover:bg-background"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {activeViewId === null && (
        <>
          <DocumentMetaBar
            documentId={documentId}
            documentType={documentType as DocumentTypeValue}
            initialMeta={initialMeta}
            storyId={storyId}
            seriesId={seriesId}
            universeId={universeId}
          />
          <DocumentLinksBar
            documentId={documentId}
            documentType={documentType}
            meta={initialMeta}
            storyId={storyId}
            seriesId={seriesId}
            universeId={universeId}
          />
        </>
      )}

      {/* Keep TipTapEditor mounted while a parent view is active to preserve unsaved state */}
      <div className={`flex-1 overflow-auto border-t border-border ${activeViewId !== null ? "hidden" : ""}`}>
        <TipTapEditor
          documentId={documentId}
          initialJson={initialJson}
          documentName={documentName}
          saveStatus={saveStatus}
          onSaveStatusChange={setSaveStatus}
          externalContent={externalContent}
          contentRef={editorContentRef}
          pendingDiffs={pendingDiffs}
          onResolveDiff={handleResolveDiff}
        />
        {(isStoryPlot || isSeriesPlot) && activeViewId === null && (
          <div className="px-6 pb-10">
            <PlotBoard
              variant={isStoryPlot ? "scenes" : "stories"}
              plotDocId={documentId}
              storyId={storyId ?? undefined}
              seriesId={seriesId ?? undefined}
              plotDocMeta={initialMeta}
            />
          </div>
        )}
      </div>

      {activeView !== null && (
        <div className="flex-1 overflow-auto">
          <div className="border-b border-border bg-background px-6 py-2">
            <p className="text-xs text-text-muted">
              Viewing{" "}
              <span className="font-medium text-text-primary">{activeView.name}</span>
              {" "}— read only
            </p>
          </div>
          <ReadOnlyEditor content={activeView.tiptapJson} />
        </div>
      )}
    </div>
  );

  return (
    <>
      <SplitView
        left={editorPanel}
        right={
          <ChatPanel
            documentId={documentId}
            storyId={storyId}
            seriesId={seriesId}
            universeId={universeId}
            onDiffProposals={handleDiffProposals}
          />
        }
      />
      {historyOpen && (
        <VersionHistoryPanel
          documentId={documentId}
          versionKey={versionKey}
          onClose={() => setHistoryOpen(false)}
          onRestore={handleRestore}
        />
      )}
      {contradictionOpen && storyId !== null && (
        <ContradictionCheckerModal
          storyId={storyId}
          onClose={() => setContradictionOpen(false)}
        />
      )}
    </>
  );
}
