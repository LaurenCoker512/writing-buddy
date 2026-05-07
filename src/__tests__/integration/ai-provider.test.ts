jest.mock("@/auth", () => ({ auth: jest.fn() }));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: { update: jest.fn(), findUnique: jest.fn() },
  },
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

import { PATCH } from "@/app/api/settings/api-key/route";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { decryptApiKey } from "@/lib/encryption";

const mockAuth = auth as jest.Mock;
const mockUpdate = prisma.user.update as jest.Mock;

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/settings/api-key", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.mockResolvedValue({ user: { id: "user-1" } });
  mockUpdate.mockResolvedValue({});
});

describe("PATCH /api/settings/api-key with Anthropic provider", () => {
  test("saves encrypted key to anthropicKey column when provider is ANTHROPIC", async () => {
    const plaintext = "sk-ant-api03-real-key";
    const response = await PATCH(makeRequest({ apiKey: plaintext, provider: "ANTHROPIC" }) as never);

    expect(response.status).toBe(200);

    const updateCall = mockUpdate.mock.calls[0][0] as {
      where: { id: string };
      data: { anthropicKey?: string; openRouterKey?: string; aiProvider: string };
    };
    expect(updateCall.where.id).toBe("user-1");
    expect(typeof updateCall.data.anthropicKey).toBe("string");
    expect(updateCall.data.anthropicKey).not.toBe(plaintext);
    expect(updateCall.data.aiProvider).toBe("ANTHROPIC");
    expect(updateCall.data.openRouterKey).toBeUndefined();
  });

  test("anthropicKey can be decrypted back to original", async () => {
    const plaintext = "sk-ant-api03-real-key";
    await PATCH(makeRequest({ apiKey: plaintext, provider: "ANTHROPIC" }) as never);

    const updateCall = mockUpdate.mock.calls[0][0] as {
      data: { anthropicKey: string };
    };
    expect(decryptApiKey(updateCall.data.anthropicKey)).toBe(plaintext);
  });

  test("saves to openRouterKey when provider is OPENROUTER", async () => {
    const plaintext = "sk-or-v1-key";
    await PATCH(makeRequest({ apiKey: plaintext, provider: "OPENROUTER" }) as never);

    const updateCall = mockUpdate.mock.calls[0][0] as {
      data: { openRouterKey?: string; anthropicKey?: string; aiProvider: string };
    };
    expect(typeof updateCall.data.openRouterKey).toBe("string");
    expect(updateCall.data.aiProvider).toBe("OPENROUTER");
    expect(updateCall.data.anthropicKey).toBeUndefined();
  });

  test("defaults to OPENROUTER when provider is not specified", async () => {
    await PATCH(makeRequest({ apiKey: "sk-or-key" }) as never);

    const updateCall = mockUpdate.mock.calls[0][0] as {
      data: { aiProvider: string };
    };
    expect(updateCall.data.aiProvider).toBe("OPENROUTER");
  });

  test("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const response = await PATCH(makeRequest({ apiKey: "sk-ant-key", provider: "ANTHROPIC" }) as never);
    expect(response.status).toBe(401);
  });

  test("returns 400 when apiKey is missing", async () => {
    const response = await PATCH(makeRequest({ provider: "ANTHROPIC" }) as never);
    expect(response.status).toBe(400);
  });
});
