"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import type { DiffProposal } from "@/types/diff";
import { parseInlineBadges } from "@/lib/canon-badge";
import { DOCUMENT_TYPE_LABELS } from "@/lib/documents";
import { TrashIcon, FeatherIcon, SendIcon } from "@/components/icons";
import ContextPickerModal from "@/components/ContextPickerModal";

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
      <div className="flex items-center gap-2.5 rounded-2xl border border-border px-4 py-3" style={{ backgroundColor: "var(--paper)" }}>
        <div className="flex gap-1" aria-label="Margin is thinking" role="status">
          {[0, 150, 300].map((delay) => (
            <span
              key={delay}
              className="h-1.5 w-1.5 rounded-full"
              style={{
                backgroundColor: "var(--muted-2)",
                animation: `bob 1.2s ease-in-out ${delay}ms infinite`,
              }}
            />
          ))}
        </div>
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
  const [showContextModal, setShowContextModal] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [items]);

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

  return (
    <div className="flex h-full flex-col">
      {/* Margin persona header */}
      <div className="shrink-0 border-b border-border px-5 py-4" style={{ backgroundColor: "var(--surface)" }}>
        <div className="flex items-center gap-2.5">
          <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]" style={{ background: "linear-gradient(140deg, var(--ai-soft), var(--ai))" }}>
            <FeatherIcon className="h-4 w-4 text-white" />
            <span className="pulse-dot absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-surface" style={{ backgroundColor: "var(--ai)" }} aria-hidden="true" />
          </div>
          <div>
            <div className="font-heading text-[16px] font-medium leading-tight text-text-primary">Margin</div>
            <div className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-text-muted">Co-writer · listening</div>
          </div>
        </div>
        <p className="mt-2.5 font-heading italic text-[13.5px] leading-relaxed text-text-soft">
          Ask me anything about your document, or give an edit instruction.
        </p>
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
                    className={`max-w-[82%] rounded-2xl px-4 py-2.5 text-[13px] leading-relaxed ${
                      item.role === "user"
                        ? "rounded-br-sm text-[#FBF1E5]"
                        : "border border-border text-text-primary"
                    }`}
                    style={item.role === "user" ? { backgroundColor: "var(--accent)" } : { backgroundColor: "var(--paper)" }}
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

      {/* Composer */}
      <div className="shrink-0 border-t border-border p-3.5" style={{ backgroundColor: "var(--surface)" }}>
        {/* Context chips */}
        <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
          <span className="flex items-center rounded-full border border-accent-soft px-2.5 py-1 text-xs font-medium" style={{ backgroundColor: "var(--ai-soft)", color: "var(--ai-deep)" }}>
            Current document
          </span>
          {contextDocs.map((doc) => {
            const typeLabel = DOCUMENT_TYPE_LABELS[doc.type as keyof typeof DOCUMENT_TYPE_LABELS] ?? doc.type;
            return (
              <span key={doc.id} className="flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs text-text-primary" style={{ backgroundColor: "var(--paper)" }}>
                <span className="text-text-muted">{typeLabel}</span>
                {doc.name}
                <button
                  onClick={() => setContextDocs((prev) => prev.filter((d) => d.id !== doc.id))}
                  className="ml-0.5 leading-none text-text-muted hover:text-text-primary"
                  aria-label={`Remove ${doc.name} from context`}
                >
                  ×
                </button>
              </span>
            );
          })}
          <button
            onClick={() => setShowContextModal(true)}
            className="rounded-full border border-dashed border-accent-ai px-2.5 py-1 text-xs transition hover:bg-accent-ai-soft"
            style={{ color: "var(--ai-deep)" }}
          >
            + Add context
          </button>
        </div>

        {/* Textarea wrapper + tone pills + send button */}
        <div className="rounded-2xl border border-border p-2 transition focus-within:border-accent-ai focus-within:ring-2 focus-within:ring-accent-ai/20" style={{ backgroundColor: "var(--paper)" }}>
          <textarea
            className="w-full resize-none border-0 bg-transparent px-1 py-0.5 text-[13px] leading-relaxed text-text-primary placeholder:font-heading placeholder:italic placeholder:text-text-muted focus:outline-none"
            placeholder="Tell Margin what you're stuck on…"
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
          <div className="flex items-center gap-1.5 pt-1">
            <button
              onClick={() => void sendMessage()}
              disabled={isStreaming || !input.trim()}
              className="ml-auto inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[12px] font-medium text-white shadow-sm transition hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
              style={{ backgroundColor: "var(--ai)" }}
              aria-label="Send message"
            >
              <SendIcon className="h-3 w-3" /> Send
            </button>
          </div>
        </div>
      </div>

      {showContextModal && (
        <ContextPickerModal
          documentId={documentId}
          storyId={storyId}
          seriesId={seriesId}
          universeId={universeId}
          initialSelectedIds={new Set(contextDocs.map((d) => d.id))}
          onConfirm={(docs) => {
            setContextDocs(docs);
            setShowContextModal(false);
          }}
          onClose={() => setShowContextModal(false)}
        />
      )}
    </div>
  );
}
