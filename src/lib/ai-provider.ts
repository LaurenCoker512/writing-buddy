import Anthropic from "@anthropic-ai/sdk";
import { decryptApiKey } from "@/lib/encryption";
import { AI_CONFIG } from "@/config/ai";

export interface AiMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ProviderAdapter {
  /** Returns a ReadableStream of Uint8Array emitting OpenRouter-format SSE chunks. */
  streamChat(messages: AiMessage[], systemPrompt: string): Promise<ReadableStream<Uint8Array>>;
  /** Calls AI non-streaming and returns the complete text response. */
  completeChat(messages: AiMessage[], systemPrompt: string): Promise<string>;
}

export type AiProviderResolution =
  | { ok: true; provider: ProviderAdapter }
  | { ok: false; error: "no_api_key"; message: string };

function openRouterHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer": "https://writing-buddy.app",
    "X-Title": "Writing Buddy",
  };
}

function encodeOpenRouterChunk(text: string): Uint8Array {
  const data = JSON.stringify({ choices: [{ delta: { content: text } }] });
  return new TextEncoder().encode(`data: ${data}\n\n`);
}

export class OpenRouterProvider implements ProviderAdapter {
  constructor(private readonly apiKey: string) {}

  async streamChat(
    messages: AiMessage[],
    systemPrompt: string,
  ): Promise<ReadableStream<Uint8Array>> {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: openRouterHeaders(this.apiKey),
      body: JSON.stringify({
        model: AI_CONFIG.OPENROUTER_DEFAULT_MODEL,
        stream: true,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
      }),
    });

    if (!response.ok || !response.body) {
      throw new Error(`OpenRouter stream error: ${response.status}`);
    }

    return response.body;
  }

  async completeChat(messages: AiMessage[], systemPrompt: string): Promise<string> {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: openRouterHeaders(this.apiKey),
      body: JSON.stringify({
        model: AI_CONFIG.OPENROUTER_DEFAULT_MODEL,
        stream: false,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenRouter complete error: ${response.status}`);
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return data.choices?.[0]?.message?.content ?? "";
  }
}

export class AnthropicProvider implements ProviderAdapter {
  private readonly client: Anthropic;
  private readonly modelId: string;

  constructor(apiKey: string, modelId: string = AI_CONFIG.ANTHROPIC_DEFAULT_MODEL) {
    this.client = new Anthropic({ apiKey });
    this.modelId = modelId;
  }

  async streamChat(
    messages: AiMessage[],
    systemPrompt: string,
  ): Promise<ReadableStream<Uint8Array>> {
    const sdkStream = this.client.messages.stream({
      model: this.modelId,
      max_tokens: 4096,
      system: systemPrompt || undefined,
      messages,
    });

    return new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const event of sdkStream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              controller.enqueue(encodeOpenRouterChunk(event.delta.text));
            }
          }
          controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });
  }

  async completeChat(messages: AiMessage[], systemPrompt: string): Promise<string> {
    const msg = await this.client.messages.create({
      model: this.modelId,
      max_tokens: 4096,
      system: systemPrompt || undefined,
      messages,
    });

    const block = msg.content[0];
    return block?.type === "text" ? block.text : "";
  }
}

/** Strips markdown code fences (```json ... ``` or ``` ... ```) from AI responses before JSON.parse. */
export function stripJsonFences(raw: string): string {
  return raw.replace(/^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/i, "$1").trim();
}

export function resolveAiProvider(user: {
  aiProvider?: "OPENROUTER" | "ANTHROPIC" | null;
  openRouterKey?: string | null;
  anthropicKey?: string | null;
  anthropicModel?: "HAIKU" | "SONNET" | "OPUS" | null;
}): AiProviderResolution {
  const providerType = user.aiProvider ?? "OPENROUTER";

  if (providerType === "ANTHROPIC") {
    if (!user.anthropicKey) {
      return {
        ok: false,
        error: "no_api_key",
        message: "Add your Anthropic API key in Settings to use AI features.",
      };
    }
    try {
      const apiKey = decryptApiKey(user.anthropicKey);
      const modelId = AI_CONFIG.ANTHROPIC_MODEL_IDS[user.anthropicModel ?? "HAIKU"] ?? AI_CONFIG.ANTHROPIC_DEFAULT_MODEL;
      return { ok: true, provider: new AnthropicProvider(apiKey, modelId) };
    } catch {
      return {
        ok: false,
        error: "no_api_key",
        message: "Failed to decrypt Anthropic API key.",
      };
    }
  }

  if (!user.openRouterKey) {
    return {
      ok: false,
      error: "no_api_key",
      message: "Add your OpenRouter API key in Settings to use AI features.",
    };
  }
  try {
    const apiKey = decryptApiKey(user.openRouterKey);
    return { ok: true, provider: new OpenRouterProvider(apiKey) };
  } catch {
    return {
      ok: false,
      error: "no_api_key",
      message: "Failed to decrypt OpenRouter API key.",
    };
  }
}
