import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { AnthropicModel } from "@prisma/client";

const VALID_MODELS: AnthropicModel[] = ["HAIKU", "SONNET", "OPUS"];

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as { model?: unknown };

  if (!VALID_MODELS.includes(body.model as AnthropicModel)) {
    return NextResponse.json({ error: "Invalid model" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { anthropicModel: body.model as AnthropicModel },
  });

  return NextResponse.json({ message: "Model updated" });
}
