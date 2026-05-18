import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isMode, isRating, toOptionalString } from "@/lib/hierarchy";
import { AI_CONFIG } from "@/config/ai";
import { buildTemplate } from "@/lib/document-templates";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const stories = await prisma.story.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(stories);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as Record<string, unknown>;

  if (typeof body.name !== "string" || body.name.trim() === "") {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (body.name.length > AI_CONFIG.MAX_NAME_LENGTH) {
    return NextResponse.json({ error: "Name too long" }, { status: 400 });
  }
  if (!isMode(body.mode)) {
    return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
  }
  if (!isRating(body.rating)) {
    return NextResponse.json({ error: "Invalid rating" }, { status: 400 });
  }

  const story = await prisma.story.create({
    data: {
      userId: session.user.id,
      name: body.name.trim(),
      mode: body.mode,
      rating: body.rating,
      sourceTitle: toOptionalString(body.sourceTitle),
      seriesId: typeof body.seriesId === "string" ? body.seriesId : null,
      universeId: typeof body.universeId === "string" ? body.universeId : null,
    },
  });

  await prisma.document.create({
    data: {
      storyId: story.id,
      type: "PLOT",
      name: "Plot",
      tiptapJson: buildTemplate("PLOT"),
    },
  });

  return NextResponse.json(story, { status: 201 });
}
