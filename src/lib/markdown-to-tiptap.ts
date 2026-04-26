import type { TipTapNode } from "./tiptap-to-markdown";

export function markdownToTipTapNodes(markdown: string): TipTapNode[] {
  const lines = markdown.split("\n");
  const nodes: TipTapNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") {
      i++;
      continue;
    }

    const headingMatch = /^(#{1,3})\s+(.+)$/.exec(line);
    if (headingMatch) {
      nodes.push({
        type: "heading",
        attrs: { level: headingMatch[1].length },
        content: parseInline(headingMatch[2]),
      });
      i++;
      continue;
    }

    if (line.startsWith("- ")) {
      const items: TipTapNode[] = [];
      while (i < lines.length && lines[i].startsWith("- ")) {
        items.push({
          type: "listItem",
          content: [{ type: "paragraph", content: parseInline(lines[i].slice(2)) }],
        });
        i++;
      }
      nodes.push({ type: "bulletList", content: items });
      continue;
    }

    if (/^\d+\.\s/.test(line)) {
      const items: TipTapNode[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        const text = lines[i].replace(/^\d+\.\s/, "");
        items.push({
          type: "listItem",
          content: [{ type: "paragraph", content: parseInline(text) }],
        });
        i++;
      }
      nodes.push({ type: "orderedList", content: items });
      continue;
    }

    nodes.push({ type: "paragraph", content: parseInline(line) });
    i++;
  }

  return nodes;
}

function parseInline(text: string): TipTapNode[] {
  const nodes: TipTapNode[] = [];
  let lastIndex = 0;
  const pattern = /\*\*(.+?)\*\*|\*(.+?)\*|<u>(.+?)<\/u>/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push({ type: "text", text: text.slice(lastIndex, match.index) });
    }

    if (match[1] !== undefined) {
      nodes.push({ type: "text", text: match[1], marks: [{ type: "bold" }] });
    } else if (match[2] !== undefined) {
      nodes.push({ type: "text", text: match[2], marks: [{ type: "italic" }] });
    } else if (match[3] !== undefined) {
      nodes.push({ type: "text", text: match[3], marks: [{ type: "underline" }] });
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    nodes.push({ type: "text", text: text.slice(lastIndex) });
  }

  return nodes.length > 0 ? nodes : [{ type: "text", text: "" }];
}
