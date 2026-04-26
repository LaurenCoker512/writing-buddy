import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { tiptapToMarkdown } from "@/lib/tiptap-to-markdown";
import type { TipTapNode } from "@/lib/tiptap-to-markdown";

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
  return ownerId === userId ? document : null;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const document = await findOwnedDocument(params.id, session.user.id);
  if (!document) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const markdown = tiptapToMarkdown(document.tiptapJson as TipTapNode);
  const filename = `${document.name.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-")}.md`;

  return new NextResponse(markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
