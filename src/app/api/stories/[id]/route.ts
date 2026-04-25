import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isMode, isRating, toOptionalString } from "@/lib/hierarchy";

type Params = { params: { id: string } };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const story = await prisma.story.findFirst({
    where: { id: params.id, userId: session.user.id },
  });

  if (!story) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(story);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await prisma.story.findFirst({
    where: { id: params.id, userId: session.user.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await req.json()) as Record<string, unknown>;
  const data: {
    name?: string;
    mode?: "ORIGINAL" | "FANFIC";
    rating?: "G" | "T" | "M" | "E";
    sourceTitle?: string | null;
  } = {};

  if (typeof body.name === "string" && body.name.trim() !== "") {
    data.name = body.name.trim();
  }
  if (body.mode !== undefined) {
    if (!isMode(body.mode)) {
      return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
    }
    data.mode = body.mode;
  }
  if (body.rating !== undefined) {
    if (!isRating(body.rating)) {
      return NextResponse.json({ error: "Invalid rating" }, { status: 400 });
    }
    data.rating = body.rating;
  }
  if (body.sourceTitle !== undefined) {
    data.sourceTitle = toOptionalString(body.sourceTitle);
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const updated = await prisma.story.update({
    where: { id: params.id },
    data,
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await prisma.story.findFirst({
    where: { id: params.id, userId: session.user.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.story.delete({ where: { id: params.id } });

  return new NextResponse(null, { status: 204 });
}
