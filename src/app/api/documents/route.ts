import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { isDocumentType, isValidDocumentScope } from "@/lib/documents";
import { buildTemplate } from "@/lib/document-templates";
import { AI_CONFIG } from "@/config/ai";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  const { searchParams } = req.nextUrl;
  const storyId = searchParams.get("storyId");
  const seriesId = searchParams.get("seriesId");
  const universeId = searchParams.get("universeId");
  const typesParam = searchParams.get("types");
  const types = typesParam ? typesParam.split(",").filter(isDocumentType) : undefined;

  const scopeCount = [storyId, seriesId, universeId].filter(Boolean).length;
  if (scopeCount === 0) {
    return NextResponse.json(
      { error: "At least one scope parameter is required" },
      { status: 400 },
    );
  }
  if (scopeCount > 1) {
    return NextResponse.json(
      { error: "Only one scope parameter (storyId, seriesId, or universeId) may be provided" },
      { status: 400 },
    );
  }

  // Verify ownership of the scope
  if (storyId) {
    const story = await prisma.story.findFirst({ where: { id: storyId, userId } });
    if (!story) return NextResponse.json({ error: "Story not found" }, { status: 404 });
  } else if (seriesId) {
    const series = await prisma.series.findFirst({ where: { id: seriesId, userId } });
    if (!series) return NextResponse.json({ error: "Series not found" }, { status: 404 });
  } else if (universeId) {
    const universe = await prisma.universe.findFirst({ where: { id: universeId, userId } });
    if (!universe) return NextResponse.json({ error: "Universe not found" }, { status: 404 });
  }

  const documents = await prisma.document.findMany({
    where: {
      ...(storyId ? { storyId } : seriesId ? { seriesId } : { universeId: universeId! }),
      ...(types && types.length > 0 ? { type: { in: types } } : {}),
    },
    select: { id: true, name: true, type: true, meta: true, order: true },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(documents);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const body = (await req.json()) as Record<string, unknown>;

  if (typeof body.name !== "string" || body.name.trim() === "") {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (body.name.length > AI_CONFIG.MAX_NAME_LENGTH) {
    return NextResponse.json({ error: "Name too long" }, { status: 400 });
  }
  if (!isDocumentType(body.type)) {
    return NextResponse.json({ error: "Invalid document type" }, { status: 400 });
  }

  const storyId = typeof body.storyId === "string" ? body.storyId : null;
  const seriesId = typeof body.seriesId === "string" ? body.seriesId : null;
  const universeId = typeof body.universeId === "string" ? body.universeId : null;

  if (!isValidDocumentScope(storyId, seriesId, universeId)) {
    return NextResponse.json(
      { error: "At least one scope (storyId, seriesId, or universeId) is required" },
      { status: 400 },
    );
  }

  // Enforce scope-based type restrictions
  if (universeId && (body.type === "PLOT" || body.type === "SCENE")) {
    return NextResponse.json(
      { error: `${body.type === "PLOT" ? "Plot" : "Scene"} documents cannot be created at the universe level` },
      { status: 400 },
    );
  }
  if (seriesId && body.type === "SCENE") {
    return NextResponse.json(
      { error: "Scene documents cannot be created at the series level" },
      { status: 400 },
    );
  }

  // Verify ownership via the most specific scope
  if (storyId) {
    const story = await prisma.story.findFirst({ where: { id: storyId, userId } });
    if (!story) return NextResponse.json({ error: "Story not found" }, { status: 404 });
  } else if (seriesId) {
    const series = await prisma.series.findFirst({ where: { id: seriesId, userId } });
    if (!series) return NextResponse.json({ error: "Series not found" }, { status: 404 });
  } else if (universeId) {
    const universe = await prisma.universe.findFirst({ where: { id: universeId, userId } });
    if (!universe) return NextResponse.json({ error: "Universe not found" }, { status: 404 });
  }

  // Enforce PLOT singleton at story scope
  if (storyId && body.type === "PLOT") {
    const existingPlot = await prisma.document.findFirst({ where: { storyId, type: "PLOT" } });
    if (existingPlot) {
      return NextResponse.json(
        { error: "A Plot document already exists for this story" },
        { status: 409 },
      );
    }
  }

  const tiptapJson =
    typeof body.tiptapJson === "object" &&
    body.tiptapJson !== null &&
    !Array.isArray(body.tiptapJson)
      ? (body.tiptapJson as Prisma.InputJsonValue)
      : buildTemplate(body.type);

  const meta =
    typeof body.meta === "object" && body.meta !== null && !Array.isArray(body.meta)
      ? (body.meta as Prisma.InputJsonValue)
      : undefined;

  const document = await prisma.document.create({
    data: {
      type: body.type,
      name: body.name.trim(),
      tiptapJson,
      storyId,
      seriesId,
      universeId,
      ...(meta !== undefined ? { meta } : {}),
    },
  });

  return NextResponse.json(document, { status: 201 });
}
