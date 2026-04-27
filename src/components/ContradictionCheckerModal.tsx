"use client";

import { useEffect, useState } from "react";
import type { ContradictionIssue } from "@/app/api/ai/contradiction-check/route";

type Phase = "estimating" | "confirming" | "checking" | "results" | "error";

interface ContradictionCheckerModalProps {
  storyId: string;
  storyName?: string;
  onClose: () => void;
}

export default function ContradictionCheckerModal({
  storyId,
  storyName,
  onClose,
}: ContradictionCheckerModalProps) {
  const [phase, setPhase] = useState<Phase>("estimating");
  const [tokenEstimate, setTokenEstimate] = useState(0);
  const [issues, setIssues] = useState<ContradictionIssue[]>([]);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function fetchEstimate() {
      try {
        const res = await fetch("/api/ai/contradiction-check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ storyId, estimateOnly: true }),
        });
        if (!res.ok) {
          const data = (await res.json()) as { error?: string; message?: string };
          setErrorMessage(data.message ?? data.error ?? "Failed to estimate tokens.");
          setPhase("error");
          return;
        }
        const data = (await res.json()) as { tokenEstimate: number };
        setTokenEstimate(data.tokenEstimate);
        setPhase("confirming");
      } catch {
        setErrorMessage("Network error. Please try again.");
        setPhase("error");
      }
    }
    void fetchEstimate();
  }, [storyId]);

  async function handleConfirm() {
    setPhase("checking");
    try {
      const res = await fetch("/api/ai/contradiction-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyId }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string; message?: string };
        setErrorMessage(data.message ?? data.error ?? "Check failed.");
        setPhase("error");
        return;
      }
      const data = (await res.json()) as { issues: ContradictionIssue[] };
      setIssues(data.issues);
      setPhase("results");
    } catch {
      setErrorMessage("Network error. Please try again.");
      setPhase("error");
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-lg border border-border bg-surface p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        data-testid="contradiction-checker-modal"
      >
        <h2 className="mb-1 font-heading text-lg font-semibold text-text-primary">
          Contradiction Checker
        </h2>
        {storyName !== undefined && storyName !== "" && (
          <p className="mb-3 text-sm text-text-muted">{storyName}</p>
        )}

        {phase === "estimating" && (
          <p className="text-sm text-text-muted" data-testid="contradiction-estimating">
            Estimating token usage…
          </p>
        )}

        {phase === "confirming" && (
          <>
            <p className="mb-2 text-sm text-text-primary">
              This check will use approximately{" "}
              <span className="font-semibold">{tokenEstimate.toLocaleString()}</span> tokens.
            </p>
            <p className="mb-6 text-sm text-text-muted">
              The AI will review your story documents for contradictions and inconsistencies.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded px-4 py-2 text-sm text-text-muted hover:bg-background"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleConfirm()}
                data-testid="contradiction-confirm-button"
                className="rounded bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90"
              >
                Run Check
              </button>
            </div>
          </>
        )}

        {phase === "checking" && (
          <p className="text-sm text-text-muted" data-testid="contradiction-checking">
            Checking for contradictions…
          </p>
        )}

        {phase === "results" && (
          <>
            {issues.length === 0 ? (
              <p
                className="mb-4 text-sm text-text-primary"
                data-testid="contradiction-no-issues"
              >
                No contradictions found. Your story documents are consistent.
              </p>
            ) : (
              <ul
                className="mb-4 max-h-96 space-y-2 overflow-y-auto"
                data-testid="contradiction-issues-list"
              >
                {issues.map((issue, index) => (
                  <li
                    key={index}
                    className="rounded border border-border bg-background p-3"
                    data-testid={`contradiction-issue-${index}`}
                  >
                    <button
                      type="button"
                      className="w-full text-left text-sm font-medium text-text-primary"
                      onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
                      aria-expanded={expandedIndex === index}
                    >
                      {issue.description}
                    </button>
                    {expandedIndex === index && (
                      <div className="mt-2 space-y-1">
                        {issue.documentsInvolved.length > 0 && (
                          <p className="text-xs text-text-muted">
                            Documents:{" "}
                            <span className="text-text-primary">
                              {issue.documentsInvolved.join(", ")}
                            </span>
                          </p>
                        )}
                        <p className="text-xs text-text-muted">
                          Suggestion:{" "}
                          <span className="text-text-primary">{issue.suggestedResolution}</span>
                        </p>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded px-4 py-2 text-sm text-text-muted hover:bg-background"
              >
                Close
              </button>
            </div>
          </>
        )}

        {phase === "error" && (
          <>
            <p className="mb-4 text-sm text-red-600" data-testid="contradiction-error">
              {errorMessage}
            </p>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded px-4 py-2 text-sm text-text-muted hover:bg-background"
              >
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
