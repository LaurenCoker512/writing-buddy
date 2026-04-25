import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isMode, isRating, toOptionalString } from "@/lib/hierarchy";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const series = await prisma.series.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(series);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as Record<string, unknown>;

  if (typeof body.name !== "string" || body.name.trim() === "") {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (!isMode(body.mode)) {
    return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
  }
  if (!isRating(body.rating)) {
    return NextResponse.json({ error: "Invalid rating" }, { status: 400 });
  }

  const seriesItem = await prisma.series.create({
    data: {
      userId: session.user.id,
      name: body.name.trim(),
      mode: body.mode,
      rating: body.rating,
      sourceTitle: toOptionalString(body.sourceTitle),
      universeId:
        typeof body.universeId === "string" ? body.universeId : null,
    },
  });

  return NextResponse.json(seriesItem, { status: 201 });
}
