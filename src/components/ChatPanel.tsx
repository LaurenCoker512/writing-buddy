"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import type { DiffProposal } from "@/types/diff";
import { parseInlineBadges } from "@/lib/canon-badge";
import { DOCUMENT_TYPE_LABELS } from "@/lib/documents";
import { TrashIcon } from "@/components/icons";

type CollabContextDoc = { id: string; name: string; type: string };

type ChatMessage = { kind: "message"; key: string; id?: string; role: "user" | "assistant"; content: string };
type ChatItem = ChatMessage;

const MESSAGE_COLLAPSE_THRESHOLD = 400;

interface ChatPanelProps {
  documentId: string;
  storyId: string | null;
  seriesId: string | null;
  universeId: string | null;
  onDiffProposals: (proposals: DiffProposal[]) => void;
}

function ThinkingSpinner() {
  return (
    <div className="flex justify-start">
      <div className="rounded-2xl border border-border bg-surface px-4 py-3">
        <span
          className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-text-muted border-t-transparent"
          aria-label="Waiting for response"
          role="status"
        />
      </div>
    </div>
  );
}

function AssistantMessageContent({ content }: { content: string }) {
  const segments = parseInlineBadges(content);
  return (
    <p className="whitespace-pre-wrap">
      {segments.map((seg, index) => {
        if (seg.type === "canon") {
          return (
            <span
              key={index}
              className="mx-0.5 inline-block rounded border border-amber-300 bg-amber-50 px-1 py-0.5 text-[10px] font-bold leading-none text-amber-700"
            >
              Canon
            </span>
          );
        }
        if (seg.type === "au") {
          return (
            <span
              key={index}
              className="mx-0.5 inline-block rounded border border-indigo-300 bg-indigo-50 px-1 py-0.5 text-[10px] font-bold leading-none text-indigo-700"
            >
              AU
            </span>
          );
        }
        return <span key={index}>{seg.content}</span>;
      })}
    </p>
  );
}

export default function ChatPanel({
  documentId,
  storyId,
  seriesId,
  universeId,
  onDiffProposals,
}: ChatPanelProps) {
  const [items, setItems] = useState<ChatItem[]>([]);
  const [chatSummary, setChatSummary] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [noApiKey, setNoApiKey] = useState(false);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const [contextDocs, setContextDocs] = useState<CollabContextDoc[]>([]);
  const [availableDocs, setAvailableDocs] = useState<CollabContextDoc[]>([]);
  const [showDocPicker, setShowDocPicker] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const keyCounter = useRef(0);

  function nextKey() {
    return String(keyCounter.current++);
  }

  function toggleExpanded(key: string) {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // Load chat history
  useEffect(() => {
    async function loadHistory() {
      try {
        const res = await fetch(`/api/documents/${documentId}/messages`);
        if (res.ok) {
          const data = (await res.json()) as {
            messages: Array<{ id: string; role: string; content: string }>;
            chatSummary: string | null;
          };
          const loaded: ChatItem[] = data.messages
            .filter((m): m is { id: string; role: "user" | "assistant"; content: string } =>
              m.role === "user" || m.role === "assistant",
            )
            .map((m) => ({ kind: "message", key: nextKey(), id: m.id, role: m.role, content: m.content }));
          setItems(loaded);
          setChatSummary(data.chatSummary);
        }
      } finally {
        setIsLoadingHistory(false);
      }
    }
    void loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId]);

  // Fetch available context docs from most specific scope
  useEffect(() => {
    const scopeParam = storyId
      ? `storyId=${storyId}`
      : seriesId
        ? `seriesId=${seriesId}`
        : universeId
          ? `universeId=${universeId}`
          : null;

    if (!scopeParam) return;

    fetch(`/api/documents?${scopeParam}`)
      .then(async (res) => {
        if (!res.ok) return;
        const docs = (await res.json()) as Array<{ id: string; name: string; type: string }>;
        setAvailableDocs(docs.filter((d) => d.id !== documentId));
      })
      .catch(() => undefined);
  }, [documentId, storyId, seriesId, universeId]);

  // Close doc picker on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setShowDocPicker(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [items]);

  function addContextDoc(doc: CollabContextDoc) {
    setContextDocs((prev) => (prev.some((d) => d.id === doc.id) ? prev : [...prev, doc]));
    setShowDocPicker(false);
  }

  function removeContextDoc(docId: string) {
    setContextDocs((prev) => prev.filter((d) => d.id !== docId));
  }

  async function sendMessage() {
    const content = input.trim();
    if (!content || isStreaming) return;

    const userKey = nextKey();

    setItems((prev) => [...prev, { kind: "message", key: userKey, role: "user", content }]);
    setInput("");
    setIsStreaming(true);
    setNoApiKey(false);

    try {
      const response = await fetch("/api/ai/collab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId,
          content,
          additionalDocumentIds: contextDocs.map((d) => d.id),
        }),
      });

      if (response.status === 402) {
        setNoApiKey(true);
        setItems((prev) => prev.filter((item) => item.key !== userKey));
        return;
      }

      if (!response.ok) {
        setItems((prev) => [
          ...prev,
          { kind: "message", key: nextKey(), role: "assistant", content: "Something went wrong. Please try again." },
        ]);
        return;
      }

      const data = (await response.json()) as
        | { intent: "edit"; proposals: DiffProposal[] }
        | { intent: "chat"; message: string };

      if (data.intent === "edit") {
        const assistantMsg =
          data.proposals.length > 0
            ? "Proposed edits are shown in the editor. Review and accept or reject each change."
            : "No edit proposals were generated. Try rephrasing your instruction.";

        setItems((prev) => [...prev, { kind: "message", key: nextKey(), role: "assistant", content: assistantMsg }]);

        if (data.proposals.length > 0) {
          onDiffProposals(data.proposals);
        }
        return;
      }

      setItems((prev) => [...prev, { kind: "message", key: nextKey(), role: "assistant", content: data.message }]);
    } catch {
      setItems((prev) => [
        ...prev,
        { kind: "message", key: nextKey(), role: "assistant", content: "Something went wrong. Please try again." },
      ]);
    } finally {
      setIsStreaming(false);
    }
  }

  async function deleteItem(itemKey: string, messageId?: string) {
    if (messageId) {
      await fetch(`/api/documents/${documentId}/messages/${messageId}`, { method: "DELETE" });
    }
    setItems((prev) => prev.filter((item) => item.key !== itemKey));
  }

  const pickerCandidates = availableDocs.filter((doc) => !contextDocs.some((c) => c.id === doc.id));

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-border bg-surface px-6 py-4">
        <h2 className="flex items-center gap-2 font-heading text-lg font-semibold text-text-primary">
          <span className="text-accent-ai" aria-hidden="true">✦</span>
          Collab
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {isLoadingHistory && (
          <p className="py-8 text-center text-sm text-text-muted">Loading chat history…</p>
        )}

        {!isLoadingHistory && items.length === 0 && !noApiKey && (
          <p className="py-8 text-center text-sm text-text-muted">
            Ask a question or give an edit instruction.
          </p>
        )}

        {noApiKey && (
          <div className="rounded-lg border border-border bg-surface p-4 text-center text-sm">
            <p className="mb-1 font-medium text-text-primary">No API key configured</p>
            <p className="text-text-muted">
              Add your{" "}
              <Link href="/settings" className="text-accent underline">
                OpenRouter API key in Settings
              </Link>{" "}
              to use AI features.
            </p>
          </div>
        )}

        {!isLoadingHistory && (
          <div className="flex flex-col gap-4">
            {chatSummary !== null && (
              <p className="text-center text-xs italic text-text-muted">
                Earlier conversation has been summarized.
              </p>
            )}
            {items.map((item, index) => {
              const isLastItem = index === items.length - 1;
              const isLong = item.content.length > MESSAGE_COLLAPSE_THRESHOLD;
              const isExpanded = expandedKeys.has(item.key);
              const deleteBtn = !(isStreaming && isLastItem) ? (
                <button
                  onClick={() => void deleteItem(item.key, item.id)}
                  className="invisible mt-1 shrink-0 rounded p-1 text-text-muted transition-colors hover:bg-background hover:text-red-500 group-hover:visible"
                  aria-label="Delete message"
                >
                  <TrashIcon className="h-3.5 w-3.5" />
                </button>
              ) : null;

              return (
                <div
                  key={item.key}
                  className={`group flex items-start gap-1 ${item.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {item.role === "user" && deleteBtn}
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                      item.role === "user"
                        ? "bg-accent text-white"
                        : "border border-border bg-surface text-text-primary"
                    }`}
                  >
                    <div className={isLong && !isExpanded ? "max-h-40 overflow-hidden" : undefined}>
                      {item.role === "assistant" ? (
                        <AssistantMessageContent content={item.content} />
                      ) : (
                        <p className="whitespace-pre-wrap">{item.content}</p>
                      )}
                    </div>
                    {isLong && (
                      <button
                        onClick={() => toggleExpanded(item.key)}
                        className={`mt-2 text-xs font-medium transition-opacity hover:opacity-100 ${
                          item.role === "user"
                            ? "text-white/70 hover:text-white"
                            : "text-text-muted hover:text-text-primary"
                        }`}
                      >
                        {isExpanded ? "Show less" : "Show more"}
                      </button>
                    )}
                  </div>
                  {item.role === "assistant" && deleteBtn}
                </div>
              );
            })}
            {isStreaming && <ThinkingSpinner />}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="shrink-0 border-t border-border p-4">
        <div className="flex items-end gap-2">
          <textarea
            className="flex-1 resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent"
            placeholder="Ask anything or give an edit instruction…"
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void sendMessage();
              }
            }}
            disabled={isStreaming}
            aria-label="Message input"
          />
          <button
            onClick={() => void sendMessage()}
            disabled={isStreaming || !input.trim()}
            className="shrink-0 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Send message"
          >
            Send
          </button>
        </div>

        {/* Context chips */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="flex items-center rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-text-muted">
            Current document
          </span>

          {contextDocs.map((doc) => {
            const typeLabel = DOCUMENT_TYPE_LABELS[doc.type as keyof typeof DOCUMENT_TYPE_LABELS] ?? doc.type;
            return (
              <span
                key={doc.id}
                className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-xs text-text-primary"
              >
                <span className="text-text-muted">{typeLabel}</span>
                {doc.name}
                <button
                  onClick={() => removeContextDoc(doc.id)}
                  className="ml-0.5 leading-none text-text-muted hover:text-text-primary"
                  aria-label={`Remove ${doc.name} from context`}
                >
                  ×
                </button>
              </span>
            );
          })}

          {pickerCandidates.length > 0 && (
            <div ref={pickerRef} className="relative">
              <button
                onClick={() => setShowDocPicker((prev) => !prev)}
                className="rounded-full border border-dashed border-border px-2.5 py-1 text-xs text-text-muted transition-colors hover:text-text-primary"
              >
                + Add context
              </button>

              {showDocPicker && (
                <div className="absolute bottom-full left-0 z-10 mb-1 max-h-48 w-56 overflow-y-auto rounded-lg border border-border bg-surface shadow-lg">
                  {pickerCandidates.map((doc) => {
                    const typeLabel =
                      DOCUMENT_TYPE_LABELS[doc.type as keyof typeof DOCUMENT_TYPE_LABELS] ?? doc.type;
                    return (
                      <button
                        key={doc.id}
                        onClick={() => addContextDoc(doc)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-background"
                      >
                        <span className="shrink-0 text-xs text-text-muted">{typeLabel}</span>
                        <span className="truncate">{doc.name}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
