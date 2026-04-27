import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateLoglines } from "@/lib/brainstorm";
import { resolveAiProvider } from "@/lib/ai-provider";
import { ensureContentSummariesFresh } from "@/lib/content-summary";
import type { BrainstormRequest, UniverseContext } from "@/lib/brainstorm";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as {
    mode?: unknown;
    sourceTitle?: unknown;
    seed?: unknown;
    universeId?: unknown;
    documentIds?: unknown;
  };

  if (body.mode !== "ORIGINAL" && body.mode !== "FANFIC") {
    return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { openRouterKey: true, anthropicKey: true, aiProvider: true, anthropicModel: true },
  });

  const providerResult = resolveAiProvider(user ?? { openRouterKey: null, anthropicKey: null, aiProvider: null });
  if (!providerResult.ok) {
    return NextResponse.json(
      { error: providerResult.error, message: providerResult.message },
      { status: 402 },
    );
  }

  const { provider } = providerResult;

  let universeContext: UniverseContext | undefined;
  if (
    typeof body.universeId === "string" &&
    Array.isArray(body.documentIds) &&
    body.documentIds.length > 0
  ) {
    const validIds = body.documentIds.filter((id): id is string => typeof id === "string");
    const universe = await prisma.universe.findFirst({
      where: { id: body.universeId, userId: session.user.id },
      select: { name: true, sourceTitle: true },
    });

    if (universe !== null && validIds.length > 0) {
      const docs = await ensureContentSummariesFresh(validIds, provider);
      const docsWithSummaries = docs.filter(
        (d): d is typeof d & { contentSummary: string } =>
          d.contentSummary !== null && d.contentSummary.trim() !== "",
      );

      if (docsWithSummaries.length > 0) {
        universeContext = {
          universeName: universe.name,
          sourceTitle: universe.sourceTitle ?? undefined,
          docs: docsWithSummaries.map((d) => ({
            name: d.name,
            type: d.type,
            summary: d.contentSummary,
          })),
        };
      }
    }
  }

  const brainstormReq: BrainstormRequest = {
    mode: body.mode,
    sourceTitle:
      body.mode === "FANFIC" && typeof body.sourceTitle === "string"
        ? body.sourceTitle
        : undefined,
    seed: typeof body.seed === "string" ? body.seed : undefined,
    universeContext,
  };

  const loglines = await generateLoglines(brainstormReq, provider);

  return NextResponse.json({ loglines });
}
