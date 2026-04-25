jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
  },
}));

import { authorizeCredentials } from "@/lib/auth-helpers";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";

const mockFindUnique = prisma.user.findUnique as jest.Mock;

describe("authorizeCredentials (credentials sign-in logic)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("returns user for valid credentials", async () => {
    const passwordHash = await hashPassword("correctPassword");
    mockFindUnique.mockResolvedValue({
      id: "user-1",
      email: "alice@example.com",
      name: "Alice",
      passwordHash,
    });

    const result = await authorizeCredentials("alice@example.com", "correctPassword");

    expect(result).toEqual({ id: "user-1", email: "alice@example.com", name: "Alice" });
  });

  test("returns null for wrong password", async () => {
    const passwordHash = await hashPassword("correctPassword");
    mockFindUnique.mockResolvedValue({
      id: "user-1",
      email: "alice@example.com",
      name: "Alice",
      passwordHash,
    });

    const result = await authorizeCredentials("alice@example.com", "wrongPassword");

    expect(result).toBeNull();
  });

  test("returns null when user does not exist", async () => {
    mockFindUnique.mockResolvedValue(null);

    const result = await authorizeCredentials("nobody@example.com", "password123");

    expect(result).toBeNull();
  });

  test("returns null when user has no password hash (OAuth-only account)", async () => {
    mockFindUnique.mockResolvedValue({
      id: "user-2",
      email: "oauth@example.com",
      name: null,
      passwordHash: null,
    });

    const result = await authorizeCredentials("oauth@example.com", "password123");

    expect(result).toBeNull();
  });
});
