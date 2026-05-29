import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { buildHierarchyPatchData } from "@/lib/hierarchy";
import type { RouteParams } from "@/types/route";

export async function GET(_req: NextRequest, { params }: RouteParams<{ id: string }>) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const story = await prisma.story.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!story) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(story);
}

export async function PATCH(req: NextRequest, { params }: RouteParams<{ id: string }>) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await prisma.story.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await req.json()) as Record<string, unknown>;
  const result = buildHierarchyPatchData(body);

  const patchData: Record<string, unknown> = result.ok ? { ...result.data } : {};

  if ("seriesId" in body) {
    patchData.seriesId =
      typeof body.seriesId === "string" && body.seriesId !== "" ? body.seriesId : null;
  }
  if ("universeId" in body) {
    patchData.universeId =
      typeof body.universeId === "string" && body.universeId !== "" ? body.universeId : null;
  }
  if (body.order !== undefined) {
    patchData.order = typeof body.order === "number" ? body.order : null;
  }

  if (Object.keys(patchData).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const updated = await prisma.story.update({
    where: { id },
    data: patchData,
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: RouteParams<{ id: string }>) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await prisma.story.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.story.delete({ where: { id } });

  return new NextResponse(null, { status: 204 });
}
