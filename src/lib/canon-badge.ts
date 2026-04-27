export type BadgeSegment =
  | { type: "text"; content: string }
  | { type: "canon" }
  | { type: "au" };

const BADGE_PATTERN = /(\*\*\[Canon\]\*\*|\[Canon\]|\*\*\[AU\]\*\*|\[AU\])/gi;

export function parseInlineBadges(text: string): BadgeSegment[] {
  const segments: BadgeSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  BADGE_PATTERN.lastIndex = 0;
  while ((match = BADGE_PATTERN.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: "text", content: text.slice(lastIndex, match.index) });
    }
    if (match[0].toLowerCase().includes("canon")) {
      segments.push({ type: "canon" });
    } else {
      segments.push({ type: "au" });
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: "text", content: text.slice(lastIndex) });
  }

  return segments.length > 0 ? segments : [{ type: "text", content: text }];
}
