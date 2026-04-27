"use client";

import { useState } from "react";

type ProviderType = "OPENROUTER" | "ANTHROPIC";
type AnthropicModelType = "HAIKU" | "SONNET" | "OPUS";

const ANTHROPIC_MODELS: { value: AnthropicModelType; label: string; description: string }[] = [
  { value: "HAIKU", label: "Haiku", description: "Fast & affordable" },
  { value: "SONNET", label: "Sonnet", description: "Balanced performance" },
  { value: "OPUS", label: "Opus", description: "Most capable" },
];

interface ApiKeyFormProps {
  hasOpenRouterKey: boolean;
  hasAnthropicKey: boolean;
  activeProvider: ProviderType;
  activeAnthropicModel: AnthropicModelType;
}

export default function ApiKeyForm({
  hasOpenRouterKey,
  hasAnthropicKey,
  activeProvider,
  activeAnthropicModel,
}: ApiKeyFormProps) {
  const [selectedProvider, setSelectedProvider] = useState<ProviderType>(activeProvider);
  const [selectedModel, setSelectedModel] = useState<AnthropicModelType>(activeAnthropicModel);
  const [apiKey, setApiKey] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [modelStatus, setModelStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleModelChange(model: AnthropicModelType) {
    setSelectedModel(model);
    setModelStatus("saving");
    const response = await fetch("/api/settings/anthropic-model", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model }),
    });
    setModelStatus(response.ok ? "saved" : "error");
  }

  const hasKeyForSelected =
    selectedProvider === "OPENROUTER" ? hasOpenRouterKey : hasAnthropicKey;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    setErrorMessage(null);

    const response = await fetch("/api/settings/api-key", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey, provider: selectedProvider }),
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
        <h2 className="font-heading text-xl font-semibold text-text-primary">AI Provider</h2>
        <p className="mt-1 text-sm text-text-muted">
          Choose your AI provider and enter the corresponding API key.
        </p>
      </div>

      <div className="flex gap-3">
        {(["OPENROUTER", "ANTHROPIC"] as ProviderType[]).map((p) => (
          <label
            key={p}
            className="flex cursor-pointer items-center gap-2 rounded border border-border bg-surface px-4 py-2 text-sm text-text-primary transition-colors has-[:checked]:border-accent has-[:checked]:bg-accent/10"
          >
            <input
              type="radio"
              name="provider"
              value={p}
              checked={selectedProvider === p}
              onChange={() => {
                setSelectedProvider(p);
                setStatus("idle");
                setApiKey("");
                setErrorMessage(null);
              }}
              className="accent-accent"
            />
            {p === "OPENROUTER" ? "OpenRouter" : "Anthropic"}
          </label>
        ))}
      </div>

      {selectedProvider === "ANTHROPIC" && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-text-primary">Model</p>
          <div className="flex gap-3">
            {ANTHROPIC_MODELS.map(({ value, label, description }) => (
              <label
                key={value}
                className="flex cursor-pointer flex-col gap-0.5 rounded border border-border bg-surface px-4 py-2 text-sm transition-colors has-[:checked]:border-accent has-[:checked]:bg-accent/10"
              >
                <span className="flex items-center gap-2 font-medium text-text-primary">
                  <input
                    type="radio"
                    name="anthropic-model"
                    value={value}
                    checked={selectedModel === value}
                    onChange={() => void handleModelChange(value)}
                    className="accent-accent"
                  />
                  {label}
                </span>
                <span className="pl-5 text-xs text-text-muted">{description}</span>
              </label>
            ))}
          </div>
          {modelStatus === "saved" && (
            <p role="status" className="text-xs text-green-700">Model updated.</p>
          )}
          {modelStatus === "error" && (
            <p role="alert" className="text-xs text-red-600">Failed to update model.</p>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-1">
          <label htmlFor="api-key" className="block text-sm font-medium text-text-primary">
            {selectedProvider === "OPENROUTER" ? "OpenRouter API key" : "Anthropic API key"}
          </label>
          <p className="text-xs text-text-muted">
            {hasKeyForSelected || status === "saved"
              ? "A key is currently configured. Enter a new value to replace it."
              : `Enter your ${selectedProvider === "OPENROUTER" ? "OpenRouter" : "Anthropic"} API key to enable AI features.`}
          </p>
          <input
            id="api-key"
            type="password"
            autoComplete="off"
            required
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={selectedProvider === "OPENROUTER" ? "sk-or-…" : "sk-ant-…"}
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
            {hasKeyForSelected ? "Key updated." : "Key saved."}
          </p>
        )}

        <button
          type="submit"
          disabled={status === "saving"}
          className="rounded bg-accent px-4 py-2 font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-60"
        >
          {status === "saving" ? "Saving…" : hasKeyForSelected ? "Update key" : "Save key"}
        </button>
      </form>
    </section>
  );
}
