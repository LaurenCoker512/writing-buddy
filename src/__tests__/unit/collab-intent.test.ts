import { detectEditIntent } from "@/lib/collab-intent";

const EDIT_VERBS = [
  "rewrite",
  "edit",
  "revise",
  "change",
  "update",
  "improve",
  "fix",
  "rephrase",
  "expand",
  "shorten",
  "add",
  "remove",
  "reorganize",
  "make",
  "modify",
  "adjust",
];

describe("detectEditIntent — edit verbs", () => {
  test.each(EDIT_VERBS)('"%s ..." returns "edit"', (verb) => {
    expect(detectEditIntent(`${verb} the opening paragraph`)).toBe("edit");
  });

  test.each(EDIT_VERBS)('uppercase "%s ..." returns "edit"', (verb) => {
    expect(detectEditIntent(`${verb.toUpperCase()} the opening paragraph`)).toBe("edit");
  });

  test.each(EDIT_VERBS)('leading whitespace before "%s" returns "edit"', (verb) => {
    expect(detectEditIntent(`  ${verb} the opening paragraph`)).toBe("edit");
  });
});

describe("detectEditIntent — chat intent", () => {
  test("question phrasing returns chat", () => {
    expect(detectEditIntent("what motivates my character?")).toBe("chat");
  });

  test("how-question returns chat", () => {
    expect(detectEditIntent("how should I structure the climax?")).toBe("chat");
  });

  test("edit verb embedded mid-sentence returns chat", () => {
    expect(detectEditIntent("I would like to edit the paragraph")).toBe("chat");
  });

  test("edit verb as a noun mid-sentence returns chat", () => {
    expect(detectEditIntent("please make an edit to the paragraph")).toBe("chat");
  });

  test("empty string returns chat", () => {
    expect(detectEditIntent("")).toBe("chat");
  });

  test("whitespace-only string returns chat", () => {
    expect(detectEditIntent("   ")).toBe("chat");
  });
});
