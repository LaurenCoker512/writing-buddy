"use client";

import { useEffect, useRef } from "react";

interface ModalProps {
  title?: string;
  onClose: () => void;
  maxWidth?: "sm" | "lg";
  padding?: boolean;
  className?: string;
  zIndex?: string;
  "data-testid"?: string;
  children: React.ReactNode;
}

export default function Modal({
  title,
  onClose,
  maxWidth = "sm",
  padding = true,
  className,
  zIndex = "z-50",
  "data-testid": testId,
  children,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(
          "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])",
        ),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const panelClasses = [
    "w-full rounded-lg border border-border bg-surface shadow-xl",
    maxWidth === "lg" ? "max-w-lg" : "max-w-sm",
    padding ? "p-6" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={`fixed inset-0 flex items-center justify-center bg-black/40 ${zIndex}`}
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        ref={panelRef}
        className={panelClasses}
        onClick={(e) => e.stopPropagation()}
        data-testid={testId}
      >
        {title !== undefined && (
          <h2 className="mb-4 font-heading text-lg font-semibold text-text-primary">{title}</h2>
        )}
        {children}
      </div>
    </div>
  );
}
