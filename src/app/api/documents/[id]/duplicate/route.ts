import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { findOwnedDocument } from "@/lib/db-helpers";
import type { RouteParams } from "@/types/route";

export async function POST(
  _req: NextRequest,
  { params }: RouteParams<{ id: string }>,
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const original = await findOwnedDocument(id, session.user.id);
  if (!original) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const originalMeta =
    typeof original.meta === "object" && original.meta !== null && !Array.isArray(original.meta)
      ? (original.meta as Record<string, unknown>)
      : {};

  const duplicate = await prisma.document.create({
    data: {
      name: `${original.name} (AU)`,
      type: original.type,
      tiptapJson: original.tiptapJson as Prisma.InputJsonValue,
      storyId: original.storyId,
      seriesId: original.seriesId,
      universeId: original.universeId,
      meta: { ...originalMeta, isCanon: false },
    },
  });

  return NextResponse.json(duplicate, { status: 201 });
}
