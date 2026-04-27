"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { DOCUMENT_TYPE_LABELS } from "@/lib/documents";
import type { DocumentTypeValue } from "@/lib/documents";
import SplitView from "@/components/SplitView";
import ChatPanel from "@/components/ChatPanel";
import VersionHistoryPanel from "@/components/VersionHistoryPanel";
import DocumentMetaBar from "@/components/DocumentMetaBar";
import DocumentLinksBar from "@/components/DocumentLinksBar";
import ContradictionCheckerModal from "@/components/ContradictionCheckerModal";
import { replaceSectionInTipTap, appendSectionToTipTap } from "@/lib/section-utils";
import type { TipTapDoc } from "@/lib/section-utils";
import { markdownToTipTapNodes } from "@/lib/markdown-to-tiptap";
import type { DiffProposal } from "@/types/diff";

const TipTapEditor = dynamic(() => import("@/components/TipTapEditor"), {
  ssr: false,
  loading: () => (
    <div className="flex flex-1 items-center justify-center p-8 text-text-muted">
      Loading editor…
    </div>
  ),
});

type SaveStatus = "idle" | "saving" | "saved" | "error";

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
  parentCandidates: { id: string; name: string }[];
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
}: DocumentWorkspaceProps) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
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
  const [initialDiffProposals] = useState<DiffProposal[]>(() => {
    if (typeof window === "undefined") return [];
    const stored = sessionStorage.getItem(`prepopulate-${documentId}`);
    if (!stored) return [];
    sessionStorage.removeItem(`prepopulate-${documentId}`);
    try {
      return JSON.parse(stored) as DiffProposal[];
    } catch {
      return [];
    }
  });

  const typeLabel = DOCUMENT_TYPE_LABELS[documentType as DocumentTypeValue] ?? documentType;

  async function handleAcceptDiff(proposal: DiffProposal) {
    const docRes = await fetch(`/api/documents/${documentId}`);
    if (!docRes.ok) return;

    const doc = (await docRes.json()) as { tiptapJson: object };
    const currentDoc = doc.tiptapJson as TipTapDoc;

    const newNodes = markdownToTipTapNodes(proposal.newMarkdown);
    let newDoc: TipTapDoc;
    if (proposal.isNew || proposal.heading === null) {
      newDoc = appendSectionToTipTap(currentDoc, newNodes);
    } else {
      newDoc = replaceSectionInTipTap(currentDoc, proposal.heading, newNodes);
    }

    await fetch(`/api/documents/${documentId}/versions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tiptapJson: currentDoc }),
    });

    const patchRes = await fetch(`/api/documents/${documentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tiptapJson: newDoc }),
    });

    if (patchRes.ok) {
      setExternalContent({ json: newDoc, nonce: Date.now() });
      setVersionKey((k) => k + 1);
    }
  }

  function handleRestore(tiptapJson: object) {
    setExternalContent({ json: tiptapJson, nonce: Date.now() });
    setVersionKey((k) => k + 1);
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
      <div className="flex shrink-0 flex-col border-b border-border bg-surface px-6 py-4">
        <div className="flex items-baseline gap-3">
          <h1 className="font-heading text-xl font-semibold text-text-primary">
            {documentName}
          </h1>
          <span className="text-xs text-text-muted">{typeLabel}</span>
          {initialMeta?.isCanon === true && (
            <span
              className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-xs font-semibold text-amber-700"
              aria-label="Canon document"
            >
              C
            </span>
          )}
          <div className="ml-auto flex items-center gap-1">
            {storyId !== null && (
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
            <button
              type="button"
              onClick={() => setHistoryOpen(true)}
              aria-label="View version history"
              data-testid="version-history-button"
              className="rounded px-2 py-1 text-sm text-text-muted transition-colors hover:bg-background hover:text-text-primary"
            >
              History
            </button>
          </div>
        </div>
        {parentCandidates.length > 0 && (
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
                aria-label="Link to universe document"
                data-testid="link-parent-button"
              >
                + Link to universe document
              </button>
            )}
            {showParentSelector && (
              <div className="absolute left-0 top-6 z-20 min-w-[220px] rounded border border-border bg-surface shadow-lg">
                <div className="p-2 text-xs font-medium text-text-muted">
                  Select universe document
                </div>
                <ul>
                  {parentCandidates.map((candidate) => (
                    <li key={candidate.id}>
                      <button
                        type="button"
                        onClick={() => handleSetParent(candidate.id)}
                        className={`block w-full px-3 py-2 text-left text-sm hover:bg-background ${
                          candidate.id === parentDocumentId
                            ? "font-medium text-accent"
                            : "text-text-primary"
                        }`}
                      >
                        {candidate.name}
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
      <div className="flex-1 overflow-auto">
        <TipTapEditor
          documentId={documentId}
          initialJson={initialJson}
          documentName={documentName}
          saveStatus={saveStatus}
          onSaveStatusChange={setSaveStatus}
          externalContent={externalContent}
        />
      </div>
    </div>
  );

  return (
    <>
      <SplitView
        left={editorPanel}
        right={
          <ChatPanel
            documentId={documentId}
            onAcceptDiff={handleAcceptDiff}
            initialDiffProposals={initialDiffProposals}
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
