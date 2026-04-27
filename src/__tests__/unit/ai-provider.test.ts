jest.mock("@anthropic-ai/sdk", () => {
  const mockStream = jest.fn();
  const mockCreate = jest.fn();
  class MockAnthropic {
    messages = { stream: mockStream, create: mockCreate };
    constructor(_opts: unknown) {}
  }
  return {
    __esModule: true,
    default: MockAnthropic,
    __mockStream: mockStream,
    __mockCreate: mockCreate,
  };
});

jest.mock("@/lib/encryption", () => ({
  decryptApiKey: jest.fn().mockImplementation((val: string) => `decrypted:${val}`),
}));

import { resolveAiProvider, OpenRouterProvider, AnthropicProvider } from "@/lib/ai-provider";

const sdk = jest.requireMock("@anthropic-ai/sdk") as {
  __mockStream: jest.Mock;
  __mockCreate: jest.Mock;
};

async function readStreamText(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let result = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    result += decoder.decode(value, { stream: true });
  }
  return result;
}

async function* makeAnthropicStream(texts: string[]) {
  for (const text of texts) {
    yield { type: "content_block_delta", index: 0, delta: { type: "text_delta", text } };
  }
  yield { type: "message_stop" };
}

describe("resolveAiProvider", () => {
  test("returns OpenRouterProvider when aiProvider is OPENROUTER and key is present", () => {
    const result = resolveAiProvider({ aiProvider: "OPENROUTER", openRouterKey: "enc-key", anthropicKey: null });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.provider).toBeInstanceOf(OpenRouterProvider);
    }
  });

  test("returns AnthropicProvider when aiProvider is ANTHROPIC and key is present", () => {
    const result = resolveAiProvider({ aiProvider: "ANTHROPIC", openRouterKey: null, anthropicKey: "enc-ant-key" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.provider).toBeInstanceOf(AnthropicProvider);
    }
  });

  test("defaults to OPENROUTER when aiProvider is null", () => {
    const result = resolveAiProvider({ aiProvider: null, openRouterKey: "enc-key", anthropicKey: null });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.provider).toBeInstanceOf(OpenRouterProvider);
    }
  });

  test("returns no_api_key when ANTHROPIC selected but no anthropicKey", () => {
    const result = resolveAiProvider({ aiProvider: "ANTHROPIC", openRouterKey: "enc-key", anthropicKey: null });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("no_api_key");
      expect(result.message).toContain("Anthropic");
    }
  });

  test("returns no_api_key when OPENROUTER selected but no openRouterKey", () => {
    const result = resolveAiProvider({ aiProvider: "OPENROUTER", openRouterKey: null, anthropicKey: null });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("no_api_key");
      expect(result.message).toContain("OpenRouter");
    }
  });

  test("returns no_api_key for missing openRouterKey when aiProvider is undefined", () => {
    const result = resolveAiProvider({ openRouterKey: null });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("no_api_key");
    }
  });
});

describe("AnthropicProvider.streamChat", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("converts content_block_delta events to OpenRouter-format SSE chunks", async () => {
    sdk.__mockStream.mockReturnValue(makeAnthropicStream(["Hello", " World"]));

    const provider = new AnthropicProvider("test-key");
    const stream = await provider.streamChat([{ role: "user", content: "Hi" }], "System prompt");
    const text = await readStreamText(stream);

    expect(text).toContain('data: ');
    expect(text).toContain('"choices"');
    expect(text).toContain('"delta"');
    expect(text).toContain('"Hello"');
    expect(text).toContain('" World"');
    expect(text).toContain('[DONE]');
  });

  test("emits same chunk structure as OpenRouterProvider format", async () => {
    sdk.__mockStream.mockReturnValue(makeAnthropicStream(["chunk"]));

    const provider = new AnthropicProvider("test-key");
    const stream = await provider.streamChat([{ role: "user", content: "test" }], "");
    const text = await readStreamText(stream);

    const lines = text.split("\n").filter((l) => l.startsWith("data: ") && !l.includes("[DONE]"));
    expect(lines.length).toBeGreaterThan(0);

    const parsed = JSON.parse(lines[0]!.slice(6)) as {
      choices?: Array<{ delta?: { content?: string } }>;
    };
    expect(parsed.choices?.[0]?.delta?.content).toBe("chunk");
  });

  test("ignores non-text-delta events", async () => {
    async function* mixedStream() {
      yield { type: "message_start", message: {} };
      yield { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } };
      yield { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "hi" } };
      yield { type: "content_block_stop", index: 0 };
      yield { type: "message_stop" };
    }
    sdk.__mockStream.mockReturnValue(mixedStream());

    const provider = new AnthropicProvider("test-key");
    const stream = await provider.streamChat([{ role: "user", content: "test" }], "");
    const text = await readStreamText(stream);

    const dataLines = text.split("\n").filter((l) => l.startsWith("data: ") && !l.includes("[DONE]"));
    expect(dataLines).toHaveLength(1);
    const parsed = JSON.parse(dataLines[0]!.slice(6)) as {
      choices?: Array<{ delta?: { content?: string } }>;
    };
    expect(parsed.choices?.[0]?.delta?.content).toBe("hi");
  });
});

describe("AnthropicProvider.completeChat", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("returns text from the first content block", async () => {
    sdk.__mockCreate.mockResolvedValue({
      content: [{ type: "text", text: "The answer." }],
    });

    const provider = new AnthropicProvider("test-key");
    const result = await provider.completeChat([{ role: "user", content: "Question?" }], "");
    expect(result).toBe("The answer.");
  });

  test("returns empty string when content is empty", async () => {
    sdk.__mockCreate.mockResolvedValue({ content: [] });

    const provider = new AnthropicProvider("test-key");
    const result = await provider.completeChat([{ role: "user", content: "Q" }], "");
    expect(result).toBe("");
  });
});
