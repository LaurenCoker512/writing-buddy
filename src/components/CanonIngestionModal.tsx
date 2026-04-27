"use client";

import { useState } from "react";
import { markdownToTipTapNodes } from "@/lib/markdown-to-tiptap";
import type { CanonProposal } from "@/types/diff";

interface CanonIngestionModalProps {
  universeId: string;
  universeName: string;
  onClose: () => void;
  onDocumentsCreated: () => void;
}

function CanonProposalCard({
  proposal,
  onAccept,
  onReject,
}: {
  proposal: CanonProposal;
  onAccept: (proposal: CanonProposal) => Promise<void>;
  onReject: (id: string) => void;
}) {
  const [accepting, setAccepting] = useState(false);

  const typeLabel = proposal.documentType === "CHARACTER" ? "Character" : "Worldbuilding";

  return (
    <div
      className="overflow-hidden rounded-lg border border-accent/30 bg-surface text-sm"
      role="region"
      aria-label={`Proposed ${typeLabel} document: ${proposal.documentName}`}
    >
      <div className="flex items-center gap-2 border-b border-accent/20 bg-accent/5 px-4 py-2">
        <span className="rounded bg-accent/20 px-1.5 py-0.5 text-xs font-semibold text-accent">
          {typeLabel}
        </span>
        <span className="text-xs font-medium text-text-primary">{proposal.documentName}</span>
        <span className="ml-auto rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-xs font-semibold text-amber-700">
          [C]
        </span>
      </div>
      <div className="px-4 py-3">
        <pre className="line-clamp-6 whitespace-pre-wrap font-sans text-xs text-text-muted">
          {proposal.markdown}
        </pre>
      </div>
      <div className="flex gap-2 border-t border-border bg-background px-4 py-3">
        <button
          onClick={async () => {
            setAccepting(true);
            await onAccept(proposal);
          }}
          disabled={accepting}
          className="flex-1 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {accepting ? "Creating…" : "Accept"}
        </button>
        <button
          onClick={() => onReject(proposal.id)}
          disabled={accepting}
          className="flex-1 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-text-muted transition-colors hover:bg-surface hover:text-text-primary disabled:opacity-50"
        >
          Reject
        </button>
      </div>
    </div>
  );
}

export default function CanonIngestionModal({
  universeId,
  universeName,
  onClose,
  onDocumentsCreated,
}: CanonIngestionModalProps) {
  const [sourceText, setSourceText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposals, setProposals] = useState<CanonProposal[] | null>(null);

  async function handleAnalyze() {
    if (!sourceText.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/ingest-canon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ universeId, sourceText }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string; message?: string };
        setError(data.message ?? data.error ?? "Failed to analyze source text.");
        return;
      }
      const data = (await res.json()) as { proposals: CanonProposal[] };
      setProposals(data.proposals);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleAccept(proposal: CanonProposal) {
    const nodes = markdownToTipTapNodes(proposal.markdown);
    const tiptapJson = { type: "doc", content: nodes };

    const createRes = await fetch("/api/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: proposal.documentName,
        type: proposal.documentType,
        universeId,
        tiptapJson,
        meta: { isCanon: true },
      }),
    });

    if (!createRes.ok) return;

    setProposals((prev) => prev?.filter((p) => p.id !== proposal.id) ?? null);
    onDocumentsCreated();
  }

  function handleReject(id: string) {
    setProposals((prev) => prev?.filter((p) => p.id !== id) ?? null);
  }

  const allDone = proposals !== null && proposals.length === 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-lg border border-border bg-surface shadow-xl"
        onClick={(e) => e.stopPropagation()}
        data-testid="canon-ingestion-modal"
      >
        <div className="border-b border-border px-6 py-4">
          <h2 className="font-heading text-lg font-semibold text-text-primary">
            Import Canon Text
          </h2>
          <p className="mt-0.5 text-xs text-text-muted">
            Universe: <span className="font-medium text-text-primary">{universeName}</span>
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {proposals === null ? (
            <>
              <p className="mb-3 text-sm text-text-muted">
                Paste wiki pages, character bios, or other source material. The AI will organize it into Character and Worldbuilding documents tagged as canon.
              </p>
              <textarea
                value={sourceText}
                onChange={(e) => setSourceText(e.target.value)}
                placeholder="Paste source text here…"
                className="min-h-48 w-full rounded border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none focus:ring-2 focus:ring-accent"
                data-testid="canon-source-text"
              />
              {error !== null && (
                <p className="mt-2 text-xs text-red-600" role="alert">
                  {error}
                </p>
              )}
            </>
          ) : allDone ? (
            <p className="text-sm text-text-muted">
              All proposals have been reviewed. Canon documents have been added to{" "}
              <span className="font-medium text-text-primary">{universeName}</span>.
            </p>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-text-muted">
                Review and accept the proposed canon documents below.
              </p>
              {proposals.map((proposal) => (
                <CanonProposalCard
                  key={proposal.id}
                  proposal={proposal}
                  onAccept={handleAccept}
                  onReject={handleReject}
                />
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
          <button
            onClick={onClose}
            className="rounded border border-border px-4 py-2 text-sm text-text-muted hover:bg-background"
          >
            {allDone ? "Done" : "Skip"}
          </button>
          {proposals === null && (
            <button
              onClick={handleAnalyze}
              disabled={loading || !sourceText.trim()}
              className="rounded bg-accent px-4 py-2 text-sm text-white hover:bg-accent-hover disabled:opacity-50"
            >
              {loading ? "Analyzing…" : "Analyze"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
