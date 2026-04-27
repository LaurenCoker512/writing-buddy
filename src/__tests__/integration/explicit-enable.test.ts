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

import { PATCH } from "@/app/api/account/explicit-enable/route";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const mockAuth = auth as jest.Mock;
const mockUpdate = prisma.user.update as jest.Mock;

describe("PATCH /api/account/explicit-enable", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockUpdate.mockResolvedValue({ explicitEnabled: true });
  });

  test("sets explicitEnabled to true and returns it", async () => {
    const response = await PATCH();

    expect(response.status).toBe(200);
    const body = (await response.json()) as { explicitEnabled: boolean };
    expect(body.explicitEnabled).toBe(true);
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { explicitEnabled: true },
    });
  });

  test("is idempotent — can be called multiple times without error", async () => {
    await PATCH();
    await PATCH();
    expect(mockUpdate).toHaveBeenCalledTimes(2);
    expect(mockUpdate).toHaveBeenNthCalledWith(2, {
      where: { id: "user-1" },
      data: { explicitEnabled: true },
    });
  });

  test("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const response = await PATCH();
    expect(response.status).toBe(401);
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
