"use client";

import { useState } from "react";
import { nanoid } from "nanoid";
import { AI_CONFIG } from "@/config/ai";

interface LoglineCard {
  id: string;
  text: string;
}

interface BrainstormResponse {
  loglines?: string[];
  error?: string;
  message?: string;
}

type Mode = "ORIGINAL" | "FANFIC";

async function fetchLoglines(
  mode: Mode,
  sourceTitle: string,
  seed: string,
): Promise<string[]> {
  const res = await fetch("/api/brainstorm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode, sourceTitle: sourceTitle || undefined, seed: seed || undefined }),
  });

  const data = (await res.json()) as BrainstormResponse;

  if (!res.ok) {
    throw new Error(data.message ?? data.error ?? "Failed to generate loglines");
  }

  return data.loglines ?? [];
}

function SparkleIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="h-4 w-4 shrink-0"
      aria-hidden="true"
    >
      <path d="M8 1v14M1 8h14M4.2 4.2l7.6 7.6M11.8 4.2l-7.6 7.6" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="h-4 w-4 shrink-0"
      aria-hidden="true"
    >
      <path d="M13.5 2.5A6.5 6.5 0 1 1 2.5 8" />
      <path d="M1 2.5h3.5V6" />
    </svg>
  );
}

function SaveIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="h-4 w-4 shrink-0"
      aria-hidden="true"
    >
      <rect x="2" y="1.5" width="12" height="13" rx="1" />
      <path d="M5 1.5v4h6v-4" />
      <rect x="4.5" y="9" width="7" height="5" rx="0.5" />
    </svg>
  );
}

export default function BrainstormPage() {
  const [mode, setMode] = useState<Mode>("ORIGINAL");
  const [sourceTitle, setSourceTitle] = useState("");
  const [seed, setSeed] = useState("");
  const [cards, setCards] = useState<LoglineCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [savingId, setSavingId] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const loglines = await fetchLoglines(mode, sourceTitle, seed);
      setCards(loglines.map((text) => ({ id: nanoid(), text })));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function regenerateCard(cardId: string) {
    setRegeneratingId(cardId);
    setError(null);
    try {
      const loglines = await fetchLoglines(mode, sourceTitle, seed);
      if (loglines.length > 0) {
        setCards((prev) =>
          prev.map((card) =>
            card.id === cardId ? { id: cardId, text: loglines[0]! } : card,
          ),
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setRegeneratingId(null);
    }
  }

  async function saveCard(card: LoglineCard) {
    setSavingId(card.id);
    try {
      const res = await fetch("/api/saved-prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: card.text,
          mode,
          sourceTitle: mode === "FANFIC" && sourceTitle ? sourceTitle : undefined,
        }),
      });
      if (res.ok) {
        setSavedIds((prev) => new Set([...Array.from(prev), card.id]));
      }
    } finally {
      setSavingId(null);
    }
  }

  function discardCard(cardId: string) {
    setCards((prev) => prev.filter((card) => card.id !== cardId));
  }

  return (
    <div className="mx-auto max-w-3xl p-8">
      <header className="mb-8">
        <h1 className="font-heading text-3xl font-bold text-text-primary">Brainstorm</h1>
        <p className="mt-1 text-text-muted">Generate story loglines to spark your next project.</p>
      </header>

      <section className="mb-8 space-y-5">
        {/* Mode toggle */}
        <div>
          <label className="mb-2 block text-sm font-medium text-text-primary">Mode</label>
          <div className="flex gap-2">
            <button
              onClick={() => setMode("ORIGINAL")}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                mode === "ORIGINAL"
                  ? "bg-accent text-white"
                  : "border border-border text-text-muted hover:bg-background"
              }`}
              aria-pressed={mode === "ORIGINAL"}
            >
              Original
            </button>
            <button
              onClick={() => setMode("FANFIC")}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                mode === "FANFIC"
                  ? "bg-accent text-white"
                  : "border border-border text-text-muted hover:bg-background"
              }`}
              aria-pressed={mode === "FANFIC"}
            >
              Fanfiction
            </button>
          </div>
        </div>

        {/* Source title — fanfic only */}
        {mode === "FANFIC" && (
          <div>
            <label
              htmlFor="source-title"
              className="mb-1 block text-sm font-medium text-text-primary"
            >
              Source title <span className="text-text-muted">(optional)</span>
            </label>
            <input
              id="source-title"
              type="text"
              value={sourceTitle}
              onChange={(e) => setSourceTitle(e.target.value)}
              placeholder="e.g. Pride and Prejudice"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
        )}

        {/* Seed */}
        <div>
          <label
            htmlFor="seed"
            className="mb-1 block text-sm font-medium text-text-primary"
          >
            Seed idea <span className="text-text-muted">(optional)</span>
          </label>
          <textarea
            id="seed"
            value={seed}
            onChange={(e) => setSeed(e.target.value)}
            placeholder="Describe a theme, character concept, or setting to inspire the loglines…"
            rows={3}
            className="w-full resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={generate}
            disabled={loading}
            data-testid="generate-btn"
            className="flex items-center gap-2 rounded-lg bg-accent px-5 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <SparkleIcon />
            {loading ? "Generating…" : "Generate"}
          </button>

          {cards.length > 0 && !loading && (
            <button
              onClick={generate}
              className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm text-text-muted transition-colors hover:bg-background"
              aria-label="Regenerate all loglines"
            >
              <RefreshIcon />
              Regenerate all
            </button>
          )}
        </div>
      </section>

      {error !== null && (
        <div
          role="alert"
          className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {cards.length > 0 && (
        <section aria-label="Generated loglines">
          <p className="mb-4 text-sm text-text-muted">
            {cards.length} of {AI_CONFIG.BRAINSTORM_LOGLINE_COUNT} loglines
          </p>
          <ul className="space-y-4" data-testid="logline-list">
            {cards.map((card) => {
              const isSaved = savedIds.has(card.id);
              const isRegenerating = regeneratingId === card.id;
              const isSaving = savingId === card.id;

              return (
                <li
                  key={card.id}
                  data-testid="logline-card"
                  className="rounded-xl border border-border bg-surface p-4 shadow-sm"
                >
                  <p className="text-sm leading-relaxed text-text-primary">{card.text}</p>

                  <div className="mt-3 flex items-center gap-2">
                    <button
                      onClick={() => saveCard(card)}
                      disabled={isSaved || isSaving}
                      className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                        isSaved
                          ? "bg-green-100 text-green-700"
                          : "border border-border text-text-muted hover:bg-background disabled:opacity-50"
                      }`}
                    >
                      <SaveIcon />
                      {isSaved ? "Saved" : isSaving ? "Saving…" : "Save to Library"}
                    </button>

                    <button
                      onClick={() => regenerateCard(card.id)}
                      disabled={isRegenerating || loading}
                      aria-label="Regenerate this logline"
                      className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-text-muted transition-colors hover:bg-background disabled:opacity-50"
                    >
                      <RefreshIcon />
                      {isRegenerating ? "Regenerating…" : "Regenerate"}
                    </button>

                    <button
                      onClick={() => discardCard(card.id)}
                      disabled={isRegenerating}
                      data-testid="discard-btn"
                      className="ml-auto rounded-md px-3 py-1.5 text-xs text-text-muted transition-colors hover:bg-background hover:text-red-500"
                    >
                      Discard
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
