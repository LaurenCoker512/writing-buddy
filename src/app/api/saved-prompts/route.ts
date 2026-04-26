import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isMode } from "@/lib/hierarchy";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const prompts = await prisma.savedPrompt.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(prompts);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as Record<string, unknown>;

  if (typeof body.content !== "string" || body.content.trim() === "") {
    return NextResponse.json({ error: "Content is required" }, { status: 400 });
  }
  if (!isMode(body.mode)) {
    return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
  }

  const prompt = await prisma.savedPrompt.create({
    data: {
      userId: session.user.id,
      content: body.content.trim(),
      mode: body.mode,
      sourceTitle:
        body.mode === "FANFIC" &&
        typeof body.sourceTitle === "string" &&
        body.sourceTitle.trim() !== ""
          ? body.sourceTitle.trim()
          : null,
    },
  });

  return NextResponse.json(prompt, { status: 201 });
}
