import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { buildTemplate } from "@/lib/document-templates";

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

  const seriesInclude = {
    documents: documentSelect,
    subcategories: subcategorySelect,
    stories: {
      include: storyInclude,
      orderBy: { createdAt: "asc" as const },
    },
  };

  const [universes, standaloneSeries, standaloneStories] = await Promise.all([
    prisma.universe.findMany({
      where: { userId },
      include: {
        documents: documentSelect,
        subcategories: subcategorySelect,
        series: {
          include: seriesInclude,
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
      include: seriesInclude,
      orderBy: { createdAt: "asc" },
    }),
    prisma.story.findMany({
      where: { userId, seriesId: null, universeId: null },
      include: storyInclude,
      orderBy: { createdAt: "asc" },
    }),
  ]);

  // Collect all stories and lazy-create missing PLOT documents.
  type StoryWithDocs = { id: string; documents: { type: string }[] };
  const allStories: StoryWithDocs[] = [
    ...standaloneStories,
    ...standaloneSeries.flatMap((s) => s.stories),
    ...universes.flatMap((u) => [
      ...u.stories,
      ...u.series.flatMap((s) => s.stories),
    ]),
  ];
  const storiesWithoutPlot = allStories.filter(
    (s) => !s.documents.some((d) => d.type === "PLOT"),
  );

  if (storiesWithoutPlot.length > 0) {
    await Promise.all(
      storiesWithoutPlot.map((s) =>
        prisma.document.create({
          data: {
            storyId: s.id,
            type: "PLOT",
            name: "Plot",
            tiptapJson: buildTemplate("PLOT"),
          },
        }),
      ),
    );
    // Re-fetch the full tree so the response includes the newly created Plot docs.
    const [universesRefetched, standaloneSeriesRefetched, standaloneStoriesRefetched] =
      await Promise.all([
        prisma.universe.findMany({
          where: { userId },
          include: {
            documents: documentSelect,
            subcategories: subcategorySelect,
            series: { include: seriesInclude, orderBy: { createdAt: "asc" } },
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
          include: seriesInclude,
          orderBy: { createdAt: "asc" },
        }),
        prisma.story.findMany({
          where: { userId, seriesId: null, universeId: null },
          include: storyInclude,
          orderBy: { createdAt: "asc" },
        }),
      ]);
    return NextResponse.json({
      universes: universesRefetched,
      standaloneSeries: standaloneSeriesRefetched,
      standaloneStories: standaloneStoriesRefetched,
    });
  }

  return NextResponse.json({ universes, standaloneSeries, standaloneStories });
}
