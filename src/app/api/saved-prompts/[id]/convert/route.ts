import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { isRating } from "@/lib/hierarchy";
import { buildPlotTemplateWithPremise } from "@/lib/document-templates";
import { AI_CONFIG } from "@/config/ai";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const savedPrompt = await prisma.savedPrompt.findUnique({ where: { id } });
  if (!savedPrompt || savedPrompt.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await req.json()) as Record<string, unknown>;

  if (typeof body.name !== "string" || body.name.trim() === "") {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (body.name.length > AI_CONFIG.MAX_NAME_LENGTH) {
    return NextResponse.json({ error: "Name too long" }, { status: 400 });
  }
  if (!isRating(body.rating)) {
    return NextResponse.json({ error: "Invalid rating" }, { status: 400 });
  }

  const seriesId =
    typeof body.seriesId === "string" && body.seriesId !== "" ? body.seriesId : null;
  const universeId =
    typeof body.universeId === "string" && body.universeId !== "" ? body.universeId : null;

  const story = await prisma.story.create({
    data: {
      userId: session.user.id,
      name: body.name.trim(),
      mode: savedPrompt.mode,
      rating: body.rating,
      sourceTitle: savedPrompt.sourceTitle ?? null,
      seriesId,
      universeId,
    },
  });

  const plotDoc = await prisma.document.create({
    data: {
      type: "PLOT",
      name: "Plot",
      tiptapJson: buildPlotTemplateWithPremise(savedPrompt.content) as unknown as Prisma.InputJsonValue,
      storyId: story.id,
    },
  });

  await prisma.savedPrompt.update({
    where: { id },
    data: { convertedToStoryId: story.id },
  });

  return NextResponse.json({ ...story, plotDocumentId: plotDoc.id }, { status: 201 });
}
