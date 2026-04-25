# Writing Buddy — Complete Technical Specification

**Version:** 1.0  
**Date:** 2026-04-24  
**Status:** Final Draft

---

## Table of Contents

1. [Overview](#1-overview)
2. [Project Goals & Constraints](#2-project-goals--constraints)
3. [Tech Stack](#3-tech-stack)
4. [Architecture Overview](#4-architecture-overview)
5. [Authentication & Accounts](#5-authentication--accounts)
6. [Data Model](#6-data-model)
7. [Project Hierarchy & Navigation](#7-project-hierarchy--navigation)
8. [Document System](#8-document-system)
9. [AI System](#9-ai-system)
10. [Core Planning Modules](#10-core-planning-modules)
11. [Relationship Map](#11-relationship-map)
12. [Brainstorming Mode](#12-brainstorming-mode)
13. [Version History](#13-version-history)
14. [Export & Story Bible](#14-export--story-bible)
15. [Content Ratings](#15-content-ratings)
16. [UI/UX Design System](#16-uiux-design-system)
17. [Responsive Design](#17-responsive-design)
18. [Out of Scope (v1)](#18-out-of-scope-v1)
19. [Future Considerations](#19-future-considerations)
20. [Configuration Constants](#20-configuration-constants)

---

## 1. Overview

**Writing Buddy** is a cloud-based, AI-powered creative planning application for fiction writers. It provides a split-view workspace pairing a living rich-text document editor with a persistent AI chat assistant, allowing writers to iteratively develop characters, relationships, worldbuilding, plot, and scenes across a hierarchical project library — all accessible from any modern browser.

The app targets both original fiction and fanfiction writers, with mode-specific AI behaviors for each. It is a portfolio/learning project built to demonstrate full-stack engineering capability.

---

## 2. Project Goals & Constraints

### Goals

- Provide a single organized home for all fiction planning.
- Enable iterative, AI-assisted development where each conversation refines a living document.
- Support both original fiction and fanfiction with canon-aware AI behaviors.
- Organize projects in a flexible hierarchy with shared world elements.
- Maintain full version history so no prior thinking is ever permanently lost.
- Run in any modern web browser with cloud storage accessible from any device.

### Constraints

- **Single user only** — no multi-user collaboration or real-time co-editing in v1.
- **Cloud-only** — no offline/local mode.
- **Portfolio project** — architectural correctness and code quality matter; production scale does not.
- **User-supplied API key** — the app does not run its own AI inference; users provide their own OpenRouter key.
- **Desktop-first** — mobile layout is provided and usable but not a primary optimization target.

---

## 3. Tech Stack

| Layer              | Technology                                                       |
| ------------------ | ---------------------------------------------------------------- |
| Framework          | Next.js 14+ (App Router) + TypeScript                            |
| Database           | PostgreSQL via Prisma ORM (hosted on Neon or Supabase)           |
| Auth               | Auth.js (NextAuth.js v5) with Prisma adapter                     |
| Auth Providers     | Email/Password (credentials) + Google OAuth                      |
| Rich Text Editor   | TipTap (ProseMirror-based)                                       |
| Relationship Graph | React Flow                                                       |
| AI Integration     | OpenRouter API (user-supplied key), via OpenAI-compatible SDK (OpenRouter exposes an OpenAI-compatible endpoint; the Anthropic SDK is **not** used) |
| Styling            | Tailwind CSS                                                                                                                                        |
| PDF Export         | `@react-pdf/renderer` (server-side; runs in API routes on Vercel)                                                                                   |
| Markdown Export    | `prosemirror-markdown` (serializes TipTap/ProseMirror JSON to Markdown for export and AI context)                                                   |
| State Management   | React Context + SWR or TanStack Query for server state                                                                                              |
| Deployment         | Vercel                                                           |

---

## 4. Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                        Next.js App                           │
│                                                              │
│  ┌─────────────────────┐   ┌──────────────────────────────┐  │
│  │   App Router Pages  │   │         API Routes           │  │
│  │  /dashboard         │   │  /api/auth/[...nextauth]     │  │
│  │  /project/[id]      │   │  /api/documents/[id]         │  │
│  │  /document/[id]     │   │  /api/ai/chat                │  │
│  │  /brainstorm        │   │  /api/ai/diff                │  │
│  │  /prompts           │   │  /api/ai/search (fanfic)     │  │
│  └─────────────────────┘   │  /api/export                 │  │
│                             │  /api/brainstorm             │  │
│                             └──────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                   Prisma ORM                         │   │
│  └──────────────────────────┬───────────────────────────┘   │
└─────────────────────────────┼────────────────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │    PostgreSQL      │
                    │  (Neon/Supabase)   │
                    └───────────────────┘

External services:
  - OpenRouter API (user key, AI inference)
  - Google OAuth (social login)
  - Web search tool (fanfic canon research)
```

All AI calls are made server-side via API routes. The user's OpenRouter API key is stored encrypted in the database and never sent to the client. AI responses stream back to the client via Server-Sent Events (SSE).

---

## 5. Authentication & Accounts

### Providers

- **Email/Password** — credentials provider via Auth.js. Passwords hashed with bcrypt.
- **Google OAuth** — social login via Auth.js Google provider.

### Account Behavior

- A single account owns all projects. No sharing or collaboration in v1.
- On first login (or before any AI feature is used), a settings panel prompts the user to enter their OpenRouter API key.
- The API key is stored encrypted server-side (AES-256-GCM) and associated with the user's account. It is never exposed to the client. The encryption key is read from the `OPENROUTER_ENCRYPTION_KEY` environment variable at runtime; it must be set in the Vercel project environment and must never be committed to the repository.
- Account deletion offers a full data export in all supported formats before removal. Deleting a user cascades to all owned data (see §6 Deletion Behavior).

### First-Run UX

- Users who have not yet entered an API key can freely explore the app: create projects, write documents, browse the UI.
- Any AI feature triggered without a key shows a non-blocking nudge: _"AI features require an OpenRouter API key — add one in Settings."_
- No AI calls are blocked globally; they are gated individually at the point of invocation.

---

## 6. Data Model

### Core Entities

```prisma
model User {
  id              String    @id @default(cuid())
  email           String    @unique
  name            String?
  passwordHash    String?
  openRouterKey   String?   // encrypted
  explicitEnabled Boolean   @default(false)
  createdAt       DateTime  @default(now())

  universes       Universe[]
  series          Series[]
  stories         Story[]
  savedPrompts    SavedPrompt[]
  accounts        Account[]
  sessions        Session[]
}

model Universe {
  id          String    @id @default(cuid())
  userId      String
  name        String
  mode        Mode      // ORIGINAL | FANFIC
  sourceTitle String?   // fanfic only
  rating      Rating
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  series      Series[]
  stories     Story[]   // standalone stories (no series)
  documents   Document[]
  savedPrompts SavedPrompt[]
}

model Series {
  id          String    @id @default(cuid())
  userId      String
  universeId  String?   // optional — a series may exist without a parent universe
  name        String
  mode        Mode
  sourceTitle String?   // fanfic only
  rating      Rating
  createdAt   DateTime  @default(now())

  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  universe    Universe? @relation(fields: [universeId], references: [id], onDelete: SetNull)
  stories     Story[]
  documents   Document[]
}

model Story {
  id          String    @id @default(cuid())
  userId      String
  universeId  String?   // optional — a story in a series with no universe has no universeId
  seriesId    String?
  name        String
  mode        Mode
  sourceTitle String?   // fanfic only
  rating      Rating
  createdAt   DateTime  @default(now())

  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  universe    Universe? @relation(fields: [universeId], references: [id], onDelete: SetNull)
  series      Series?   @relation(fields: [seriesId], references: [id], onDelete: SetNull)
  documents   Document[]
  savedPrompts SavedPrompt[]
}

model Document {
  id                        String        @id @default(cuid())
  type                      DocumentType  // CHARACTER | RELATIONSHIP | WORLDBUILDING | PLOT | SCENE | OTHER
  name                      String
  tiptapJson                Json          // TipTap document JSON (source of truth)
  chatSummary               String?       // rolling summary of chat history for AI context (Tier 2)
  contentSummary            String?       // AI-generated summary of document content for Tier 2 context in other documents' AI calls
  contentSummaryGeneratedAt DateTime?     // compared against updatedAt to detect staleness; regenerate if older
  parentDocumentId          String?       // optional link to a Universe-level parent document (used for per-story character specialization)
  order                     Float?        // display order within its section (used for Scene drag-and-drop; Float allows gap-free insertion)
  universeId                String?
  seriesId                  String?
  storyId                   String?
  meta                      Json?         // type-specific metadata; see §6 Meta JSON Schemas
  createdAt                 DateTime      @default(now())
  updatedAt                 DateTime      @updatedAt

  universe        Universe?      @relation(fields: [universeId], references: [id], onDelete: Cascade)
  series          Series?        @relation(fields: [seriesId], references: [id], onDelete: Cascade)
  story           Story?         @relation(fields: [storyId], references: [id], onDelete: Cascade)
  parent          Document?      @relation("DocumentSpecialization", fields: [parentDocumentId], references: [id], onDelete: SetNull)
  specializations Document[]     @relation("DocumentSpecialization")
  versions        DocumentVersion[]
  chatMessages    ChatMessage[]
}

model DocumentVersion {
  id          String   @id @default(cuid())
  documentId  String
  tiptapJson  Json
  label       String?  // optional user-provided label
  createdAt   DateTime @default(now())

  document    Document @relation(fields: [documentId], references: [id], onDelete: Cascade)
}

// Version cap: at most DOCUMENT_VERSION_CAP versions are retained per document.
// When the cap is reached, the oldest version is deleted before a new one is inserted.
// See §20 Configuration Constants.

model ChatMessage {
  id          String   @id @default(cuid())
  documentId  String
  role        String   // "user" | "assistant"
  content     String
  createdAt   DateTime @default(now())

  document    Document @relation(fields: [documentId], references: [id], onDelete: Cascade)
}

// Retention policy: messages older than the rolling summary cutoff are deleted after summarization.
// Total messages retained per document is bounded by CHAT_RETENTION_LIMIT.
// See §9 Chat History & Pruning and §20 Configuration Constants.

model SavedPrompt {
  id                 String   @id @default(cuid())
  userId             String
  content            String   // the logline text
  mode               Mode
  sourceTitle        String?  // fanfic only
  convertedToStoryId String?
  createdAt          DateTime @default(now())

  user               User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  convertedToStory   Story?   @relation(fields: [convertedToStoryId], references: [id], onDelete: SetNull)
}

// ---------------------------------------------------------------------------
// Auth.js (NextAuth v5) required models — needed by the Prisma adapter.
// These are boilerplate; do not modify field names.
// ---------------------------------------------------------------------------

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?

  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime

  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}

enum Mode {
  ORIGINAL
  FANFIC
}

enum DocumentType {
  CHARACTER
  RELATIONSHIP
  WORLDBUILDING
  PLOT
  SCENE
  OTHER
}

enum Rating {
  G
  T
  M
  E
}
```

### Scope Rules

Documents belong to exactly one level of the hierarchy: Universe, Series, or Story. A document's `universeId`, `seriesId`, and `storyId` fields determine its scope:

| Scope | `universeId` | `seriesId` | `storyId` |
| ------------ | ------------ | ---------- | --------- |
| Universe-level | set | null | null |
| Series-level (in a Universe) | set | set | null |
| Series-level (standalone Series) | null | set | null |
| Story-level | set or null | set or null | set |

A Story's `universeId` is null when it belongs to a standalone Series (one with no Universe parent).

### Deletion Behavior

All deletes cascade downward through the hierarchy. The following rules apply:

| Deleted entity | Cascade effect |
| -------------- | -------------- |
| `User` | Cascades to all owned `Universe`, `Series`, `Story`, `Document`, `SavedPrompt`, `Account`, `Session` rows (via the `userId` FK on each model) |
| `Universe` | Cascades to owned `Document` rows; sets `Series.universeId` and `Story.universeId` to null (orphan, not delete) |
| `Series` | Sets `Story.seriesId` to null; cascades to Series-scoped `Document` rows |
| `Story` | Cascades to Story-scoped `Document` rows |
| `Document` | Cascades to `DocumentVersion` and `ChatMessage` rows; sets `Document.parentDocumentId` to null on any specialization documents |
| `Character` document | Before deletion, the server checks for `RELATIONSHIP` documents referencing this character in `meta.characterIds`. The user is warned and must confirm; on confirmation, those relationship documents are also deleted. |

Deleting a container (Universe, Series, Story) never silently deletes documents that belong to a higher scope — only documents scoped directly to the deleted entity are removed.

### Meta JSON Schemas

The `Document.meta` field stores type-specific structured data. Expected shapes by `DocumentType`:

| `DocumentType` | Field | Type | Description |
| -------------- | ----- | ---- | ----------- |
| `CHARACTER` | `isCanon` | `boolean` | Fanfic only; true if this is a canon character from the source material |
| `CHARACTER` | `role` | `string` | Quick-access role tag: `"Protagonist"` \| `"Antagonist"` \| `"Supporting"` \| `"Other"` |
| `RELATIONSHIP` | `characterIds` | `string[]` | IDs of the two characters in this relationship (used by the Relationship Map) |
| `RELATIONSHIP` | `relationshipType` | `string` | Edge label: `"Family"` \| `"Romantic"` \| `"Rival"` \| `"Mentor"` \| `"Ally"` \| `"Other"` |
| `WORLDBUILDING` | `category` | `string` | Sidebar grouping: `"Location"` \| `"Faction"` \| `"History"` \| `"Magic/Technology"` \| `"Culture"` \| `"Economy"` \| `"Religion"` \| `"Language"` \| `"Other"` |
| `WORLDBUILDING` | `isCanon` | `boolean` | Fanfic only; true if this entry was ingested from canon source material |

All `meta` values are application-defined; no additional fields are stored or read by the backend unless listed above.

---

## 7. Project Hierarchy & Navigation

### Hierarchy

```
Universe (optional)
└── Series (optional)
    └── Story
        ├── Characters
        ├── Relationships
        ├── Worldbuilding
        ├── Plot
        └── Scenes
```

All levels are optional. A writer can create:

- A standalone Story (no Universe or Series wrapper)
- A Story inside a Series (no Universe)
- A standalone Series (no Universe — `Series.universeId` is null)
- A Story inside a Universe (no Series)
- A full Universe → Series → Story chain

Documents can be defined at any level. Universe-level documents (characters, worldbuilding entries) are accessible as context to all child stories. Story-level documents override or specialize parent-level content for that story.

### Sidebar Navigation

The primary navigation is a **collapsible tree sidebar** on the left side of the screen.

**Structure:**

```
▼ 🌐 The Shattered Realms       [Universe]
  ▼ 📖 Echoes of Fire           [Series]
    ▼ 📝 The Ashen Crown        [Story]
      ▸ 👤 Characters
      ▸ 💞 Relationships
      ▸ 🌍 Worldbuilding
      ▸ 📊 Plot
      ▸ 🎬 Scenes
    ▸ 📝 The Iron Shore         [Story]
  ▸ 📖 Shards of Dawn          [Series]
▸ 🌐 Starfall                  [Universe]
[ + New Project ]
```

**Behaviors:**

- Clicking a section name (e.g. "Characters") expands a sub-list of individual documents in that category for that story.
- Clicking a document opens it in the main workspace.
- Right-clicking (or a `...` menu) on any node offers: rename, delete, move, export.
- The sidebar is collapsible to maximize editor space.
- Active document is highlighted in the sidebar.
- Special navigation items outside the hierarchy: **Brainstorm** and **Saved Prompts**, accessible from a section at the bottom of the sidebar or a top-level nav icon.

---

## 8. Document System

### Editor

Each document is a **TipTap rich-text editor**. Content is stored as TipTap JSON internally and serialized to Markdown for both AI context construction and file export. Serialization is handled by `prosemirror-markdown`, which understands the ProseMirror document model that TipTap is built on.

Supported formatting:

- Headings (H1–H3)
- Paragraph text
- Bold, italic, underline
- Bulleted and numbered lists
- Tables
- Horizontal rules

Documents have no enforced schema. Writers structure their documents freely using headings and prose. The AI understands document structure via headings and uses them as section boundaries for diffing.

### Autosave

Document content autosaves continuously as the writer types (debounced, 2-second delay). Autosave is silent — no version entry is created on autosave alone.

### Split-View Workspace

When a document is open, the main content area is a **persistent split-view**:

```
┌─────────────────────────┬────────────────────────────┐
│   DOCUMENT (TipTap)     │   AI CHAT                  │
│                         │                            │
│  # Aria                 │  You: Tell me more about   │
│                         │  her backstory.            │
│  ## Overview            │                            │
│  A reluctant hero...    │  AI: Based on what you've  │
│                         │  described, Aria might...  │
│  ## Backstory           │                            │
│  Orphaned at 12...      │  [✦ Proposed: ## Backstory]│
│                         │  [✓ Accept] [✗ Reject]     │
│                         │                            │
│                         │  [Type a message...]       │
└─────────────────────────┴────────────────────────────┘
```

Both panels are always visible simultaneously on desktop. The divider between them is draggable to resize.

---

## 9. AI System

### Provider

AI inference runs through **OpenRouter** using the user's own API key. The initial model is **Claude Sonnet** (latest available via OpenRouter). A model selector is present in the Settings panel in v1 but contains only one option (Claude Sonnet); additional models can be added in future versions without structural changes.

### API Key Storage

The user's OpenRouter API key is:

- Entered once in the Settings panel.
- Stored server-side, encrypted at rest (AES-256 or equivalent).
- Never sent to the client after initial submission.
- Used exclusively server-side in AI API routes.

### AI Context Construction

When the AI responds in the chat panel, the server constructs its context as follows:

**Tier 1 — Always included (full text):**

- The current document's full TipTap JSON, serialized to Markdown.
- The current document's most recent chat history (past 2 queries and responses).

**Tier 2 — Included as summaries (token-budgeted):**

- The current document's rolling chat summary (from `Document.chatSummary`).
- Other documents in the current Story and its parent Universe/Series, represented as AI-generated summaries (cached in `Document.contentSummary`; regenerated when `contentSummaryGeneratedAt` is older than `updatedAt`).

Tier 2 summaries are subject to a total token budget (`AI_TIER2_BUDGET_TOKENS`; see §20). When the combined summary length would exceed the budget, documents are included in the following priority order and truncated at the limit:

1. Same document type as the current document (e.g., CHARACTER summaries when editing a character doc)
2. Relationship documents referencing the current document's characters
3. Plot documents at the same Story level
4. Worldbuilding documents at the same Story level
5. Universe- and Series-level shared documents
6. All remaining documents

**System prompt includes:**

- The project's mode (ORIGINAL or FANFIC) and, if fanfic, the source title.
- The project's content rating and whether explicit content is enabled.
- Instructions for the AI's behavior (see fanfic and explicit sections below).

### Chat History & Pruning

Chat messages are stored in the `ChatMessage` table. All thresholds below are defined as constants in the AI config (see §20).

**Retention policy:**

- Up to `CHAT_RETENTION_LIMIT` messages per document are kept in the database. When that limit is reached, summarization is triggered.
- Summarization takes the oldest `CHAT_SUMMARIZE_BATCH` messages, sends them to the AI to produce or update the rolling summary, stores the result in `Document.chatSummary`, then **deletes** those messages from the database.
- After deletion, the document's chat thread contains at most `CHAT_RETENTION_LIMIT − CHAT_SUMMARIZE_BATCH` messages plus the rolling summary — well within a comfortable reading length.

**AI context:**

- The AI always receives the most recent `CHAT_FULL_WINDOW` messages in full (Tier 1).
- All earlier history is represented by the rolling summary in `Document.chatSummary` (Tier 2).

The user sees all messages currently in the database. When a rolling summary exists, a non-interactive placeholder — _"Earlier conversation has been summarized"_ — appears above the oldest visible message.

### Section-Level AI Diffs

When the AI proposes changes to the document, it does so via **section-level diffs** — one proposed change per document section (identified by heading).

**Flow:**

1. AI response in chat includes zero or more proposed section edits.
2. Each proposed edit is rendered in the chat panel as a diff card:

```
┌─ Proposed change: ## Backstory ────────────────────┐
│                                                    │
│  Before:                                          │
│    Orphaned at 12, raised by monks.               │
│                                                   │
│  After:                                           │
│    Orphaned at 12, raised by monks in the         │
│    mountain temple of Vel'Shara, where she        │
│    learned the forbidden art of shadow weaving    │
│    before fleeing after the massacre.             │
│                                                   │
│            [✓ Accept]    [✗ Reject]               │
└────────────────────────────────────────────────────┘
```

3. **Accept:** The matching section in the TipTap editor is replaced with the proposed content. A version snapshot is created (see §13).
4. **Reject:** The proposal is dismissed. The document is unchanged. No version entry is created.
5. Diff cards remain in the chat until dismissed (accepted or rejected), even if the user scrolls or types more messages.
6. If the AI proposes adding a new section that doesn't exist, the diff card shows "New section" and acceptance appends it to the document.
7. The AI never directly mutates the document — all changes require explicit user acceptance.

### AI Behaviors by Mode

**Original mode:**

- AI operates without canon constraints.
- Suggests freely from the writer's established world details.

**Fanfiction mode:**
When `mode === 'FANFIC'`, the AI additionally:

- Uses the writer's own Universe-level canon documents as its source of truth for canon facts (see §9 Canon Context Ingestion).
- Surfaces relevant canon facts in its responses, labeled as **[Canon]**, when referencing content from those documents.
- Distinguishes between canon characters and original characters (OCs) introduced by the writer, based on the `isCanon` flag in each character's `meta` field.

**Explicit content:**

- If a project's rating is `E` and explicit content is unlocked (see §15), the AI's suggestions are uncalibrated for content level.
- Otherwise, AI suggestions are calibrated to the project's rating (G/T/M/E-locked).

### Canon Context Ingestion

Live web search is out of scope for v1. Instead, canon context is user-supplied: the writer pastes raw text (wiki pages, episode summaries, character descriptions, etc.) and the AI organizes it into structured Universe-level documents.

**First-run flow (new Fanfic Universe):**

After naming the project and entering the source title, a modal prompts:

> _"To give the AI context about your fandom, paste any source material below — wiki pages, character bios, episode summaries, etc. The AI will organize this into your Universe's canon documents. You can skip this step and add material later."_

The user pastes text and submits. The AI processes it and generates draft Universe-level documents (CHARACTER and WORLDBUILDING entries). Each draft is presented as a standard AI diff — the user accepts or rejects sections as usual. Accepted content becomes normal editable documents.

**Ongoing ingestion:**

An **"Import Canon Text"** action is available from the Universe settings panel at any time. It opens the same paste interface and appends to or updates existing Universe-level documents via the standard diff flow.

**AI context in fanfic mode:**

On each AI call, the system prompt includes the content of all Universe-level documents marked `isCanon: true` (in `meta`), in summary form per the Tier 2 token budget. The AI treats these as canon facts and labels references to them as **[Canon]** in its responses.

---

### Contradiction Checker

Available as an **on-demand feature** — triggered via a "Check for Contradictions" button in the document toolbar or project menu.

**Scope and token estimate:**

- The default scope is the **current Story** only.
- Before sending the request, the server estimates the total token count of the assembled documents and displays a confirmation prompt:

  > _"Checking this story will use approximately 4,200 tokens from your OpenRouter quota. Continue?"_

- The user must confirm before the request is sent. The estimate is shown whenever the projected count exceeds `CONTRADICTION_WARN_THRESHOLD_TOKENS` (see §20), which in practice means it is shown on every check given the nature of the operation.

**On confirmation:**

1. The server assembles all documents in the current Story (full text for short documents, `contentSummary` for longer ones, per the Tier 2 budget rules).
2. Sends to the AI with a system prompt asking it to identify internal inconsistencies: conflicting character details, timeline impossibilities, contradicted world rules, etc.
3. Returns a list of flagged issues rendered in a modal or slide-over panel.
4. Each flag includes: the specific inconsistency, the documents involved, and suggested resolutions.
5. No automatic changes are made — the writer resolves contradictions manually or through a follow-up AI chat session.

**v2+ expansion options (out of scope for v1):**

- **Character consistency across stories:** Check a single character's traits, voice, and behavior across multiple stories within a Universe — useful for long-running series.
- **Worldbuilding vs. Plot cross-check:** Compare Worldbuilding documents against Plot documents to catch rule violations or setting inconsistencies introduced by plot decisions.
- **Full Universe scope:** Assemble all documents across all Stories in a Universe for a comprehensive sweep, with a corresponding larger token estimate and confirmation step.

---

## 10. Core Planning Modules

All modules are instances of the `Document` entity with a `type` field. Each module type has:

- A **document panel** (TipTap editor, left side of split view)
- A **chat panel** (AI assistant, right side of split view)
- An entry in the sidebar under its parent Story/Series/Universe

### 10.1 Character Profiles

`DocumentType: CHARACTER`

**Suggested initial headings** (inserted when a new character document is created via a starter template; writer can restructure freely):

- Name / Aliases
- Role (Protagonist / Antagonist / Supporting / Other)
- Physical Description
- Personality
- Backstory
- Motivations
- Fears
- Secrets
- Voice & Manner of Speaking
- Character Arc (Starting State → Turning Points → End State)
- Thematic Function

**Metadata (stored in `meta` JSON field):**

- `isCanon: boolean` — fanfic only; true if this is a canon character from the source material
- `role: string` — quick-access role tag

**Fanfic behavior:**

- When a new CHARACTER document is created in a fanfic project, the user is shown an optional paste field: _"Paste any source material about this character (wiki bio, scene descriptions, etc.) to pre-populate the document."_ The AI drafts the document from the pasted text and presents it as a standard diff for the user to accept or reject.
- If no text is pasted, the character document starts from the standard blank template.
- Setting `meta.isCanon = true` tags the character as **[Canon]** in the sidebar and document header, and includes the document in the canon context injected into the system prompt for other AI calls in the same Universe.

**Per-story specialization:**

- A character defined at the Universe level can have a per-Story companion document linked to it, containing story-specific arc details, without duplicating or altering the base profile.

### 10.2 Character Relationships

`DocumentType: RELATIONSHIP`

**Suggested initial headings:**

- Characters Involved
- Relationship Type (Family / Romantic / Rival / Mentor / Ally / Other)
- History
- Current Dynamic
- Trajectory / How It Evolves

**Metadata:**

- `characterIds: string[]` — IDs of the two characters in this relationship (used to render relationship edges on the map)
- `relationshipType: string` — displayed on the edge in the relationship map

Relationships are defined at the Universe or Story level. A relationship at the Universe level represents the baseline dynamic; a Story-level relationship document overrides or extends it for that story.

### 10.3 Worldbuilding

`DocumentType: WORLDBUILDING`

**Sub-categories** (stored in `meta.category`; used for sidebar grouping):

- Location
- Faction / Organization
- History / Timeline Entry
- Magic / Technology System
- Culture
- Economy
- Religion
- Language
- Other

**Fanfic behavior:**

- Worldbuilding entries generated from ingested canon text (see §9 Canon Context Ingestion) are automatically tagged `isCanon: true` in their `meta` field and labeled **[Canon]** in the sidebar.
- The writer can duplicate any canon entry and set `isCanon: false` on the copy to create an AU (Alternate Universe) variant, allowing divergence without losing the original canon reference.

### 10.4 Plot

`DocumentType: PLOT`

**Suggested initial headings:**

- Premise
- Inciting Incident
- Act Structure (customizable — Acts, Parts, Chapters, or custom groupings)
- Midpoint
- Climax
- Resolution
- Key Themes

Per-chapter or per-unit summaries, goals, and notes can be added as sub-sections within the same document or as separate Plot documents at a finer granularity.

### 10.5 Scenes

`DocumentType: SCENE`

**Suggested initial headings:**

- POV Character
- Location
- Characters Present
- Scene Goal
- Conflict
- Outcome
- Tone / Mood
- Notes / Brainstorm

Scene documents are attached to a Story. They can be ordered via a drag-and-drop list within the Scenes section.

---

## 11. Relationship Map

Accessible via the "Relationship Map" view, available at the Story or Universe level.

### Technology: React Flow

Nodes represent characters. Edges represent relationships. The graph is built from all CHARACTER and RELATIONSHIP documents within the selected scope.

### Interactivity

- **Pan and zoom** — standard React Flow navigation.
- **Click a character node** — navigates to that character's document (opens in the main workspace).
- **Click a relationship edge** — opens the relationship document between those two characters.
- **No drag-to-reposition** in v1 — layout is computed automatically (use React Flow's Dagre or force-directed layout).

### Visual Design

- Character nodes display the character's name and role tag.
- Canon characters (fanfic mode) have a distinct visual treatment (e.g., a [C] badge or border style).
- Edge labels show the relationship type (e.g., "Rivals", "Mentor", "Romantic").
- Edge direction is shown for directional relationships.

### Scope Toggle

- A control allows the user to switch between "This Story only" and "Full Universe" scope.

---

## 12. Brainstorming Mode

A **top-level page** in the app, accessible from the main navigation (not within any specific project). URL: `/brainstorm`.

### Generate Prompts

**Input form:**

- Mode toggle: Original | Fanfiction
- If Fanfiction: source title input (e.g., "Supernatural", "The Witcher")
- Optional free-text seed: describe a concept, pairing, or theme to guide generation (e.g., "two estranged siblings uncovering a family secret")
- "Generate" button

**Output:**

- 5 short loglines (1–2 sentences each), generated in a batch.
- Each logline is displayed as a card.
- Each card has:
  - The logline text
  - "Save to Library" button
  - "Discard" button
- The user can regenerate the full batch or individually regenerate a single card.

### Saved Prompts Library

URL: `/prompts`

A list of all saved loglines, plus any prompts the user manually adds.

**Manual entry:** A "+ Add Prompt" button opens a simple text input to save a freeform idea that the user isn't ready to develop yet.

**Each saved prompt shows:**

- The logline text
- Mode (Original / Fanfiction) and source title if applicable
- Date saved
- "Convert to Story" button
- "Edit" button (inline text edit)
- "Delete" button

**"Convert to Story":**

- Opens a modal asking the user to:
  - Name the new Story/Universe
  - Choose whether to create a standalone Story or place it in an existing Universe/Series
  - Confirm
- Creates the Story (and Universe/Series wrapper if needed) in the project hierarchy, pre-populating a Plot document with the logline as the premise.
- Navigates to the new Story's workspace.
- Marks the prompt as converted (displays the linked story name instead of the "Convert" button).

---

## 13. Version History

### When Versions Are Created

A `DocumentVersion` snapshot is created **only when the user accepts an AI-proposed section diff**. Manual edits autosave continuously but do not create version entries.

This keeps the version history meaningful — every entry reflects a deliberate, AI-assisted revision decision.

### Version History UI

Accessible via a "History" icon in the document toolbar.

Opens a slide-over panel listing all versions for the current document:

- Timestamp
- User-provided label (optional; can be added inline)
- "Preview" button — shows the full document as it existed at that version
- "Restore" button — creates a new version entry with the restored content and applies it to the document (non-destructive)

Nothing is permanently deleted. Restoring always creates a new version, preserving the current state before the restore.

---

## 14. Export & Story Bible

### Per-Document Export

Any document can be exported as:

- **Markdown** — raw `.md` file, serialized from TipTap JSON via `prosemirror-markdown`.
- **Copy to clipboard** — copies the Markdown representation directly to the clipboard (no file download). Available as a toolbar button and in the `...` menu.
- **PDF** — formatted, print-ready document rendered server-side via `@react-pdf/renderer`.

Accessible from a document's `...` menu or a toolbar export button.

### Project-Level Export

A full Story, Series, or Universe can be exported as a `.zip` containing:

- All documents as individual Markdown files, organized in folders mirroring the hierarchy.
- A `README.md` listing all included files.

### Story Bible

The Story Bible is an **on-demand compilation** of all documents belonging to a Story (and optionally its parent Universe/Series shared documents), assembled into a single exportable document.

**Trigger:** "Generate Story Bible" button on the Story's project page or via the `...` menu.

**Behavior:**

1. The server fetches all documents in scope (in a defined order: Characters → Relationships → Worldbuilding → Plot → Scenes → Other).
2. Concatenates them into a single structured document with section headers for each module type and document name.
3. Renders to PDF and triggers a browser download.
4. **Not persisted server-side** — it is generated fresh each time and downloaded immediately.
5. Also available as a Markdown download.

**v1 limitation:** The Story Bible is a straight compilation, not an AI-synthesized narrative. AI-collaborative Story Bible generation is deferred to a future version (see §19).

---

## 15. Content Ratings

Each project (at any hierarchy level) carries a rating tag:

| Rating | Label            | Description                                  |
| ------ | ---------------- | -------------------------------------------- |
| G      | General Audience | Suitable for all readers                     |
| T      | Teen             | Mild themes, some action or tension          |
| M      | Mature           | Adult themes, violence, non-explicit content |
| E      | Explicit         | Adult content; requires opt-in               |

The rating is **metadata only** — it does not restrict what the writer can write in their documents. It calibrates the AI's generative suggestions.

### Explicit Content Unlock

The `E` rating tier requires an explicit opt-in:

1. **First time** a user attempts to enable `E` rating on any project: a modal appears requiring the user to confirm they are 18+ and consent to explicit AI-generated content. This confirmation is stored on the user's account (`User.explicitEnabled = true`).
2. **Subsequent projects:** Setting a project to `E` rating is a single toggle — no repeated age gate.
3. Even with `User.explicitEnabled = true`, explicit content must be individually toggled per project. A project's `E` rating can be switched back to `M` or lower at any time.
4. If explicit content is not enabled for a project (rating < E, or rating = E but not yet unlocked for this project), the AI's suggestions are calibrated to the project's rating.

---

## 16. UI/UX Design System

### Design Direction

**Warm & editorial with a touch of soft & playful.**

The UI should feel like a beautiful, well-loved creative notebook — comfortable and inviting, not sterile. It is welcoming to creative exploration without feeling childish.

### Color Palette

- **Background:** Warm off-white (`#FAF7F2` or similar), not pure white.
- **Surface:** Slightly warmer white for cards and panels (`#FFF9F4`).
- **Primary accent:** A warm, muted tone — dusty rose, warm amber, or earthy terracotta. Used for active states, buttons, and highlights.
- **Secondary accent:** A soft sage green or muted periwinkle for AI-related elements (proposed diffs, AI badges).
- **Text:** Near-black with warm undertones (`#1C1A17`), not pure black.
- **Muted text:** Medium warm gray for labels, metadata, and placeholders.

### Typography

- **Headings:** A serif or humanist font (e.g., Lora, Playfair Display, or Fraunces) to evoke editorial warmth.
- **Body / UI text:** A clean, readable sans-serif (e.g., Inter or Figtree).
- The document editor uses the serif heading + sans body pairing to feel like a real document.

### Spatial Design

- Generous whitespace — the app should feel airy and uncluttered.
- Rounded corners (8–12px radius on cards, modals, inputs).
- Subtle drop shadows rather than heavy borders.
- Soft transitions and micro-animations (200–300ms ease-in-out) for panel state changes, diff card appearance, and sidebar expand/collapse.

### Component Conventions

- **Diff cards:** Displayed inline in the chat panel. Before section shown with a subtle strikethrough or muted style; after section shown clearly. Accept button in the primary accent color; reject button in muted gray.
- **AI badges:** `[Canon]`, `[Canon-Consistent]`, `[Canon-Adjacent]`, `[AU]` — displayed as small inline chips in the secondary accent color.
- **Version history panel:** Slide-over from the right. Dark scrim overlay on the document panel.
- **Contradiction checker results:** Modal with a list of flagged issues. Each issue is expandable.
- **Relationship map:** Full-page view with a floating control bar for scope toggle and zoom controls.

### Iconography

Use a consistent icon set (e.g., Lucide Icons or Heroicons). Document type icons used in the sidebar:

- 👤 / person icon: Characters
- 💞 / link icon: Relationships
- 🌍 / globe icon: Worldbuilding
- 📊 / chart icon: Plot
- 🎬 / film icon: Scenes

---

## 17. Responsive Design

**Primary target: Desktop (1280px+)**

The split-view workspace, collapsible sidebar, and relationship map are all designed for desktop first.

**Tablet (768px–1279px):**

- Sidebar collapses to icon-only mode by default; expandable via a toggle.
- Split-view panels stack vertically (document above, chat below), with a toggle to swap focus.
- Relationship map is functional with reduced node density.

**Mobile (<768px):**

- Sidebar is hidden behind a hamburger menu.
- Split-view shows one panel at a time; a toggle button switches between document and chat.
- Relationship map degrades gracefully — shows a simplified list view of characters and relationships instead of the graph.
- Full feature parity is not guaranteed on mobile; features requiring drag interactions or wide layouts may be limited.

---

## 18. Out of Scope (v1)

- Writing or drafting prose — Writing Buddy is a planning tool, not a manuscript editor.
- Real-time collaboration or multi-user accounts.
- Publishing or submission workflow tools.
- Mobile native app (iOS/Android).
- Offline/local mode.
- AI model selection beyond Claude Sonnet (model selector UI ships in v1 with one option; additional models deferred).
- AI-synthesized Story Bible (v1 Bible is a straight document compilation).
- Drag-to-reposition on the relationship map.
- Timeline visualization (defined in original requirements; deferred due to complexity).
- Inline always-on contradiction checking (on-demand only in v1).
- Live fanfic web search — v1 uses user-supplied copy-paste ingestion instead (see §9 Canon Context Ingestion).

---

## 19. Future Considerations

The following are out of scope for v1 but should be kept in mind architecturally so they can be added without structural rework:

| Feature                                | Notes                                                                                                                     |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| AI-synthesized Story Bible             | Architecture already stores all documents; adding an AI synthesis step is straightforward.                                |
| Additional AI models                   | The model selector UI already ships in v1 with one option. Add model options to the settings dropdown as needed.          |
| Timeline visualization                 | Would require a timeline-specific data structure. Consider adding a `timelinePosition` field to Scene and Plot documents. |
| Multi-user collaboration               | The single-user model is a deliberate v1 constraint; the data model doesn't preclude adding sharing later.                |
| Drag-to-reposition on relationship map | React Flow supports this; it was excluded for v1 layout simplicity.                                                       |
| Always-on contradiction checker        | Would require incremental document diffing and a background job architecture.                                             |
| Mobile app                             | Web-first; React Native or Capacitor could wrap the existing app.                                                         |
| Billing / usage metering               | If the app ever moves to a hosted-key model, usage tracking infrastructure will be needed.                                |
| Canvas / mood board                    | A free-form image and reference board per Story for visual inspiration.                                                   |
| Live fanfic web search                 | Replace the copy-paste ingestion flow with live web search tool use via OpenRouter, so the AI can look up canon facts at query time. Requires choosing and integrating a search API provider (Brave, Tavily, SerpAPI, etc.). |

---

## 20. Configuration Constants

Tunable limits are defined in `src/config/ai.ts` rather than scattered across the codebase. All values below are starting defaults; adjust based on observed token usage and UX feedback.

### Chat History

| Constant                  | Default | Description                                                                                      |
| ------------------------- | ------- | ------------------------------------------------------------------------------------------------ |
| `CHAT_FULL_WINDOW`        | `4`     | Number of most-recent messages sent to the AI in full (Tier 1). Represents 2 complete exchanges. |
| `CHAT_RETENTION_LIMIT`    | `80`    | Max messages retained in the database per document before summarization is triggered.            |
| `CHAT_SUMMARIZE_BATCH`    | `30`    | Number of oldest messages summarized and deleted per summarization pass.                         |

After one summarization pass, the document will have at most 50 messages in the database plus the rolling summary — comfortable to read and well within the context window.

### Document Versions

| Constant                  | Default | Description                                                                      |
| ------------------------- | ------- | -------------------------------------------------------------------------------- |
| `DOCUMENT_VERSION_CAP`    | `100`   | Max versions retained per document. Oldest is deleted when the cap is exceeded.  |

### AI Context

| Constant                        | Default | Description                                                                                              |
| ------------------------------- | ------- | -------------------------------------------------------------------------------------------------------- |
| `AI_TIER2_BUDGET_TOKENS`        | `6000`  | Token budget for all Tier 2 summaries combined in a single AI call.                                      |
| `CONTRADICTION_WARN_THRESHOLD_TOKENS` | `0` | Always show the token estimate before sending a contradiction check (effectively: warn on every check). |

### Fanfic Mode

No additional config constants are required for v1 fanfic mode. Canon context is supplied by the writer via the ingestion flow (§9 Canon Context Ingestion) and stored as normal Documents — no cache TTL or fetch logic needed.
