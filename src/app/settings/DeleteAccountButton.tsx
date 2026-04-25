"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";

export default function DeleteAccountButton() {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setError(null);

    const response = await fetch("/api/account", { method: "DELETE" });

    if (response.ok) {
      await signOut({ callbackUrl: "/" });
    } else {
      setError("Failed to delete account. Please try again.");
      setDeleting(false);
      setConfirming(false);
    }
  }

  if (confirming) {
    return (
      <div className="space-y-3 rounded border border-red-200 bg-red-50 p-4">
        <p className="text-sm font-medium text-red-800">
          This will permanently delete your account and all associated data.
          This cannot be undone.
        </p>
        {error !== null && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        <div className="flex gap-3">
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-60"
          >
            {deleting ? "Deleting…" : "Yes, delete my account"}
          </button>
          <button
            onClick={() => setConfirming(false)}
            disabled={deleting}
            className="rounded border border-border px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-surface disabled:opacity-60"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <section className="space-y-2">
      <h2 className="font-heading text-xl font-semibold text-text-primary">
        Delete account
      </h2>
      <p className="text-sm text-text-muted">
        Permanently removes your account and all of your data.
      </p>
      <button
        onClick={() => setConfirming(true)}
        className="rounded border border-red-300 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
      >
        Delete account
      </button>
    </section>
  );
}
