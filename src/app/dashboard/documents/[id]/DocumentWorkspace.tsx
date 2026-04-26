"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { DOCUMENT_TYPE_LABELS } from "@/lib/documents";
import type { DocumentTypeValue } from "@/lib/documents";
import SplitView from "@/components/SplitView";
import ChatPanel from "@/components/ChatPanel";
import VersionHistoryPanel from "@/components/VersionHistoryPanel";
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
}

export default function DocumentWorkspace({
  documentId,
  documentName,
  documentType,
  initialJson,
}: DocumentWorkspaceProps) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [externalContent, setExternalContent] = useState<
    { json: object; nonce: number } | undefined
  >();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [versionKey, setVersionKey] = useState(0);

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

  const editorPanel = (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-baseline gap-3 border-b border-border bg-surface px-6 py-4">
        <h1 className="font-heading text-xl font-semibold text-text-primary">
          {documentName}
        </h1>
        <span className="text-xs text-text-muted">{typeLabel}</span>
        <div className="ml-auto">
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
        right={<ChatPanel documentId={documentId} onAcceptDiff={handleAcceptDiff} />}
      />
      {historyOpen && (
        <VersionHistoryPanel
          documentId={documentId}
          versionKey={versionKey}
          onClose={() => setHistoryOpen(false)}
          onRestore={handleRestore}
        />
      )}
    </>
  );
}
