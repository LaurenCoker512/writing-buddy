import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { tiptapToMarkdown } from "@/lib/tiptap-to-markdown";
import type { TipTapNode } from "@/lib/tiptap-to-markdown";
import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";

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

const styles = StyleSheet.create({
  page: { padding: 56, fontFamily: "Helvetica" },
  title: { fontSize: 24, marginBottom: 24, fontFamily: "Helvetica-Bold" },
  h1: { fontSize: 18, marginTop: 16, marginBottom: 8, fontFamily: "Helvetica-Bold" },
  h2: { fontSize: 15, marginTop: 14, marginBottom: 6, fontFamily: "Helvetica-Bold" },
  h3: { fontSize: 13, marginTop: 12, marginBottom: 4, fontFamily: "Helvetica-Bold" },
  paragraph: { fontSize: 11, lineHeight: 1.6, marginBottom: 8 },
  rule: { borderBottom: 1, borderColor: "#ccc", marginVertical: 12 },
});

function MarkdownToPdf({ title, markdown }: { title: string; markdown: string }) {
  const lines = markdown.split("\n");

  const elements: React.ReactElement[] = [
    React.createElement(Text, { key: "title", style: styles.title }, title),
  ];

  lines.forEach((line, idx) => {
    const key = String(idx);
    if (line.startsWith("# ")) {
      elements.push(React.createElement(Text, { key, style: styles.h1 }, line.slice(2)));
    } else if (line.startsWith("## ")) {
      elements.push(React.createElement(Text, { key, style: styles.h2 }, line.slice(3)));
    } else if (line.startsWith("### ")) {
      elements.push(React.createElement(Text, { key, style: styles.h3 }, line.slice(4)));
    } else if (line === "---") {
      elements.push(React.createElement(View, { key, style: styles.rule }));
    } else if (line.trim() !== "") {
      elements.push(
        React.createElement(Text, { key, style: styles.paragraph }, line.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1").replace(/<u>(.+?)<\/u>/g, "$1")),
      );
    }
  });

  return React.createElement(
    Document,
    null,
    React.createElement(Page, { size: "A4", style: styles.page },
      React.createElement(View, null, ...elements),
    ),
  );
}

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const document = await findOwnedDocument(params.id, session.user.id);
  if (!document) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const markdown = tiptapToMarkdown(document.tiptapJson as TipTapNode);
  const pdfComponent = React.createElement(MarkdownToPdf, {
    title: document.name,
    markdown,
  });

  const buffer = await renderToBuffer(pdfComponent);
  const filename = `${document.name.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-")}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
