# Initial Project Requirements

I want to build an AI-powered tool that will help me develop stories, including characters, character relationships, setting, plot, and scenes, iterating on a plan document (or set of documents) which can eventually be either copied in Markdown format or exported as a PDF.

- Stories are separated into multiple documents, with more added as needed - they can be documents for a character, a relationship between two characters, the story's plot, details for scenes, or worldbuilding
- Each document can be copied to the clipboard as markdown.
- Each document can be exported as a PDF.
- Stories can be marked as either original or fanfic. If fanfic, the name of the source material and characters can be input, and the character profiles will auto-populate based on internet research.

## AI-Powered Novel & Fanfiction Planning Application

**Initial Requirements Document · v1.0 · Draft**

---

## 1. Executive Summary

Writing Buddy is a cloud-based AI-powered creative planning application designed for fiction writers working on original works and fanfiction. It provides a split-view workspace combining a structured living document editor with an AI chat assistant, enabling writers to iteratively develop characters, relationships, worldbuilding, plot, and scenes across a hierarchical project library — accessible from any browser on any device, with all data stored in the cloud and full version history maintained throughout.

---

## 2. Project Goals

- Provide a single, organized home for all fiction planning — eliminating scattered notes and copy-paste workflows.
- Support iterative AI-assisted development where each conversation refines and updates a living planning document.
- Handle both original fiction and fanfiction with mode-specific AI behaviors and canon awareness.
- Organize projects in a deep hierarchy (Universe → Series → Story → Chapters → Scenes) with shared world elements (also allowing for single-chapter short stories).
- Deliver full version history so no past thinking is ever permanently lost.
- Run in any modern web browser with cloud-based storage accessible from any device.

---

## 3. Scope & Modes

### 3.1 Original Mode

For standalone novels, short stories, novellas, and series of original fiction. The AI operates without canon constraints and focuses purely on developing the writer's invented world.

### 3.2 Fanfiction Mode

For works derived from existing source material (books, TV, film, games, etc.). The AI provides additional behaviors to support canon-aware development:

- Recognize and surface known canon facts about the source material when available.
- Distinguish clearly between canon characters and original characters (OCs) introduced by the writer.

---

## 4. Project Organization & Hierarchy

### 4.1 Top-Level Structure

Projects are organized in a nested hierarchy. Each level is optional — a writer can create a standalone Story without a Universe or Series wrapper.

| Level               | Description                                                                                                                                                                               |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Universe**        | The broadest container. A shared world, mythology, or IP that may span multiple series and standalone works. Holds shared characters, worldbuilding, and lore accessible to all children. |
| **Series**          | A named sequence of related stories within a Universe. Shares characters and world elements from its parent Universe by default.                                                          |
| **Story**           | A single novel, novella, or short story. Has its own plot structure, chapters, and may override inherited world/character details.                                                        |
| **Structural Unit** | The internal organization of a Story (e.g., Acts, Parts, Chapters, Scenes). The writer defines the structure per Story — no imposed hierarchy.                                            |

### 4.2 Shared vs. Per-Story Elements

Characters and worldbuilding elements defined at the Universe or Series level are shared across all child stories by default. Characters that appear across multiple works in a series (or multiple stories in the same Universe) can have story-specific sections (which may detail their arc for a given story) in addition to their global document.

For fanfiction, the character should have a base, Universe-level document, with a similar option to add per-story or per-series details (in the case of an AU, post-canon story, etc.)

---

## 5. Core Planning Modules

Each module below is a first-class entity within a Story (or shared at Universe/Series level). All modules support AI-assisted iterative development and full version history.

### 5.1 Character Profiles & Arcs

- Freeform profile fields: name, role, physical description, personality, backstory, voice, motivations, fears, secrets.
- Character arc tracking: starting state, turning points, end state, thematic function.
- Canon vs. OC tag (Fanfiction mode).
- Per-story arc specialization when a character appears across multiple stories.

### 5.2 Character Relationships

- Define directional or bidirectional relationships between any two characters.
- Relationship attributes: type (family, romantic, rival, mentor, etc.), history, current dynamic, trajectory.
- Relationship map view: interactive visual graph of all character connections (see Section 8).
- Relationships evolve per story — baseline defined at Universe level, specialized per Story.

### 5.3 Worldbuilding

- Structured entries for: locations, factions/organizations, history/timeline, magic/technology systems, culture, economy, religion, languages.
- Each entry supports freeform prose notes and AI-assisted expansion.
- In Fanfiction mode: canon world entries are pre-tagged and editable for AU divergence.

### 5.4 Plot Structure

- Flexible structure definition per Story (acts, parts, chapters, or custom groupings).
- High-level plot outline (premise, inciting incident, midpoint, climax, resolution).
- Per-chapter/unit summaries, goals, and notes.
- Timeline view: chronological event mapping across the story (see Section 8).

### 5.5 Scenes

- Scene cards attached to structural units (chapters, acts, etc.).
- Scene fields: POV character, location, characters present, goal, conflict, outcome, tone, notes.
- AI can help brainstorm scene content, identify missing beats, or suggest alternatives.

---

## 6. AI Assistant & Interaction Model

### 6.1 Workspace Layout

The primary workspace uses a persistent split-view layout:

- **Left panel:** Living Document — the structured, always-current planning document for the active module (character, plot, world entry, etc.).
- **Right panel:** AI Chat — conversational development assistant for the active document.
- Both panels are visible simultaneously and update in sync.

### 6.2 Interaction Flow

The AI-assisted development loop works as follows:

- Writer presents ideas, questions, or raw notes in the chat panel.
- AI responds with targeted questions, concrete suggestions, and alternatives to react to.
- Writer's reply — choosing suggestions, correcting details, answering questions — updates the living document.
- Each iteration refines the document without losing prior confirmed details.
- The writer can also directly edit the living document, which the AI treats as ground truth going forward.

### 6.3 Fanfiction Mode AI Behaviors

When a project is in Fanfiction mode, the AI additionally:

- Surfaces relevant canon facts during development (sourced from its training knowledge of the fandom).
- Labels generated suggestions as canon-consistent, canon-adjacent, or AU as appropriate.
- Helps the writer document their AU premise and intentional divergence points.

---

## 7. Version History

All planning modules maintain a full version history. Every saved state of a document is retained indefinitely.

- Writers can browse, preview, and restore any prior version of any document.
- Versions are timestamped and optionally annotated with a brief label (e.g., "before major revision", "original arc").
- Restoring a prior version creates a new version entry — nothing is permanently deleted.
- Version history is stored in the cloud and accessible from any device.

---

## 8. Views & Visualization Tools

| View                      | Description                                                                                                                                                       |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Relationship Map**      | Interactive node-graph visualization of all characters and their relationships within a Story or Universe. Nodes are clickable to navigate to character profiles. |
| **Timeline View**         | Chronological display of story events, scenes, and plot beats. Supports in-story time (narrative) and real-world calendar time where relevant.                    |
| **Story Bible**           | A compiled, read-friendly overview of everything in a project: characters, world, plot, and relationships in one scrollable or exportable document.               |
| **Contradiction Checker** | AI-powered scan of the full planning document to surface internal inconsistencies — e.g., conflicting character ages, timeline gaps, or contradicted world rules. |

---

## 9. Export Formats

Planning documents and Story Bibles can be exported in the following formats:

- **PDF** — formatted, print-ready planning document.
- **Plain text / Markdown** — lightweight, portable format for notes apps and version control.

Export is available at any level: individual module (e.g., a single character profile), full Story, or complete Universe/Series bundle.

---

## 10. Content Ratings & Audience Tags

Each project (at any hierarchy level) carries an audience rating tag to help the writer manage content expectations:

- **General Audience (G)** — suitable for all readers.
- **Teen (T)** — mild themes, some action or tension.
- **Mature (M)** — adult themes, violence, or non-explicit sexual content.
- **Explicit (E)** — adult content; requires opt-in toggle to unlock AI assistance for this content tier.

The rating is metadata only and does not restrict what the writer can write. However, the AI's generative suggestions will be calibrated to the selected rating unless the explicit toggle is activated.

---

## 11. Storage & Sync

### 11.1 Cloud-Primary Storage

All project data is stored in the cloud. An authenticated user account is required to use the app. Cloud storage is the source of truth — there is no local-only mode.

- All project data (documents, version history, settings) is accessible from any browser on any device.
- Changes are saved automatically and continuously as the writer works.
- The app requires an internet connection to function; offline use is not supported in v1.

### 11.2 Authentication & Accounts

Writers must create an account to use Writing Buddy. Account requirements:

- Email/password authentication at minimum; social login (e.g. Google) desirable.
- A single account owns all projects — no shared or multi-user projects in v1.
- Account deletion must trigger a full data export offer before removal.

### 11.3 Data Portability

Writers retain full ownership of their data. A complete project export in all supported formats (see Section 9) is available at any time, independent of account status.

---

## 12. Platform & Technical Constraints

- Runs in any modern web browser (Chrome, Firefox, Safari, Edge) on desktop, tablet, and mobile.
- No installation required — fully browser-based.
- Responsive layout: split-view adapts to narrower screens (stacks panels on mobile).
- An internet connection is required for all functionality (cloud storage + AI features).
- Single-user application — no multi-user collaboration or real-time co-editing in scope for v1.

---

## 13. Out of Scope (v1)

- Writing/drafting prose — Writing Buddy is a planning tool, not a manuscript editor.
- Real-time collaboration or multi-user accounts.
- Publishing or submission workflow tools.
- Mobile native app (iOS/Android) — web browser only in v1.

---

## 14. Other Details (Need Additional Definition)

- App should use OpenRouter and allow user to enter their own API key in the UI - initially only offer Claude Sonnet, but leave option open for other models in the future.
- AI changeds should behave like code edits in IDEs - can be kept or removed by user.
- There should be an additional "brainstorming" mode that can generate multiple story prompts, either for original works or fanfiction (ie: "I want to write a story about these two characters post-canon"). The short prompts generated can then be individually added to a user's "saved prompts" library, where they can eventually be converted into full stories if the user wishes. A user can also manually enter a "prompt" to their library if it is not yet ready to be turned into a full story (ie: "A story about two siblings trying to find the truth of their past").
- Consider what UI would be best - aim for something modern and comfortable that also feels welcoming and fun.
