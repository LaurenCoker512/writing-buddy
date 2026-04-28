"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import DiffCard from "@/components/DiffCard";
import type { DiffProposal } from "@/types/diff";
import { parseInlineBadges } from "@/lib/canon-badge";
import { TrashIcon } from "@/components/icons";

type ChatMessage = { kind: "message"; key: string; id?: string; role: "user" | "assistant"; content: string };
type DiffItem = { kind: "diff"; key: string; proposal: DiffProposal };
type ChatItem = ChatMessage | DiffItem;

interface ChatPanelProps {
  documentId: string;
  onAcceptDiff: (proposal: DiffProposal) => Promise<void>;
  initialDiffProposals?: DiffProposal[];
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

export default function ChatPanel({ documentId, onAcceptDiff, initialDiffProposals }: ChatPanelProps) {
  const [items, setItems] = useState<ChatItem[]>([]);
  const [chatSummary, setChatSummary] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isRequestingDiff, setIsRequestingDiff] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [noApiKey, setNoApiKey] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const keyCounter = useRef(0);

  function nextKey() {
    return String(keyCounter.current++);
  }

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
          const pendingDiffs: ChatItem[] = (initialDiffProposals ?? []).map((proposal) => ({
            kind: "diff",
            key: nextKey(),
            proposal,
          }));
          setItems([...loaded, ...pendingDiffs]);
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
    if (!content || isStreaming || isRequestingDiff) return;

    const userKey = nextKey();
    const assistantKey = nextKey();
    setItems((prev) => [
      ...prev,
      { kind: "message", key: userKey, role: "user", content },
      { kind: "message", key: assistantKey, role: "assistant", content: "" },
    ]);
    setInput("");
    setIsStreaming(true);
    setNoApiKey(false);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId, content }),
      });

      if (response.status === 402) {
        setNoApiKey(true);
        setItems((prev) => prev.filter((item) => item.key !== userKey && item.key !== assistantKey));
        return;
      }

      if (!response.ok || !response.body) {
        setItems((prev) =>
          prev.map((item) =>
            item.key === assistantKey
              ? { ...item, content: "Something went wrong. Please try again." }
              : item,
          ),
        );
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") break;

          try {
            const parsed = JSON.parse(data) as {
              choices?: Array<{ delta?: { content?: string } }>;
            };
            const delta = parsed.choices?.[0]?.delta?.content ?? "";
            if (delta) {
              assistantContent += delta;
              setItems((prev) =>
                prev.map((item) =>
                  item.key === assistantKey ? { ...item, content: assistantContent } : item,
                ),
              );
            }
          } catch {
            // ignore malformed SSE lines
          }
        }
      }
    } catch {
      setItems((prev) =>
        prev.map((item) =>
          item.key === assistantKey
            ? { ...item, content: "Something went wrong. Please try again." }
            : item,
        ),
      );
    } finally {
      setIsStreaming(false);
    }
  }

  async function requestEdit() {
    const instruction = input.trim();
    if (!instruction || isStreaming || isRequestingDiff) return;

    setInput("");
    setIsRequestingDiff(true);
    setNoApiKey(false);

    const userKey = nextKey();
    setItems((prev) => [
      ...prev,
      { kind: "message", key: userKey, role: "user", content: `[Edit request] ${instruction}` },
    ]);

    try {
      const response = await fetch("/api/ai/diff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId, instruction }),
      });

      if (response.status === 402) {
        setNoApiKey(true);
        setItems((prev) => prev.filter((item) => item.key !== userKey));
        return;
      }

      if (!response.ok) {
        setItems((prev) => [
          ...prev,
          {
            kind: "message",
            key: nextKey(),
            role: "assistant",
            content: "Could not generate edit proposals. Please try again.",
          },
        ]);
        return;
      }

      const data = (await response.json()) as { proposals?: DiffProposal[] };
      const proposals = data.proposals ?? [];

      if (proposals.length === 0) {
        setItems((prev) => [
          ...prev,
          {
            kind: "message",
            key: nextKey(),
            role: "assistant",
            content: "No edit proposals were generated. Try rephrasing your instruction.",
          },
        ]);
        return;
      }

      setItems((prev) => [
        ...prev,
        ...proposals.map(
          (proposal): DiffItem => ({ kind: "diff", key: nextKey(), proposal }),
        ),
      ]);
    } catch {
      setItems((prev) => [
        ...prev,
        {
          kind: "message",
          key: nextKey(),
          role: "assistant",
          content: "Something went wrong. Please try again.",
        },
      ]);
    } finally {
      setIsRequestingDiff(false);
    }
  }

  async function handleAccept(proposal: DiffProposal) {
    setItems((prev) => prev.filter((item) => !(item.kind === "diff" && item.proposal.id === proposal.id)));
    await onAcceptDiff(proposal);
  }

  function handleReject(proposalId: string) {
    setItems((prev) => prev.filter((item) => !(item.kind === "diff" && item.proposal.id === proposalId)));
  }

  async function deleteMessage(messageId: string, itemKey: string) {
    await fetch(`/api/documents/${documentId}/messages/${messageId}`, { method: "DELETE" });
    setItems((prev) => prev.filter((item) => item.key !== itemKey));
  }

  const isBusy = isStreaming || isRequestingDiff;

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-border bg-surface px-6 py-4">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 font-heading text-lg font-semibold text-text-primary">
            <span className="text-accent-ai" aria-hidden="true">✦</span>
            AI Chat
          </h2>
          <div className="flex rounded-lg border border-border text-xs font-medium overflow-hidden">
            <button
              onClick={() => setEditMode(false)}
              className={`px-3 py-1.5 transition-colors ${
                !editMode ? "bg-accent text-white" : "text-text-muted hover:text-text-primary"
              }`}
              aria-pressed={!editMode}
            >
              Chat
            </button>
            <button
              onClick={() => setEditMode(true)}
              className={`px-3 py-1.5 transition-colors ${
                editMode ? "bg-accent text-white" : "text-text-muted hover:text-text-primary"
              }`}
              aria-pressed={editMode}
            >
              Edit
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {isLoadingHistory && (
          <p className="py-8 text-center text-sm text-text-muted">Loading chat history…</p>
        )}

        {!isLoadingHistory && items.length === 0 && !noApiKey && (
          <p className="py-8 text-center text-sm text-text-muted">
            {editMode
              ? "Describe the edits you want to make to your document."
              : "Ask me anything about your document."}
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
              if (item.kind === "diff") {
                return (
                  <DiffCard
                    key={item.key}
                    proposal={item.proposal}
                    onAccept={(proposal) => void handleAccept(proposal)}
                    onReject={handleReject}
                  />
                );
              }

              const isLastStreaming = isStreaming && index === items.length - 1;
              const deleteBtn = item.id && !isLastStreaming ? (
                <button
                  onClick={() => void deleteMessage(item.id!, item.key)}
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
                    {isLastStreaming && !item.content ? (
                      <span
                        className="inline-block h-4 w-2 animate-pulse bg-text-muted"
                        aria-label="Loading response"
                      />
                    ) : item.role === "assistant" ? (
                      <AssistantMessageContent content={item.content} />
                    ) : (
                      <p className="whitespace-pre-wrap">{item.content}</p>
                    )}
                  </div>
                  {item.role === "assistant" && deleteBtn}
                </div>
              );
            })}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="shrink-0 border-t border-border p-4">
        <div className="flex gap-2">
          <textarea
            className="flex-1 resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent"
            placeholder={
              editMode
                ? "Describe the edits you want…"
                : "Ask anything about your document…"
            }
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void (editMode ? requestEdit() : sendMessage());
              }
            }}
            disabled={isBusy}
            aria-label={editMode ? "Edit instruction input" : "Chat message input"}
          />
          <button
            onClick={() => void (editMode ? requestEdit() : sendMessage())}
            disabled={isBusy || !input.trim()}
            className="shrink-0 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={editMode ? "Request edit" : "Send message"}
          >
            {editMode ? "Edit" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
