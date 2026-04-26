import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { decryptApiKey } from "@/lib/encryption";
import { generateLoglines } from "@/lib/brainstorm";
import type { BrainstormRequest } from "@/lib/brainstorm";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as {
    mode?: unknown;
    sourceTitle?: unknown;
    seed?: unknown;
  };

  if (body.mode !== "ORIGINAL" && body.mode !== "FANFIC") {
    return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
  }

  const brainstormReq: BrainstormRequest = {
    mode: body.mode,
    sourceTitle:
      body.mode === "FANFIC" && typeof body.sourceTitle === "string"
        ? body.sourceTitle
        : undefined,
    seed: typeof body.seed === "string" ? body.seed : undefined,
  };

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { openRouterKey: true },
  });

  if (!user?.openRouterKey) {
    return NextResponse.json(
      {
        error: "no_api_key",
        message: "Add your OpenRouter API key in Settings to use AI features.",
      },
      { status: 402 },
    );
  }

  const apiKey = decryptApiKey(user.openRouterKey);

  const loglines = await generateLoglines(brainstormReq, apiKey);

  return NextResponse.json({ loglines });
}
