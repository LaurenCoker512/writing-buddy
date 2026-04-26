import { parseLoglines } from "@/lib/brainstorm";

describe("parseLoglines", () => {
  test("extracts exactly count loglines from a numbered list", () => {
    const content = `1. A lone detective uncovers a conspiracy that reaches the highest levels of government.
2. Two rival chefs must collaborate to save their town from a mysterious food shortage.
3. An astronaut stranded on Mars discovers she is not alone.
4. A grieving father travels back in time but risks erasing his own existence.
5. A forgotten wizard must train the last hero before the ancient darkness returns.`;

    const result = parseLoglines(content, 5);
    expect(result).toHaveLength(5);
    expect(result[0]).toBe(
      "A lone detective uncovers a conspiracy that reaches the highest levels of government.",
    );
    expect(result[4]).toBe(
      "A forgotten wizard must train the last hero before the ancient darkness returns.",
    );
  });

  test("strips numbering with period format", () => {
    const content = "1. First logline.\n2. Second logline.";
    const result = parseLoglines(content, 2);
    expect(result[0]).toBe("First logline.");
    expect(result[1]).toBe("Second logline.");
  });

  test("strips numbering with parenthesis format", () => {
    const content = "1) First logline.\n2) Second logline.";
    const result = parseLoglines(content, 2);
    expect(result[0]).toBe("First logline.");
    expect(result[1]).toBe("Second logline.");
  });

  test("returns fewer than count when model provides fewer non-empty lines", () => {
    const content = "1. Only one logline here.";
    const result = parseLoglines(content, 5);
    expect(result.length).toBe(1);
    expect(result[0]).toBe("Only one logline here.");
  });

  test("ignores blank lines between items", () => {
    const content = `1. First logline.

2. Second logline.

3. Third logline.`;
    const result = parseLoglines(content, 3);
    expect(result).toHaveLength(3);
  });

  test("truncates to count when model returns more lines", () => {
    const lines = Array.from({ length: 8 }, (_, i) => `${i + 1}. Logline ${i + 1}.`).join("\n");
    const result = parseLoglines(lines, 5);
    expect(result).toHaveLength(5);
  });
});
