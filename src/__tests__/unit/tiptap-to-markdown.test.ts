import { tiptapToMarkdown, type TipTapNode } from "@/lib/tiptap-to-markdown";

describe("tiptapToMarkdown — heading", () => {
  test("H1 serializes to # prefix", () => {
    const doc: TipTapNode = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "Title" }],
        },
      ],
    };
    expect(tiptapToMarkdown(doc)).toBe("# Title");
  });

  test("H2 serializes to ## prefix", () => {
    const doc: TipTapNode = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "Sub" }],
        },
      ],
    };
    expect(tiptapToMarkdown(doc)).toBe("## Sub");
  });

  test("H3 serializes to ### prefix", () => {
    const doc: TipTapNode = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 3 },
          content: [{ type: "text", text: "Deep" }],
        },
      ],
    };
    expect(tiptapToMarkdown(doc)).toBe("### Deep");
  });
});

describe("tiptapToMarkdown — bold", () => {
  test("bold text wraps in **", () => {
    const doc: TipTapNode = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "hello", marks: [{ type: "bold" }] }],
        },
      ],
    };
    expect(tiptapToMarkdown(doc)).toBe("**hello**");
  });

  test("italic text wraps in *", () => {
    const doc: TipTapNode = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "world", marks: [{ type: "italic" }] }],
        },
      ],
    };
    expect(tiptapToMarkdown(doc)).toBe("*world*");
  });

  test("underline text wraps in <u>", () => {
    const doc: TipTapNode = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "under", marks: [{ type: "underline" }] }],
        },
      ],
    };
    expect(tiptapToMarkdown(doc)).toBe("<u>under</u>");
  });
});

describe("tiptapToMarkdown — lists", () => {
  test("bullet list items use - prefix", () => {
    const doc: TipTapNode = {
      type: "doc",
      content: [
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                { type: "paragraph", content: [{ type: "text", text: "Alpha" }] },
              ],
            },
            {
              type: "listItem",
              content: [
                { type: "paragraph", content: [{ type: "text", text: "Beta" }] },
              ],
            },
          ],
        },
      ],
    };
    expect(tiptapToMarkdown(doc)).toBe("- Alpha\n- Beta");
  });

  test("ordered list items use numbered prefix", () => {
    const doc: TipTapNode = {
      type: "doc",
      content: [
        {
          type: "orderedList",
          content: [
            {
              type: "listItem",
              content: [
                { type: "paragraph", content: [{ type: "text", text: "First" }] },
              ],
            },
            {
              type: "listItem",
              content: [
                { type: "paragraph", content: [{ type: "text", text: "Second" }] },
              ],
            },
          ],
        },
      ],
    };
    expect(tiptapToMarkdown(doc)).toBe("1. First\n2. Second");
  });
});

describe("tiptapToMarkdown — table", () => {
  test("table serializes with header row and separator", () => {
    const doc: TipTapNode = {
      type: "doc",
      content: [
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [
                {
                  type: "tableHeader",
                  content: [
                    { type: "paragraph", content: [{ type: "text", text: "Name" }] },
                  ],
                },
                {
                  type: "tableHeader",
                  content: [
                    { type: "paragraph", content: [{ type: "text", text: "Role" }] },
                  ],
                },
              ],
            },
            {
              type: "tableRow",
              content: [
                {
                  type: "tableCell",
                  content: [
                    { type: "paragraph", content: [{ type: "text", text: "Frodo" }] },
                  ],
                },
                {
                  type: "tableCell",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "Protagonist" }],
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    };
    const result = tiptapToMarkdown(doc);
    expect(result).toContain("| Name | Role |");
    expect(result).toContain("|---|---|");
    expect(result).toContain("| Frodo | Protagonist |");
  });
});

describe("tiptapToMarkdown — horizontal rule", () => {
  test("horizontal rule serializes to ---", () => {
    const doc: TipTapNode = {
      type: "doc",
      content: [{ type: "horizontalRule" }],
    };
    expect(tiptapToMarkdown(doc)).toBe("---");
  });
});
