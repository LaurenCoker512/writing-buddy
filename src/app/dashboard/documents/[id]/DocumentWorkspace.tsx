"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { DOCUMENT_TYPE_LABELS } from "@/lib/documents";
import type { DocumentTypeValue } from "@/lib/documents";

const TipTapEditor = dynamic(() => import("@/components/TipTapEditor"), {
  ssr: false,
  loading: () => (
    <div className="flex flex-1 items-center justify-center p-8 text-text-muted">
      Loading editor…
    </div>
  ),
});

type SaveStatus = "idle" | "saving" | "saved" | "error";

interface DocumentWorkspaceProps {
  documentId: string;
  documentName: string;
  documentType: string;
  initialJson: object;
}

export default function DocumentWorkspace({
  documentId,
  documentName,
  documentType,
  initialJson,
}: DocumentWorkspaceProps) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const typeLabel = DOCUMENT_TYPE_LABELS[documentType as DocumentTypeValue] ?? documentType;

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-baseline gap-3 border-b border-border bg-surface px-6 py-4">
        <h1 className="font-heading text-xl font-semibold text-text-primary">
          {documentName}
        </h1>
        <span className="text-xs text-text-muted">{typeLabel}</span>
      </div>

      <div className="flex-1 overflow-auto">
        <TipTapEditor
          documentId={documentId}
          initialJson={initialJson}
          documentName={documentName}
          saveStatus={saveStatus}
          onSaveStatusChange={setSaveStatus}
        />
      </div>
    </div>
  );
}
