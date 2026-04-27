import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { tiptapToMarkdown } from "@/lib/tiptap-to-markdown";
import type { TipTapNode } from "@/lib/tiptap-to-markdown";
import { findOwnedDocument } from "@/lib/db-helpers";

type Params = { params: { id: string } };

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
