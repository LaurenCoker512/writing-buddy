import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

type Params = { params: { id: string } };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const universe = await prisma.universe.findFirst({
    where: { id: params.id, userId: session.user.id },
  });

  if (!universe) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const documents = await prisma.document.findMany({
    where: { universeId: params.id },
    select: { id: true, name: true, type: true },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });

  return NextResponse.json(documents);
}
