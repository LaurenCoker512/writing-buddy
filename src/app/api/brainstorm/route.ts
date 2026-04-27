import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateLoglines } from "@/lib/brainstorm";
import { resolveAiProvider } from "@/lib/ai-provider";
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
    select: { openRouterKey: true, anthropicKey: true, aiProvider: true },
  });

  const providerResult = resolveAiProvider(user ?? { openRouterKey: null, anthropicKey: null, aiProvider: null });
  if (!providerResult.ok) {
    return NextResponse.json(
      { error: providerResult.error, message: providerResult.message },
      { status: 402 },
    );
  }

  const loglines = await generateLoglines(brainstormReq, providerResult.provider);

  return NextResponse.json({ loglines });
}
