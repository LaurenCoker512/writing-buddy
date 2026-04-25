"use client";

import { useState } from "react";

interface ApiKeyFormProps {
  hasKey: boolean;
}

export default function ApiKeyForm({ hasKey }: ApiKeyFormProps) {
  const [apiKey, setApiKey] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle"
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    setErrorMessage(null);

    const response = await fetch("/api/settings/api-key", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey }),
    });

    if (response.ok) {
      setStatus("saved");
      setApiKey("");
    } else {
      const data = (await response.json()) as { error?: string };
      setErrorMessage(data.error ?? "Failed to save API key.");
      setStatus("error");
    }
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-heading text-xl font-semibold text-text-primary">
          OpenRouter API Key
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          {hasKey || status === "saved"
            ? "A key is currently configured. Enter a new value to replace it."
            : "Enter your OpenRouter API key to enable AI features."}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-1">
          <label
            htmlFor="api-key"
            className="block text-sm font-medium text-text-primary"
          >
            API key
          </label>
          <input
            id="api-key"
            type="password"
            autoComplete="off"
            required
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-or-…"
            className="w-full rounded border border-border bg-surface px-3 py-2 text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
          />
        </div>

        {status === "error" && errorMessage !== null && (
          <p role="alert" className="text-sm text-red-600">
            {errorMessage}
          </p>
        )}

        {status === "saved" && (
          <p role="status" className="text-sm text-green-700">
            {hasKey ? "Key updated." : "Key saved."}
          </p>
        )}

        <button
          type="submit"
          disabled={status === "saving"}
          className="rounded bg-accent px-4 py-2 font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
        >
          {status === "saving" ? "Saving…" : hasKey ? "Update key" : "Save key"}
        </button>
      </form>
    </section>
  );
}
