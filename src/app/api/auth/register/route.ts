import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    email?: unknown;
    password?: unknown;
    name?: unknown;
  };

  const { email, password, name } = body;

  if (typeof email !== "string" || typeof password !== "string") {
    return NextResponse.json(
      { error: "Email and password are required" },
      { status: 400 }
    );
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 }
    );
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing !== null) {
    return NextResponse.json({ error: "Email already in use" }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      email,
      name: typeof name === "string" ? name : null,
      passwordHash,
    },
    select: { id: true, email: true, name: true, createdAt: true },
  });

  return NextResponse.json({ user }, { status: 201 });
}
