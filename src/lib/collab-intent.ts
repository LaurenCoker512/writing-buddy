const EDIT_VERB_RE =
  /^(rewrite|edit|revise|change|update|improve|fix|rephrase|expand|shorten|add|remove|reorganize|make|modify|adjust)\b/i;

export function detectEditIntent(message: string): "edit" | "chat" {
  return EDIT_VERB_RE.test(message.trimStart()) ? "edit" : "chat";
}
