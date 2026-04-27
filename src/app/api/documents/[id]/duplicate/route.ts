import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { findOwnedDocument } from "@/lib/db-helpers";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tiptapJson: original.tiptapJson as any,
      storyId: original.storyId,
      seriesId: original.seriesId,
      universeId: original.universeId,
      meta: { ...originalMeta, isCanon: false },
    },
  });

  return NextResponse.json(duplicate, { status: 201 });
}
