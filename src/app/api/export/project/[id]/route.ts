import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { tiptapToMarkdown } from "@/lib/tiptap-to-markdown";
import type { TipTapNode } from "@/lib/tiptap-to-markdown";
import { DOCUMENT_SECTION_LABELS } from "@/lib/documents";
import type { DocumentTypeValue } from "@/lib/documents";
import { toSafeFilename } from "@/lib/export";
import JSZip from "jszip";
import type { RouteParams } from "@/types/route";

export async function GET(_req: NextRequest, { params }: RouteParams<{ id: string }>) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const story = await prisma.story.findFirst({
    where: { id, userId: session.user.id },
    include: {
      documents: {
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      },
    },
  });

  if (!story) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const zip = new JSZip();
  const safeStoryName = toSafeFilename(story.name);
  const root = zip.folder(safeStoryName)!;

  const readme = [
    `# ${story.name}`,
    `Mode: ${story.mode}  Rating: ${story.rating}`,
    "",
    "Exported from Writing Buddy.",
  ].join("\n");
  root.file("README.md", readme);

  for (const doc of story.documents) {
    const section = DOCUMENT_SECTION_LABELS[doc.type as DocumentTypeValue] ?? doc.type;
    const folder = root.folder(section)!;
    const markdown = tiptapToMarkdown(doc.tiptapJson as TipTapNode);
    const safeDocName = toSafeFilename(doc.name);
    folder.file(`${safeDocName}.md`, `# ${doc.name}\n\n${markdown}`);
  }

  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  const filename = `${safeStoryName}.zip`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
