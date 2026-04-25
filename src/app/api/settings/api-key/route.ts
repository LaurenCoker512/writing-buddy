import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { encryptApiKey } from "@/lib/encryption";

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as { apiKey?: unknown };

  if (typeof body.apiKey !== "string" || body.apiKey.trim() === "") {
    return NextResponse.json({ error: "API key is required" }, { status: 400 });
  }

  const encryptedKey = encryptApiKey(body.apiKey.trim());

  await prisma.user.update({
    where: { id: session.user.id },
    data: { openRouterKey: encryptedKey },
  });

  return NextResponse.json({ message: "API key saved" });
}
