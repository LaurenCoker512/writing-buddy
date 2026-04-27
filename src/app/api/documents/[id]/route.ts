import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { findOwnedDocument } from "@/lib/db-helpers";

type Params = { params: { id: string } };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const document = await findOwnedDocument(params.id, session.user.id);
  if (!document) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(document);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const existing = await findOwnedDocument(params.id, session.user.id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json()) as Record<string, unknown>;
  const data: {
    name?: string;
    order?: number | null;
    parentDocumentId?: string | null;
    tiptapJson?: Prisma.InputJsonValue;
    meta?: Prisma.InputJsonValue;
  } = {};

  if (typeof body.name === "string" && body.name.trim() !== "") {
    data.name = body.name.trim();
  }
  if (body.order !== undefined) {
    data.order = typeof body.order === "number" ? body.order : null;
  }
  if (body.parentDocumentId !== undefined) {
    data.parentDocumentId =
      typeof body.parentDocumentId === "string" ? body.parentDocumentId : null;
  }
  if (body.tiptapJson !== undefined && typeof body.tiptapJson === "object" && body.tiptapJson !== null) {
    data.tiptapJson = body.tiptapJson as Prisma.InputJsonValue;
  }
  if (body.meta !== undefined && typeof body.meta === "object" && body.meta !== null && !Array.isArray(body.meta)) {
    data.meta = body.meta as Prisma.InputJsonValue;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  if (
    existing.type === "RELATIONSHIP" &&
    typeof body.meta === "object" &&
    body.meta !== null &&
    !Array.isArray(body.meta)
  ) {
    const incomingMeta = body.meta as Record<string, unknown>;
    if (
      Array.isArray(incomingMeta.characterIds) &&
      incomingMeta.characterIds.length === 2 &&
      incomingMeta.characterIds.every((id) => typeof id === "string")
    ) {
      const [idA, idB] = incomingMeta.characterIds as [string, string];
      const scopeWhere = existing.storyId
        ? { storyId: existing.storyId }
        : existing.seriesId
          ? { seriesId: existing.seriesId }
          : existing.universeId
            ? { universeId: existing.universeId }
            : null;

      if (scopeWhere !== null) {
        const siblings = await prisma.document.findMany({
          where: { ...scopeWhere, type: "RELATIONSHIP", id: { not: existing.id } },
          select: { meta: true },
        });

        const conflict = siblings.some((sib) => {
          if (typeof sib.meta !== "object" || sib.meta === null || Array.isArray(sib.meta)) return false;
          const sibIds = (sib.meta as Record<string, unknown>).characterIds;
          if (!Array.isArray(sibIds) || sibIds.length !== 2) return false;
          const [sA, sB] = sibIds as [string, string];
          return (sA === idA && sB === idB) || (sA === idB && sB === idA);
        });

        if (conflict) {
          return NextResponse.json(
            { error: "A relationship between these two characters already exists." },
            { status: 409 },
          );
        }
      }
    }
  }

  const updated = await prisma.document.update({
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

  const existing = await findOwnedDocument(params.id, session.user.id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.document.delete({ where: { id: params.id } });

  return new NextResponse(null, { status: 204 });
}
