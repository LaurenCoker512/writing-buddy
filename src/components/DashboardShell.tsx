"use client";

import { useState } from "react";
import Sidebar from "./Sidebar";
import { HamburgerIcon, GlobeIcon, LayersIcon, BookIcon, FileIcon, UsersIcon, HeartLinkIcon, MountainIcon, NoteIcon, CompassIcon, BrainstormIcon } from "./icons";
import { BreadcrumbProvider, useBreadcrumbs, type BreadcrumbItem } from "@/contexts/BreadcrumbContext";

interface DashboardShellProps {
  children: React.ReactNode;
  displayName: string;
}

const KIND_ICONS: Record<BreadcrumbItem["kind"], React.FC<{ className?: string }>> = {
  universe: GlobeIcon,
  series: LayersIcon,
  story: BookIcon,
  document: FileIcon,
};

const DOC_TYPE_ICONS: Record<string, React.FC<{ className?: string }>> = {
  CHARACTER: UsersIcon,
  RELATIONSHIP: HeartLinkIcon,
  WORLDBUILDING: MountainIcon,
  PLOT: CompassIcon,
  SCENE: FileIcon,
  BRAINSTORM: BrainstormIcon,
  OTHER: NoteIcon,
};

function Breadcrumbs() {
  const { crumbs } = useBreadcrumbs();
  if (crumbs.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="hidden md:flex items-center gap-2 min-w-0 flex-1">
      {crumbs.map((crumb, index) => {
        const isLast = index === crumbs.length - 1;
        const IconComponent =
          crumb.kind === "document" && crumb.docType
            ? (DOC_TYPE_ICONS[crumb.docType] ?? FileIcon)
            : KIND_ICONS[crumb.kind];
        return (
          <span key={index} className="flex items-center gap-2 min-w-0">
            {index > 0 && (
              <span className="shrink-0 font-mono text-[11px] text-text-muted/50" aria-hidden="true">/</span>
            )}
            <span className="flex items-center gap-1.5 text-[12.5px] text-text-muted truncate">
              <IconComponent className="h-[13px] w-[13px] shrink-0" />
              <span className={`truncate ${isLast ? "text-text-soft" : ""}`}>{crumb.label}</span>
            </span>
          </span>
        );
      })}
    </nav>
  );
}

function Shell({ children, displayName }: DashboardShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: "var(--bg)" }}>
      <Sidebar
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
        displayName={displayName}
      />

      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        {/* Top bar */}
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-5" style={{ backgroundColor: "var(--surface)" }}>
          <button
            onClick={() => setMobileOpen(true)}
            className="shrink-0 rounded-lg p-1.5 text-text-muted hover:bg-surface-2 md:hidden"
            aria-label="Open sidebar"
            data-testid="hamburger-btn"
          >
            <HamburgerIcon className="h-5 w-5" />
          </button>
          <span className="font-heading text-base font-medium text-text-primary md:hidden">
            Writing Buddy
          </span>
          <Breadcrumbs />
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}

export default function DashboardShell(props: DashboardShellProps) {
  return (
    <BreadcrumbProvider>
      <Shell {...props} />
    </BreadcrumbProvider>
  );
}
