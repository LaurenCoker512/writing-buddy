import { Mark, mergeAttributes } from "@tiptap/core";

export const TrackedInsert = Mark.create({
  name: "trackedInsert",

  addAttributes() {
    return {
      proposalId: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-proposal-id"),
        renderHTML: (attrs: { proposalId: string | null }) =>
          attrs.proposalId !== null ? { "data-proposal-id": attrs.proposalId } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: "ins[data-proposal-id]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "ins",
      mergeAttributes(HTMLAttributes, {
        class: "bg-green-100 text-green-900 no-underline",
      }),
      0,
    ];
  },
});

export const TrackedDelete = Mark.create({
  name: "trackedDelete",

  addAttributes() {
    return {
      proposalId: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-proposal-id"),
        renderHTML: (attrs: { proposalId: string | null }) =>
          attrs.proposalId !== null ? { "data-proposal-id": attrs.proposalId } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: "del[data-proposal-id]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "del",
      mergeAttributes(HTMLAttributes, {
        class: "line-through bg-red-100 text-red-400",
      }),
      0,
    ];
  },
});
