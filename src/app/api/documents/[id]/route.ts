import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

type Params = { params: { id: string } };

async function findOwnedDocument(id: string, userId: string) {
  const document = await prisma.document.findFirst({
    where: { id },
    include: {
      story: { select: { userId: true } },
      series: { select: { userId: true } },
      universe: { select: { userId: true } },
    },
  });
  if (!document) return null;

  const ownerId =
    document.story?.userId ?? document.series?.userId ?? document.universe?.userId;
  if (ownerId !== userId) return null;

  return document;
}

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
  const data: { name?: string; order?: number | null; tiptapJson?: Prisma.InputJsonValue } = {};

  if (typeof body.name === "string" && body.name.trim() !== "") {
    data.name = body.name.trim();
  }
  if (body.order !== undefined) {
    data.order = typeof body.order === "number" ? body.order : null;
  }
  if (body.tiptapJson !== undefined && typeof body.tiptapJson === "object" && body.tiptapJson !== null) {
    data.tiptapJson = body.tiptapJson as Prisma.InputJsonValue;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
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
