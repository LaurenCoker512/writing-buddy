"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatPanelProps {
  documentId: string;
}

export default function ChatPanel({ documentId }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatSummary, setChatSummary] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [noApiKey, setNoApiKey] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadHistory() {
      try {
        const res = await fetch(`/api/documents/${documentId}/messages`);
        if (res.ok) {
          const data = (await res.json()) as {
            messages: Array<{ role: string; content: string }>;
            chatSummary: string | null;
          };
          const loaded = data.messages.filter(
            (m): m is Message => m.role === "user" || m.role === "assistant",
          );
          setMessages(loaded);
          setChatSummary(data.chatSummary);
        }
      } finally {
        setIsLoadingHistory(false);
      }
    }
    void loadHistory();
  }, [documentId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage() {
    const content = input.trim();
    if (!content || isStreaming) return;

    setMessages((prev) => [...prev, { role: "user", content }]);
    setInput("");
    setIsStreaming(true);
    setNoApiKey(false);
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId, content }),
      });

      if (response.status === 402) {
        setNoApiKey(true);
        setMessages((prev) => prev.slice(0, -1));
        return;
      }

      if (!response.ok || !response.body) {
        setMessages((prev) => [
          ...prev.slice(0, -1),
          { role: "assistant", content: "Something went wrong. Please try again." },
        ]);
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
              setMessages((prev) => [
                ...prev.slice(0, -1),
                { role: "assistant", content: assistantContent },
              ]);
            }
          } catch {
            // ignore malformed SSE lines
          }
        }
      }
    } catch {
      setMessages((prev) => [
        ...prev.slice(0, -1),
        { role: "assistant", content: "Something went wrong. Please try again." },
      ]);
    } finally {
      setIsStreaming(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-border bg-surface px-6 py-4">
        <h2 className="flex items-center gap-2 font-heading text-lg font-semibold text-text-primary">
          <span className="text-accent-ai" aria-hidden="true">✦</span>
          AI Chat
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {isLoadingHistory && (
          <p className="py-8 text-center text-sm text-text-muted">Loading chat history…</p>
        )}

        {!isLoadingHistory && messages.length === 0 && !noApiKey && (
          <p className="py-8 text-center text-sm text-text-muted">
            Ask me anything about your document.
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
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                    message.role === "user"
                      ? "bg-accent text-white"
                      : "border border-border bg-surface text-text-primary"
                  }`}
                >
                  {isStreaming && index === messages.length - 1 && !message.content ? (
                    <span
                      className="inline-block h-4 w-2 animate-pulse bg-text-muted"
                      aria-label="Loading response"
                    />
                  ) : (
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="shrink-0 border-t border-border p-4">
        <div className="flex gap-2">
          <textarea
            className="flex-1 resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent"
            placeholder="Ask anything about your document…"
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
            aria-label="Chat message input"
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
      </div>
    </div>
  );
}
