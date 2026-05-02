"use client";

import type { AnalysisSection } from "@/types/analysis";

interface AnalysisCardProps {
  sections: AnalysisSection[];
}

export default function AnalysisCard({ sections }: AnalysisCardProps) {
  return (
    <div
      className="overflow-hidden rounded-lg border border-border bg-surface text-sm"
      role="region"
      aria-label="Analysis results"
    >
      <div className="border-b border-border bg-surface px-4 py-2">
        <span className="text-xs font-semibold text-text-muted">Analysis</span>
      </div>
      <div className="px-4 py-3">
        {sections.map((section, index) => (
          <div key={section.heading} className={index > 0 ? "mt-4 border-t border-border/50 pt-4" : ""}>
            <p className="mb-1.5 text-xs font-semibold text-text-primary">{section.heading}</p>
            <p className="select-text whitespace-pre-wrap text-xs leading-relaxed text-text-muted">
              {section.content}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
