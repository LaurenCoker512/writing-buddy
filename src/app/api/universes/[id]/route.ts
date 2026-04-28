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
  const universe = await prisma.universe.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!universe) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(universe);
}

export async function PATCH(req: NextRequest, { params }: RouteParams<{ id: string }>) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await prisma.universe.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await req.json()) as Record<string, unknown>;
  const result = buildHierarchyPatchData(body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  const updated = await prisma.universe.update({
    where: { id },
    data: result.data,
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: RouteParams<{ id: string }>) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await prisma.universe.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // onDelete: SetNull on Series.universeId and Story.universeId means
  // related series and stories are orphaned (not deleted) by the DB.
  await prisma.universe.delete({ where: { id } });

  return new NextResponse(null, { status: 204 });
}
