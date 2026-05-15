import type { Editor } from "@tiptap/core";
import { diffWords } from "diff";
import type { DiffProposal } from "@/types/diff";
import type { TipTapNode, TipTapMark } from "@/lib/tiptap-to-markdown";
import { markdownToTipTapNodes } from "@/lib/markdown-to-tiptap";
import { replaceSectionInTipTap, appendSectionToTipTap } from "@/lib/section-utils";
import type { TipTapDoc } from "@/lib/section-utils";

const HAS_HEADING_RE = /^#{1,3} /m;

function trackedMark(markType: "trackedInsert" | "trackedDelete", proposalId: string): TipTapMark {
  return { type: markType, attrs: { proposalId } };
}

function addMarkToAllText(nodes: TipTapNode[], mark: TipTapMark): TipTapNode[] {
  return nodes.map((node) => {
    if (node.type === "text") {
      return { ...node, marks: [...(node.marks ?? []), mark] };
    }
    if (node.content !== undefined) {
      return { ...node, content: addMarkToAllText(node.content, mark) };
    }
    return node;
  });
}

function stripLeadingHeading(markdown: string): string {
  return markdown.replace(/^#{1,3} [^\n]*\n?/, "").trim();
}

function buildWordDiffNodes(
  beforeBody: string,
  newBody: string,
  proposalId: string,
): TipTapNode[] {
  const changes = diffWords(beforeBody, newBody);
  const paragraphs: TipTapNode[] = [];
  let currentContent: TipTapNode[] = [];

  function flushParagraph() {
    if (currentContent.length > 0) {
      paragraphs.push({ type: "paragraph", content: currentContent });
      currentContent = [];
    }
  }

  for (const change of changes) {
    const parts = change.value.split(/\n\n+/);
    for (let idx = 0; idx < parts.length; idx++) {
      if (idx > 0) flushParagraph();
      const text = parts[idx].replace(/\n/g, " ").trim();
      if (text === "") continue;

      if (change.added === true) {
        currentContent.push({ type: "text", text, marks: [trackedMark("trackedInsert", proposalId)] });
      } else if (change.removed === true) {
        currentContent.push({ type: "text", text, marks: [trackedMark("trackedDelete", proposalId)] });
      } else {
        currentContent.push({ type: "text", text });
      }
    }
  }

  flushParagraph();
  return paragraphs;
}

export function applyTrackedChangesToEditor(editor: Editor, proposal: DiffProposal): void {
  const currentDoc = editor.getJSON() as TipTapDoc;
  const { id: proposalId, heading, headingLevel, beforeMarkdown, newMarkdown, isNew } = proposal;

  if (isNew) {
    const markedNodes = addMarkToAllText(
      markdownToTipTapNodes(newMarkdown),
      trackedMark("trackedInsert", proposalId),
    );
    editor.commands.setContent(appendSectionToTipTap(currentDoc, markedNodes));
    return;
  }

  const beforeBody = stripLeadingHeading(beforeMarkdown);
  const newBody = stripLeadingHeading(newMarkdown);

  const headingNode: TipTapNode = {
    type: "heading",
    attrs: { level: headingLevel },
    content: [{ type: "text", text: heading ?? "" }],
  };

  let bodyNodes: TipTapNode[];
  if (HAS_HEADING_RE.test(beforeBody)) {
    // Fallback: full-section block for complex multi-section content
    bodyNodes = [
      ...addMarkToAllText(
        markdownToTipTapNodes(newBody),
        trackedMark("trackedInsert", proposalId),
      ),
      ...addMarkToAllText(
        markdownToTipTapNodes(beforeBody),
        trackedMark("trackedDelete", proposalId),
      ),
    ];
  } else {
    bodyNodes = buildWordDiffNodes(beforeBody, newBody, proposalId);
  }

  editor.commands.setContent(
    replaceSectionInTipTap(currentDoc, heading ?? "", [headingNode, ...bodyNodes]),
  );
}

function matchesProposal(mark: TipTapMark, markType: string, proposalId: string): boolean {
  return mark.type === markType && mark.attrs?.["proposalId"] === proposalId;
}

function resolveNodes(
  nodes: TipTapNode[],
  proposalId: string,
  accept: boolean,
): TipTapNode[] {
  const result: TipTapNode[] = [];

  for (const node of nodes) {
    if (node.type === "text") {
      const hasInsert = node.marks?.some((m) => matchesProposal(m, "trackedInsert", proposalId)) ?? false;
      const hasDelete = node.marks?.some((m) => matchesProposal(m, "trackedDelete", proposalId)) ?? false;

      if (accept) {
        if (hasDelete) continue;
        result.push(
          hasInsert
            ? { ...node, marks: node.marks?.filter((m) => !matchesProposal(m, "trackedInsert", proposalId)) }
            : node,
        );
      } else {
        if (hasInsert) continue;
        result.push(
          hasDelete
            ? { ...node, marks: node.marks?.filter((m) => !matchesProposal(m, "trackedDelete", proposalId)) }
            : node,
        );
      }
    } else if (node.content !== undefined) {
      const newContent = resolveNodes(node.content, proposalId, accept);
      // Drop structurally empty paragraphs left behind by removals
      if (node.type === "paragraph" && newContent.length === 0) continue;
      result.push({ ...node, content: newContent });
    } else {
      result.push(node);
    }
  }

  return result;
}

export function resolveTrackedChanges(
  editor: Editor,
  proposalId: string,
  accept: boolean,
): void {
  const currentDoc = editor.getJSON() as TipTapDoc;
  const newDoc: TipTapDoc = {
    ...currentDoc,
    content: resolveNodes(currentDoc.content ?? [], proposalId, accept),
  };
  editor.commands.setContent(newDoc);
}
