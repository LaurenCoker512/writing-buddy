"use client";

import type { DiffProposal } from "@/types/diff";

interface DiffCardProps {
  proposal: DiffProposal;
  onAccept: (proposal: DiffProposal) => void;
  onReject: (id: string) => void;
}

export default function DiffCard({ proposal, onAccept, onReject }: DiffCardProps) {
  const title = proposal.isNew ? "New section" : `Edit: ${proposal.heading}`;

  return (
    <div
      className="overflow-hidden rounded-lg border border-accent/30 bg-surface text-sm"
      role="region"
      aria-label={`Proposed edit: ${title}`}
    >
      <div className="border-b border-accent/20 bg-accent/5 px-4 py-2">
        <span className="text-xs font-semibold text-accent">{title}</span>
      </div>

      {!proposal.isNew && proposal.beforeMarkdown && (
        <div className="border-b border-border px-4 py-3">
          <p className="mb-1 text-xs font-medium text-text-muted">Before</p>
          <pre className="line-clamp-5 whitespace-pre-wrap font-sans text-xs text-text-muted">
            {proposal.beforeMarkdown}
          </pre>
        </div>
      )}

      <div className="px-4 py-3">
        <p className="mb-1 text-xs font-medium text-text-primary">
          {proposal.isNew ? "New content" : "After"}
        </p>
        <pre className="line-clamp-5 whitespace-pre-wrap font-sans text-xs text-text-primary">
          {proposal.newMarkdown}
        </pre>
      </div>

      <div className="flex gap-2 border-t border-border bg-background px-4 py-3">
        <button
          onClick={() => onAccept(proposal)}
          className="flex-1 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-hover"
        >
          Accept
        </button>
        <button
          onClick={() => onReject(proposal.id)}
          className="flex-1 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-text-muted transition-colors hover:bg-surface hover:text-text-primary"
        >
          Reject
        </button>
      </div>
    </div>
  );
}
