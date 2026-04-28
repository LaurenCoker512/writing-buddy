"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import Sidebar from "./Sidebar";
import { HamburgerIcon } from "./icons";

interface DashboardShellProps {
  children: React.ReactNode;
  displayName: string;
}

export default function DashboardShell({
  children,
  displayName,
}: DashboardShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-surface px-4">
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded p-1.5 text-text-muted hover:bg-background md:hidden"
            aria-label="Open sidebar"
            data-testid="hamburger-btn"
          >
            <HamburgerIcon className="h-5 w-5" />
          </button>

          {/* Show app name on mobile (no sidebar) */}
          <span className="font-heading text-base font-bold text-text-primary md:hidden">
            Writing Buddy
          </span>

          <div className="flex items-center gap-3">
            <span className="text-sm text-text-muted">{displayName}</span>
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="rounded border border-border px-3 py-1 text-sm text-text-muted transition-colors hover:bg-background"
            >
              Sign out
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
