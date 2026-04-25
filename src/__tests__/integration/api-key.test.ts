jest.mock("@/auth", () => ({
  auth: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      update: jest.fn(),
    },
  },
}));

import { PATCH } from "@/app/api/settings/api-key/route";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const mockAuth = auth as jest.Mock;
const mockUpdate = prisma.user.update as jest.Mock;

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/settings/api-key", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PATCH /api/settings/api-key", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockUpdate.mockResolvedValue({});
  });

  test("saves encrypted key and returns 200", async () => {
    const plaintext = "sk-or-v1-real-key";
    const response = await PATCH(makeRequest({ apiKey: plaintext }) as never);

    expect(response.status).toBe(200);

    const updateCall = mockUpdate.mock.calls[0][0] as {
      where: { id: string };
      data: { openRouterKey: string };
    };
    expect(updateCall.where.id).toBe("user-1");
    expect(updateCall.data.openRouterKey).not.toBe(plaintext);
    expect(updateCall.data.openRouterKey).toContain(":");
  });

  test("stored value can be decrypted back to the original key", async () => {
    const { decryptApiKey } = await import("@/lib/encryption");
    const plaintext = "sk-or-v1-real-key";

    await PATCH(makeRequest({ apiKey: plaintext }) as never);

    const updateCall = mockUpdate.mock.calls[0][0] as {
      data: { openRouterKey: string };
    };
    expect(decryptApiKey(updateCall.data.openRouterKey)).toBe(plaintext);
  });

  test("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const response = await PATCH(makeRequest({ apiKey: "sk-or-v1-key" }) as never);
    expect(response.status).toBe(401);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  test("returns 400 when apiKey is missing", async () => {
    const response = await PATCH(makeRequest({}) as never);
    expect(response.status).toBe(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  test("returns 400 when apiKey is empty string", async () => {
    const response = await PATCH(makeRequest({ apiKey: "   " }) as never);
    expect(response.status).toBe(400);
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
