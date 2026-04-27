import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { findOwnedDocument, createVersionWithCap } from "@/lib/db-helpers";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const doc = await findOwnedDocument(id, session.user.id);
  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const versions = await prisma.documentVersion.findMany({
    where: { documentId: id },
    orderBy: { createdAt: "desc" },
    select: { id: true, label: true, createdAt: true },
  });

  return NextResponse.json(versions);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = (await req.json()) as { tiptapJson?: unknown; label?: unknown };

  if (
    !body.tiptapJson ||
    typeof body.tiptapJson !== "object" ||
    Array.isArray(body.tiptapJson)
  ) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const label = typeof body.label === "string" ? body.label : undefined;

  const doc = await findOwnedDocument(id, session.user.id);
  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const version = await createVersionWithCap(id, body.tiptapJson, label);

  return NextResponse.json(version, { status: 201 });
}
