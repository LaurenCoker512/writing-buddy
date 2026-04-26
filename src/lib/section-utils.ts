import type { TipTapNode } from "./tiptap-to-markdown";
import { tiptapToMarkdown } from "./tiptap-to-markdown";

export type TipTapDoc = { type: string; content: TipTapNode[] };

function getHeadingText(node: TipTapNode): string {
  return (node.content ?? []).map((n) => n.text ?? "").join("");
}

function findSection(
  content: TipTapNode[],
  headingText: string,
): { start: number; end: number; level: number } | null {
  for (let i = 0; i < content.length; i++) {
    const node = content[i];
    if (node.type !== "heading") continue;
    if (getHeadingText(node) !== headingText) continue;

    const level = (node.attrs?.level as number) ?? 1;
    let end = i + 1;
    while (end < content.length) {
      const next = content[end];
      if (next.type === "heading" && ((next.attrs?.level as number) ?? 1) <= level) break;
      end++;
    }
    return { start: i, end, level };
  }
  return null;
}

export function replaceSectionInTipTap(
  doc: TipTapDoc,
  headingText: string,
  newNodes: TipTapNode[],
): TipTapDoc {
  const content = doc.content ?? [];
  const section = findSection(content, headingText);
  if (!section) return doc;

  return {
    ...doc,
    content: [
      ...content.slice(0, section.start),
      ...newNodes,
      ...content.slice(section.end),
    ],
  };
}

export function appendSectionToTipTap(doc: TipTapDoc, newNodes: TipTapNode[]): TipTapDoc {
  return {
    ...doc,
    content: [...(doc.content ?? []), ...newNodes],
  };
}

export function getSectionMarkdown(doc: TipTapDoc, headingText: string): string {
  const content = doc.content ?? [];
  const section = findSection(content, headingText);
  if (!section) return "";

  const sectionNodes = content.slice(section.start, section.end);
  return tiptapToMarkdown({ type: "doc", content: sectionNodes } as TipTapNode);
}
