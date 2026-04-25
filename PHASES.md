# Writing Buddy — Implementation Phases

Each phase produces a deployable application. Later phases layer features onto a working base without structural rework.

---

## Phase 1: Project Scaffold ✅

**Goal:** A deployable Next.js app with a complete Prisma schema, no auth or features yet.

### Deliverables

- Next.js 14+ (App Router) + TypeScript + Tailwind CSS project scaffold
- Full Prisma schema — all models, enums, and relations as defined in SPEC §6 (even if most tables are empty until later phases)
- Basic routing structure — placeholder pages for `/`, `/dashboard`, `/settings`
- Environment variable setup (`.env.example`, validation on boot)

### Tests

**Unit**
- Prisma schema lints without error (`prisma validate`)
- TypeScript compiles with zero errors

---

## Phase 2: Authentication ✅

**Goal:** Users can register, sign in, and be redirected away from protected routes.

### Deliverables

- Auth.js (NextAuth v5) with Prisma adapter
  - Email/password credentials provider (bcrypt password hashing)
  - Google OAuth provider
- Session-protected routes — redirect unauthenticated users to login
- Dashboard shell — authenticated landing page, empty state ("No projects yet")
- Register and sign-in pages with form validation

### Tests

**Unit**
- Password hashing — bcrypt hash/verify roundtrip
- Auth.js session token validation helper

**Integration**
- `POST /api/auth/register` — creates user, hashes password, returns session
- `POST /api/auth/signin` — valid credentials → session; wrong password → 401

**E2E**
- Register a new account; verify redirect to dashboard
- Sign in with existing credentials; verify session persists across page reload
- Unauthenticated request to `/dashboard` redirects to sign-in

---

## Phase 3: Settings & Account Management ☐

**Goal:** Users can manage their OpenRouter API key and delete their account.

### Deliverables

- Settings page with OpenRouter API key entry
  - AES-256-GCM encryption at rest (`OPENROUTER_ENCRYPTION_KEY` env var)
  - Key never returned to client after submission
  - Basic "Key saved" / "Key updated" UI
- Account deletion with full cascade (per SPEC §6 Deletion Behavior)

### Tests

**Unit**
- `encryptApiKey` / `decryptApiKey` — roundtrip, wrong key returns error

**Integration**
- `PATCH /api/settings/api-key` — saves encrypted key; verify stored value differs from plaintext
- `DELETE /api/account` — cascades all owned rows; returns 204

---

## Phase 4: Project Hierarchy — API ☐

**Goal:** Full CRUD API for the Universe → Series → Story hierarchy with correct cascade behavior.

### Deliverables

- CRUD API routes for `Universe`, `Series`, and `Story`
  - Create with name, mode (`ORIGINAL` | `FANFIC`), and rating (`G` | `T` | `M` | `E`)
  - Rename, delete (with cascade behavior per SPEC §6 Deletion Behavior)
  - All hierarchy combinations: standalone Story, Series without Universe, full chain
- Cascade delete logic — deleting Universe sets `Series.universeId` to null; deleting Series sets `Story.seriesId` to null

### Tests

**Unit**
- Cascade delete logic — deleting Universe nullifies `Series.universeId`; deleting Series nullifies `Story.seriesId`
- Hierarchy validation — Story without Universe in a standalone Series has null `universeId`

**Integration**
- `POST /api/universes` — creates Universe with correct fields
- `POST /api/series` — creates Series with optional `universeId`
- `POST /api/stories` — creates Story with optional `seriesId`/`universeId`
- `DELETE /api/universes/[id]` — orphaned Series still exist with null `universeId`

---

## Phase 5: Project Hierarchy — Sidebar UI ☐

**Goal:** A collapsible, responsive sidebar showing the user's full project tree.

### Deliverables

- Collapsible tree sidebar (per SPEC §7)
  - Expand/collapse per node
  - `...` context menu: rename, delete
  - `+ New Project` button
  - Active item highlighted
- Dashboard populated with the user's project tree
- Sidebar collapses to icon-only on tablet; hidden behind hamburger on mobile (per SPEC §17)

### Tests

**E2E**
- Create Universe → Series → Story; verify sidebar tree renders the full chain
- Rename a Story; verify updated name appears in sidebar
- Delete a Universe; verify orphaned Series still exist with null `universeId`
- Sidebar collapse/expand on desktop
- Sidebar hamburger on mobile viewport

---

## Phase 6: Document CRUD & Sidebar Entries ☐

**Goal:** Documents can be created, renamed, deleted, and reordered, and appear in the sidebar grouped by section.

### Deliverables

- Document CRUD API routes (`/api/documents/[id]`)
  - Create with `type`, `name`, and `storyId`/`seriesId`/`universeId` scope
  - Rename, delete (with character→relationship cascade warning per SPEC §6)
  - Reorder (Scene `order` field)
- Document sidebar entries — grouped by section (Characters, Relationships, etc.) under each Story

### Tests

**Unit**
- Document scope rules — document with `storyId` set and `seriesId`/`universeId` null is valid; vice versa valid per SPEC §6 scope table

**Integration**
- `POST /api/documents` — creates document with correct scope fields
- `PATCH /api/documents/[id]` — updates `name` and `updatedAt`
- `DELETE /api/documents/[id]` — cascades `DocumentVersion` and `ChatMessage` rows

---

## Phase 7: TipTap Editor & Autosave ☐

**Goal:** A fully featured rich-text editor with silent autosave.

### Deliverables

- TipTap editor with all supported formatting (per SPEC §8): H1–H3, paragraph, bold, italic, underline, bulleted/numbered lists, tables, horizontal rules
- Autosave — debounced 2-second PATCH to `/api/documents/[id]`; silent (no version created)

### Tests

**Unit**
- TipTap JSON → Markdown serialization — heading, bold, list, table round-trips
- Autosave debounce — rapid keystrokes produce one PATCH, not many

**Integration**
- `PATCH /api/documents/[id]` — updates `tiptapJson` and `updatedAt`

**E2E**
- Create a Character document; type content; navigate away and return; verify content persisted

---

## Phase 8: Split-View Layout ☐

**Goal:** The workspace uses a two-panel split-view with a draggable divider and responsive stacking.

### Deliverables

- Split-view workspace layout — editor panel left, empty right panel (AI chat arrives in Phase 10)
  - Draggable divider between panels
  - Vertical stack on tablet; single-panel toggle on mobile

### Tests

**E2E**
- Drag the divider to resize panels; verify both panels remain visible and functional
- On tablet viewport, verify panels stack vertically
- On mobile viewport, verify single-panel toggle hides and reveals the second panel

---

## Phase 9: Document Export ☐

**Goal:** Individual documents and whole projects can be exported in multiple formats.

### Deliverables

- Per-document export (toolbar + `...` menu)
  - Markdown — serialize TipTap JSON via `prosemirror-markdown`, trigger `.md` download
  - Copy to clipboard — same Markdown serialization, no download
  - PDF — server-side via `@react-pdf/renderer` at `/api/export/document/[id]/pdf`
- Project-level zip export at `/api/export/project/[id]` — all documents as Markdown files in mirrored folders + `README.md`

### Tests

**Integration**
- `GET /api/export/document/[id]/pdf` — returns `application/pdf` response
- `GET /api/export/project/[id]` — returns `application/zip` with correct file tree

**E2E**
- Export document as Markdown; verify downloaded file contains correct headings
- Delete a Character document with an associated Relationship; confirm warning appears before deletion

---

## Phase 10: AI Chat — Core ☐

**Goal:** A working AI chat panel with streaming responses backed by OpenRouter.

### Deliverables

- AI chat panel (right side of split view)
  - Message input and send button
  - Message history display (user + assistant bubbles)
  - Streaming responses via SSE (Server-Sent Events)
- `POST /api/ai/chat` — server-side OpenRouter call
  - Tier 1 context: current document full Markdown + most recent `CHAT_FULL_WINDOW` messages
  - System prompt includes project mode and rating
  - User's encrypted API key decrypted server-side; never sent to client
- "No API key" soft nudge — inline prompt in chat panel when key is absent; no global block
- Configuration constants in `src/config/ai.ts` (`CHAT_FULL_WINDOW`)

### Tests

**Unit**
- Tier 1 context builder — assembles correct Markdown + recent messages; omits messages beyond `CHAT_FULL_WINDOW`

**Integration**
- `POST /api/ai/chat` with mock OpenRouter — returns streamed SSE
- `POST /api/ai/chat` without API key — returns 402 with nudge payload, does not call OpenRouter

**E2E**
- Send a message; verify response streams and appears in chat panel

---

## Phase 11: Chat Persistence & Pruning ☐

**Goal:** Chat history is persisted per document and automatically pruned with a rolling summary.

### Deliverables

- Chat history persistence — `ChatMessage` rows per document
- Chat pruning and rolling summary (per SPEC §9)
  - When `ChatMessage` count reaches `CHAT_RETENTION_LIMIT`, summarize oldest `CHAT_SUMMARIZE_BATCH` messages via AI → store in `Document.chatSummary` → delete those messages
  - _"Earlier conversation has been summarized"_ placeholder above oldest visible message
- Configuration constants: `CHAT_RETENTION_LIMIT`, `CHAT_SUMMARIZE_BATCH`

### Tests

**Unit**
- Pruning trigger — fires exactly when count hits `CHAT_RETENTION_LIMIT`, not before
- Summarization batch — selects oldest `CHAT_SUMMARIZE_BATCH` messages, not newest

**Integration**
- `POST /api/ai/chat` — persists `ChatMessage` rows
- Summarization route — given 80 messages, produces rolling summary, deletes 30 oldest, leaves 50

**E2E**
- Send enough messages to trigger pruning; verify summary placeholder appears

---

## Phase 12: AI Diff Proposals ☐

**Goal:** The AI can propose section-level edits displayed as accept/reject diff cards.

### Deliverables

- Section-level diff cards rendered in the chat panel (per SPEC §9)
  - Before / After display per heading section
  - Accept and Reject buttons
  - Cards persist until dismissed (independent of further messages)
  - "New section" variant for additions
- AI diff proposal format — `POST /api/ai/diff` returns structured JSON with proposed section replacements
- Accept flow — replaces matching heading section in TipTap editor; creates `DocumentVersion` snapshot
- Reject flow — dismisses card; no document change; no version entry

### Tests

**Unit**
- Section replacement — given TipTap JSON and a proposed heading section, returns correct updated JSON
- Section append — proposed section with no matching heading appends to document end

**Integration**
- `POST /api/ai/diff` with mock OpenRouter — returns structured diff proposals

**E2E**
- Accept a diff card; verify TipTap editor reflects new content
- Reject a diff card; verify document unchanged

---

## Phase 13: AI Context — Tier 2 ☐

**Goal:** The AI receives richer context from sibling documents via cached summaries within a token budget.

### Deliverables

- `Document.contentSummary` — AI-generated summary of document content; cached; regenerated when `updatedAt` is newer than `contentSummaryGeneratedAt`
- Summaries of sibling documents injected per priority order within `AI_TIER2_BUDGET_TOKENS` limit
- Configuration constant: `AI_TIER2_BUDGET_TOKENS`

### Tests

**Unit**
- Tier 2 priority sort — same-type documents rank first; remaining in specified order
- Tier 2 budget truncation — stops including summaries at token limit; never truncates mid-document

**Integration**
- `contentSummary` regeneration — stale summary is regenerated before next AI call

---

## Phase 14: Version History ☐

**Goal:** A slide-over version history panel lets writers preview and restore prior document states.

### Deliverables

- Version history slide-over panel (per SPEC §13)
  - List of versions: timestamp, optional label
  - Preview — shows document state at that version
  - Restore — creates a new `DocumentVersion` from the restored content and applies it
  - Version cap enforcement: oldest version deleted when `DOCUMENT_VERSION_CAP` is exceeded
- Configuration constant: `DOCUMENT_VERSION_CAP`

### Tests

**Unit**
- Version cap — inserting version when count === cap deletes the oldest before inserting

**Integration**
- `POST /api/documents/[id]/versions` — creates version; enforces cap
- `POST /api/documents/[id]/restore/[versionId]` — creates new version with restored content

**E2E**
- Accept a diff card; verify version appears in history panel
- Restore an older version; verify document reverts; verify new version entry at top of history

---

## Phase 15: Document Type Templates ☐

**Goal:** New documents open with type-specific starter headings and structured metadata fields.

### Deliverables

- Starter templates — when a new document is created, insert the suggested initial headings for its type (per SPEC §10): `CHARACTER`, `RELATIONSHIP`, `WORLDBUILDING`, `PLOT`, `SCENE`
- `Document.meta` JSON handling — read/write per type:
  - `CHARACTER`: `isCanon`, `role` (Protagonist / Antagonist / Supporting / Other)
  - `RELATIONSHIP`: `characterIds` (two IDs), `relationshipType`
  - `WORLDBUILDING`: `category`, `isCanon`
- Type metadata UI — small structured fields above or alongside the TipTap editor for quick-access meta values (role selector, category dropdown, etc.)

### Tests

**Unit**
- Template builder — `buildTemplate('CHARACTER')` returns TipTap JSON with all suggested headings
- `meta` type guard helpers — `isCharacterMeta`, `isRelationshipMeta`, `isWorldbuildingMeta` narrow correctly

**Integration**
- `POST /api/documents` with `type: 'CHARACTER'` — returned document has starter headings in `tiptapJson`
- `PATCH /api/documents/[id]` with `meta` — stored and returned correctly

**E2E**
- Create a Character document; verify starter headings are present in editor
- Set `role` via metadata selector; verify value persists across page reload

---

## Phase 16: Scene Ordering & Document Specialization ☐

**Goal:** Scenes can be drag-reordered in the sidebar, and story-level documents can be linked to Universe-level parents.

### Deliverables

- Scene ordering — drag-and-drop list within the Scenes section of the sidebar; persists `Document.order` field
- Per-story character specialization — link a Story-level document to a Universe-level parent via `Document.parentDocumentId`; visible in the document header as "Specialization of: [Parent Name]"

### Tests

**Unit**
- Scene order insert — inserting between two scenes produces a `Float` value between their `order` values

**Integration**
- Scene reorder — PATCH updates `order`; fetching scenes returns them sorted by `order`

**E2E**
- Drag Scene 3 above Scene 1; verify sidebar order updates

---

## Phase 17: Relationship Map ☐

**Goal:** An interactive graph of characters and relationships, navigable and scoped per story or universe.

### Deliverables

- `/project/[id]/map` route — full-page Relationship Map view
- React Flow graph (per SPEC §11)
  - Nodes: one per CHARACTER document; display name and role tag
  - Edges: one per RELATIONSHIP document; labeled with `relationshipType`; directional where applicable
  - Automatic layout (Dagre or force-directed; no drag-to-reposition in v1)
  - Pan and zoom
- Click a character node → navigate to that character's document
- Click a relationship edge → open that relationship's document
- Scope toggle control — "This Story" vs "Full Universe"
- Entry point from sidebar (Relationship Map item under each Story and Universe)
- Mobile fallback — simplified list view of characters and relationships instead of graph (per SPEC §17)

### Tests

**Unit**
- Graph builder — given CHARACTER and RELATIONSHIP documents, returns correct nodes array and edges array
- Edge direction — directional relationship types produce `markerEnd` on the correct end
- Missing character guard — RELATIONSHIP document whose `characterIds` reference a deleted character is omitted from edges without throwing

**Integration**
- `GET /api/documents?storyId=[id]&types=CHARACTER,RELATIONSHIP` — returns correct document set for graph construction

**E2E**
- Open Relationship Map for a Story with 3 characters and 2 relationships; verify 3 nodes and 2 edges render
- Click a character node; verify navigation to that character's document
- Toggle scope to "Full Universe"; verify Universe-level characters appear

---

## Phase 18: Brainstorm — Logline Generation ☐

**Goal:** Writers can generate batches of story loglines from a free-text seed and mode selection.

### Deliverables

- `/brainstorm` — logline generation page (per SPEC §12)
  - Mode toggle: Original | Fanfiction
  - Optional source title input (Fanfiction only)
  - Optional free-text seed input
  - "Generate" button → batch of 5 logline cards via `/api/brainstorm`
  - Each card: logline text, "Save to Library" button, "Discard" button
  - Per-card regenerate and full-batch regenerate
- `POST /api/brainstorm` — OpenRouter call returning 5 loglines as structured JSON
- Sidebar link to Brainstorm in a bottom navigation section

### Tests

**Unit**
- `POST /api/brainstorm` response parser — given model output, extracts exactly 5 loglines; handles fewer gracefully

**Integration**
- `POST /api/brainstorm` with mock OpenRouter — returns 5 logline strings

**E2E**
- Generate loglines; verify 5 cards render; discard one; verify it disappears

---

## Phase 19: Saved Prompts & Convert to Story ☐

**Goal:** Loglines can be saved to a persistent library and converted into full story projects.

### Deliverables

- `/prompts` — Saved Prompts library (per SPEC §12)
  - List of all saved `SavedPrompt` rows
  - "+ Add Prompt" manual entry
  - Per-prompt: text, mode, source title, date, Edit (inline), Delete, "Convert to Story"
- "Convert to Story" modal
  - Name input, hierarchy placement (standalone or into existing Universe/Series)
  - On confirm: creates Story (and containers if needed); creates Plot document with logline as Premise content; marks `SavedPrompt.convertedToStoryId`; navigates to new Story workspace
- Sidebar link to Saved Prompts in the bottom navigation section

### Tests

**Unit**
- "Convert to Story" — creates correct hierarchy entries; `SavedPrompt.convertedToStoryId` set; Plot document `tiptapJson` contains logline as Premise section

**Integration**
- `POST /api/prompts` — creates `SavedPrompt` row
- `POST /api/prompts/[id]/convert` — creates Story (+ optional containers) and Plot document; updates `SavedPrompt`

**E2E**
- Generate loglines; save one; navigate to `/prompts`; verify it appears
- "Convert to Story" for a saved prompt; verify new Story in sidebar with Plot document containing the logline

---

## Phase 20: Fanfic Mode — Core ☐

**Goal:** Projects can be created in Fanfic mode with canon text ingested and tagged.

### Deliverables

- FANFIC mode project creation — `mode: 'FANFIC'` and `sourceTitle` field on Universe/Series/Story
- First-run Canon Context Ingestion modal (per SPEC §9)
  - Shown after creating a new Fanfic Universe
  - Paste field for raw source text (wiki pages, bios, etc.)
  - "Skip" option
  - On submit: `POST /api/ai/ingest-canon` → AI organizes text into CHARACTER and WORLDBUILDING draft documents → returned as standard diff cards for accept/reject
  - Accepted content creates Universe-level documents tagged `isCanon: true`
- "Import Canon Text" action in Universe settings — same paste interface, available at any time
- `isCanon: true` visual treatment in sidebar ("**[C]**" badge) and document header

### Tests

**Integration**
- `POST /api/ai/ingest-canon` with mock OpenRouter — returns diff proposals for CHARACTER and WORLDBUILDING documents
- `PATCH /api/documents/[id]` setting `meta.isCanon = true` — document appears in subsequent canon context assemblies

**E2E**
- Create a Fanfic Universe; paste canon text in first-run modal; accept proposed character document; verify `[C]` badge in sidebar

---

## Phase 21: Fanfic Mode — AI Integration & AU Variants ☐

**Goal:** The AI labels canon references inline and writers can create and distinguish AU variants.

### Deliverables

- Fanfic Character creation variant — optional paste field for source material; AI pre-populates document via standard diff flow if text is provided
- AI [Canon] / [AU] inline badges in chat responses (per SPEC §9)
  - AI system prompt includes all Universe-level `isCanon: true` documents (via Tier 2 summaries)
  - AI labels references as **[Canon]** when citing those documents
- Worldbuilding AU variant — duplicate a canon entry; set `isCanon: false`; sidebar distinguishes canon vs AU entries

### Tests

**Unit**
- Canon context assembly — only `isCanon: true` Universe-level documents are included in the fanfic system prompt; `isCanon: false` documents are excluded from the canon block
- `[Canon]` badge parser — identifies and renders `[Canon]` markers from AI response text

**E2E**
- Open chat on a Story document; verify AI response labels a canon character reference as **[Canon]**
- Duplicate a canon Worldbuilding entry; set to AU; verify distinct sidebar display

---

## Phase 22: Content Rating & Explicit Unlock ☐

**Goal:** Project ratings are reflected in AI calibration and explicit content requires a one-time age gate.

### Deliverables

- Content rating UI fully wired
  - Rating selector (G / T / M / E) on project create and project settings
  - AI system prompt includes rating and calibration instructions
- Explicit content unlock (per SPEC §15)
  - First attempt to set any project to `E` rating: modal requiring 18+ confirmation; sets `User.explicitEnabled = true`
  - Subsequent `E` ratings: single toggle; no repeated gate
  - Per-project: `E` rating can be downgraded at any time

### Tests

**Unit**
- Rating calibration — system prompt for `G` project contains content restriction language; `E` + `explicitEnabled` project omits it
- Age gate logic — `explicitEnabled: false` + rating `E` → gate shown; `explicitEnabled: true` → no gate

**Integration**
- `PATCH /api/account/explicit-enable` — sets `User.explicitEnabled = true`; idempotent on subsequent calls
- Rating downgrade from `E` to `M` — no gate shown; `User.explicitEnabled` unchanged

**E2E**
- Set project to `E` rating for the first time; verify age-gate modal appears; confirm; verify rating saved
- Set a second project to `E`; verify no gate appears

---

## Phase 23: Contradiction Checker ☐

**Goal:** Writers can run an on-demand AI contradiction check across their Story documents with token transparency.

### Deliverables

- "Check for Contradictions" button in document toolbar and project `...` menu
- Token estimate shown before every request (always shown per `CONTRADICTION_WARN_THRESHOLD_TOKENS = 0`)
- On confirm: `POST /api/ai/contradiction-check` assembles Story documents (full for short, `contentSummary` for long) and sends to AI
- Results rendered in a modal: list of flagged issues, each expandable with documents involved and suggested resolutions
- No automatic changes — writer resolves manually or via follow-up chat
- Configuration constant `CONTRADICTION_WARN_THRESHOLD_TOKENS` in `src/config/ai.ts`

### Tests

**Unit**
- Contradiction token estimator — given a set of documents, returns a non-zero integer estimate

**Integration**
- `POST /api/ai/contradiction-check` with mock OpenRouter — returns structured list of issues

**E2E**
- Trigger Contradiction Checker; verify token estimate modal; confirm; verify results modal with at least one issue
