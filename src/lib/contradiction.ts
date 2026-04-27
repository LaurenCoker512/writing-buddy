import { estimateTokens } from "@/lib/ai-context";

export interface DocForCheck {
  name: string;
  type: string;
  content: string;
}

export function estimateContradictionTokens(docs: DocForCheck[]): number {
  if (docs.length === 0) return 0;
  const combined = docs.map((d) => `### ${d.name} (${d.type})\n${d.content}`).join("\n\n");
  return estimateTokens(combined);
}
