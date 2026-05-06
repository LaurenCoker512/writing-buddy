import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const SUPPORTED_TYPES = ["CHARACTER", "WORLDBUILDING", "SCENE"] as const;
type SupportedType = (typeof SUPPORTED_TYPES)[number];

function isSupportedType(v: unknown): v is SupportedType {
  return SUPPORTED_TYPES.includes(v as SupportedType);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as Record<string, unknown>;
  const { name, documentType, storyId, universeId, seriesId } = body;

  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (!isSupportedType(documentType)) {
    return NextResponse.json({ error: "documentType must be CHARACTER, WORLDBUILDING, or SCENE" }, { status: 400 });
  }

  const scopeCount = [storyId, universeId, seriesId].filter(Boolean).length;
  if (scopeCount !== 1) {
    return NextResponse.json({ error: "Exactly one of storyId, universeId, seriesId is required" }, { status: 400 });
  }

  // Ownership check
  if (typeof storyId === "string") {
    const story = await prisma.story.findFirst({ where: { id: storyId, userId: session.user.id } });
    if (!story) return NextResponse.json({ error: "Not found" }, { status: 404 });
  } else if (typeof universeId === "string") {
    const universe = await prisma.universe.findFirst({ where: { id: universeId, userId: session.user.id } });
    if (!universe) return NextResponse.json({ error: "Not found" }, { status: 404 });
  } else if (typeof seriesId === "string") {
    const series = await prisma.series.findFirst({ where: { id: seriesId, userId: session.user.id } });
    if (!series) return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const subcategory = await prisma.documentSubcategory.create({
    data: {
      name: name.trim(),
      documentType,
      storyId: typeof storyId === "string" ? storyId : null,
      universeId: typeof universeId === "string" ? universeId : null,
      seriesId: typeof seriesId === "string" ? seriesId : null,
    },
    select: { id: true, name: true, documentType: true, order: true },
  });

  return NextResponse.json(subcategory, { status: 201 });
}
