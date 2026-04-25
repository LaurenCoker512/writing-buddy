jest.mock("@/auth", () => ({
  auth: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      delete: jest.fn(),
    },
  },
}));

import { DELETE } from "@/app/api/account/route";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const mockAuth = auth as jest.Mock;
const mockDelete = prisma.user.delete as jest.Mock;

describe("DELETE /api/account", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "user-1" } });
    mockDelete.mockResolvedValue({});
  });

  test("deletes user by id and returns 204", async () => {
    const response = await DELETE();

    expect(response.status).toBe(204);

    const deleteCall = mockDelete.mock.calls[0][0] as {
      where: { id: string };
    };
    expect(deleteCall.where.id).toBe("user-1");
  });

  test("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const response = await DELETE();
    expect(response.status).toBe(401);
    expect(mockDelete).not.toHaveBeenCalled();
  });
});
