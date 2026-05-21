"use client";

import { useCallback, useRef, useState } from "react";

interface SplitViewProps {
  left: React.ReactNode;
  right: React.ReactNode;
}

const MIN_PANEL_PERCENT = 20;

export default function SplitView({ left, right }: SplitViewProps) {
  const [mobilePanel, setMobilePanel] = useState<"left" | "right">("left");
  const containerRef = useRef<HTMLDivElement>(null);
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const onDividerPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      isDragging.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      e.preventDefault();
    },
    [],
  );

  const onDividerPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging.current || !containerRef.current || !leftPanelRef.current)
        return;
      const rect = containerRef.current.getBoundingClientRect();
      const percent = ((e.clientX - rect.left) / rect.width) * 100;
      const clamped = Math.min(
        Math.max(percent, MIN_PANEL_PERCENT),
        100 - MIN_PANEL_PERCENT,
      );
      leftPanelRef.current.style.width = `${clamped}%`;
      e.preventDefault();
    },
    [],
  );

  const onDividerPointerUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  return (
    <div className="flex h-full flex-col">
      {/* Mobile tabs */}
      <div
        className="flex shrink-0 border-b border-border bg-surface md:hidden"
        role="tablist"
        aria-label="Workspace panels"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mobilePanel === "left"}
          aria-controls="split-panel-editor"
          onClick={() => setMobilePanel("left")}
          className={`flex-1 py-2 text-sm font-medium transition-colors ${
            mobilePanel === "left"
              ? "border-b-2 border-accent text-accent"
              : "text-text-muted hover:text-text-primary"
          }`}
        >
          Editor
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mobilePanel === "right"}
          aria-controls="split-panel-chat"
          onClick={() => setMobilePanel("right")}
          className={`flex-1 py-2 text-sm font-medium transition-colors ${
            mobilePanel === "right"
              ? "border-b-2 border-accent text-accent"
              : "text-text-muted hover:text-text-primary"
          }`}
        >
          AI Chat
        </button>
      </div>

      {/* Panels */}
      <div
        ref={containerRef}
        className="flex min-h-0 flex-1 flex-col lg:flex-row"
      >
        {/* Editor panel */}
        <div
          ref={leftPanelRef}
          id="split-panel-editor"
          role="tabpanel"
          aria-label="Editor"
          data-testid="editor-panel"
          className={`min-h-0 overflow-auto md:flex-1 lg:w-1/2 lg:flex-none ${
            mobilePanel === "right" ? "hidden md:block" : ""
          }`}
        >
          {left}
        </div>

        {/* Draggable divider (desktop only) */}
        <div
          role="separator"
          aria-label="Resize panels"
          aria-orientation="vertical"
          data-testid="split-divider"
          onPointerDown={onDividerPointerDown}
          onPointerMove={onDividerPointerMove}
          onPointerUp={onDividerPointerUp}
          className="hidden w-px shrink-0 cursor-col-resize bg-border transition-colors hover:bg-accent/40 lg:block"
        />

        {/* AI Chat panel */}
        <div
          id="split-panel-chat"
          role="tabpanel"
          aria-label="AI Chat"
          data-testid="chat-panel"
          className={`min-h-0 overflow-auto md:flex-1 lg:flex-1 ${
            mobilePanel === "left" ? "hidden md:block" : ""
          }`}
        >
          {right}
        </div>
      </div>
    </div>
  );
}
