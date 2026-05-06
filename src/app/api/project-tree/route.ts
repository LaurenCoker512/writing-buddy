import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  const documentSelect = {
    select: { id: true, name: true, type: true, order: true, parentDocumentId: true, meta: true, subcategoryId: true },
    orderBy: [
      { order: "asc" as const },
      { createdAt: "asc" as const },
    ],
  };

  const subcategorySelect = {
    select: { id: true, name: true, documentType: true, order: true },
    orderBy: { createdAt: "asc" as const },
  };

  const storyInclude = {
    documents: documentSelect,
    subcategories: subcategorySelect,
  };

  const [universes, standaloneSeries, standaloneStories] = await Promise.all([
    prisma.universe.findMany({
      where: { userId },
      include: {
        documents: documentSelect,
        subcategories: subcategorySelect,
        series: {
          include: {
            stories: {
              include: storyInclude,
              orderBy: { createdAt: "asc" },
            },
          },
          orderBy: { createdAt: "asc" },
        },
        stories: {
          where: { seriesId: null },
          include: storyInclude,
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.series.findMany({
      where: { userId, universeId: null },
      include: {
        stories: {
          include: storyInclude,
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.story.findMany({
      where: { userId, seriesId: null, universeId: null },
      include: storyInclude,
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return NextResponse.json({ universes, standaloneSeries, standaloneStories });
}
