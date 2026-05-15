export type TipTapMark = { type: string; attrs?: Record<string, unknown> };

export type TipTapNode = {
  type: string;
  content?: TipTapNode[];
  text?: string;
  marks?: TipTapMark[];
  attrs?: Record<string, unknown>;
};

export function tiptapToMarkdown(doc: TipTapNode): string {
  return serializeNode(doc).trim();
}

function serializeNode(node: TipTapNode): string {
  switch (node.type) {
    case "doc":
      return (node.content ?? []).map(serializeNode).join("\n\n");
    case "heading": {
      const level = (node.attrs?.level as number) ?? 1;
      const hashes = "#".repeat(level);
      return `${hashes} ${serializeInline(node.content ?? [])}`;
    }
    case "paragraph":
      return serializeInline(node.content ?? []);
    case "bulletList":
      return (node.content ?? []).map(serializeNode).join("\n");
    case "orderedList":
      return (node.content ?? [])
        .map((item, index) => `${index + 1}. ${serializeListItemContent(item)}`)
        .join("\n");
    case "listItem":
      return `- ${serializeListItemContent(node)}`;
    case "table":
      return serializeTable(node);
    case "horizontalRule":
      return "---";
    default:
      return (node.content ?? []).map(serializeNode).join("");
  }
}

function serializeListItemContent(item: TipTapNode): string {
  return (item.content ?? [])
    .map((child) =>
      child.type === "paragraph"
        ? serializeInline(child.content ?? [])
        : serializeNode(child),
    )
    .join("\n");
}

function serializeInline(nodes: TipTapNode[]): string {
  return nodes
    .map((node) => {
      if (node.type !== "text") return serializeNode(node);
      let text = node.text ?? "";
      const marks = node.marks ?? [];
      if (marks.some((m) => m.type === "bold")) text = `**${text}**`;
      if (marks.some((m) => m.type === "italic")) text = `*${text}*`;
      if (marks.some((m) => m.type === "underline")) text = `<u>${text}</u>`;
      return text;
    })
    .join("");
}

function serializeTable(node: TipTapNode): string {
  const rows = node.content ?? [];
  return rows
    .map((row, rowIndex) => {
      const cells = (row.content ?? []).map((cell) => {
        const text = (cell.content ?? [])
          .map((p) =>
            p.type === "paragraph"
              ? serializeInline(p.content ?? [])
              : serializeNode(p),
          )
          .join("");
        return ` ${text} `;
      });
      const rowLine = `|${cells.join("|")}|`;
      if (rowIndex === 0) {
        const sep = `|${cells.map(() => "---").join("|")}|`;
        return `${rowLine}\n${sep}`;
      }
      return rowLine;
    })
    .join("\n");
}
