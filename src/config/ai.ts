/**
 * AI configuration constants.
 *
 * Centralised here so token budgets, retention limits, and cache TTLs are
 * adjusted in one place rather than scattered across API routes.
 *
 * See SPEC.md §20 for descriptions and rationale for each value.
 */

export const AI_CONFIG = {
  // ---------------------------------------------------------------------------
  // Chat history retention
  // ---------------------------------------------------------------------------

  /** Messages sent to the AI in full as recent context (Tier 1). Represents 2 complete exchanges. */
  CHAT_FULL_WINDOW: 4,

  /**
   * Maximum messages retained in the database per document.
   * Summarisation is triggered once this limit is reached.
   */
  CHAT_RETENTION_LIMIT: 80,

  /**
   * Number of oldest messages summarised and deleted per summarisation pass.
   * After one pass, the document retains at most CHAT_RETENTION_LIMIT − CHAT_SUMMARIZE_BATCH messages.
   */
  CHAT_SUMMARIZE_BATCH: 30,

  // ---------------------------------------------------------------------------
  // Document version history
  // ---------------------------------------------------------------------------

  /**
   * Maximum DocumentVersion rows retained per document.
   * The oldest version is deleted before a new one is inserted once the cap is reached.
   */
  DOCUMENT_VERSION_CAP: 100,

  // ---------------------------------------------------------------------------
  // AI context token budget
  // ---------------------------------------------------------------------------

  /** Total token budget allocated to all Tier 2 summaries in a single AI call. */
  AI_TIER2_BUDGET_TOKENS: 6_000,

  /**
   * Token estimate threshold above which the contradiction checker shows a
   * confirmation prompt before sending. Set to 0 to always show the prompt.
   */
  CONTRADICTION_WARN_THRESHOLD_TOKENS: 0,

  // ---------------------------------------------------------------------------
  // OpenRouter
  // ---------------------------------------------------------------------------

  /** Default model used for all AI chat and summarisation calls. */
  OPENROUTER_DEFAULT_MODEL: "openai/gpt-4o-mini",

} as const;

// Fanfic mode (v1): no cache constants needed.
// Canon context is user-supplied via the copy-paste ingestion flow (SPEC.md §9).
// Live web search and a cache TTL are deferred to v2 (SPEC.md §19).
