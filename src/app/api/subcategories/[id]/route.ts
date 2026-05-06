import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { RouteParams } from "@/types/route";

async function findOwnedSubcategory(id: string, userId: string) {
  const sub = await prisma.documentSubcategory.findFirst({
    where: { id },
    include: {
      story: { select: { userId: true } },
      series: { select: { userId: true } },
      universe: { select: { userId: true } },
    },
  });
  if (!sub) return null;
  const ownerId = sub.story?.userId ?? sub.series?.userId ?? sub.universe?.userId;
  return ownerId === userId ? sub : null;
}

export async function PATCH(req: NextRequest, { params }: RouteParams<{ id: string }>) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await findOwnedSubcategory(id, session.user.id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json()) as Record<string, unknown>;
  if (typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const updated = await prisma.documentSubcategory.update({
    where: { id },
    data: { name: body.name.trim() },
    select: { id: true, name: true, documentType: true, order: true },
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: RouteParams<{ id: string }>) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await findOwnedSubcategory(id, session.user.id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // onDelete: SetNull on Document.subcategoryId clears the FK automatically
  await prisma.documentSubcategory.delete({ where: { id } });

  return new NextResponse(null, { status: 204 });
}
