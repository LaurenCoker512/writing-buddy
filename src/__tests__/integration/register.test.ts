jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  },
}));

import { POST } from "@/app/api/auth/register/route";
import { prisma } from "@/lib/prisma";

const mockFindUnique = prisma.user.findUnique as jest.Mock;
const mockCreate = prisma.user.create as jest.Mock;

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/register", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("creates user and returns 201 with hashed password stored", async () => {
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue({
      id: "user-1",
      email: "test@example.com",
      name: null,
      createdAt: new Date(),
    });

    const response = await POST(makeRequest({ email: "test@example.com", password: "password123" }) as never);

    expect(response.status).toBe(201);

    const createCall = mockCreate.mock.calls[0][0] as { data: { passwordHash: string; email: string } };
    expect(createCall.data.passwordHash).not.toBe("password123");
    expect(createCall.data.passwordHash).toMatch(/^\$2[ab]\$/);
    expect(createCall.data.email).toBe("test@example.com");
  });

  test("returns 409 when email already exists", async () => {
    mockFindUnique.mockResolvedValue({ id: "existing-user" });

    const response = await POST(makeRequest({ email: "taken@example.com", password: "password123" }) as never);

    expect(response.status).toBe(409);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  test("returns 400 when password is missing", async () => {
    const response = await POST(makeRequest({ email: "test@example.com" }) as never);
    expect(response.status).toBe(400);
  });

  test("returns 400 when email is missing", async () => {
    const response = await POST(makeRequest({ password: "password123" }) as never);
    expect(response.status).toBe(400);
  });

  test("returns 400 when password is shorter than 8 characters", async () => {
    const response = await POST(makeRequest({ email: "test@example.com", password: "short" }) as never);
    expect(response.status).toBe(400);
  });

  test("stores optional name on the user record", async () => {
    mockFindUnique.mockResolvedValue(null);
    mockCreate.mockResolvedValue({
      id: "user-2",
      email: "named@example.com",
      name: "Alice",
      createdAt: new Date(),
    });

    await POST(makeRequest({ email: "named@example.com", password: "password123", name: "Alice" }) as never);

    const createCall = mockCreate.mock.calls[0][0] as { data: { name: string } };
    expect(createCall.data.name).toBe("Alice");
  });
});
