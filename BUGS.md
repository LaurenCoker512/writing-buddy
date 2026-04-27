# Codebase Issues

Work through these one at a time. Check off each item when resolved.

---

## P1 — Critical

- [x] **#1 `findOwnedDocument` duplicated ~10×**
  The same "fetch doc, walk story/series/universe, check userId" logic is copy-pasted into every AI route and every document sub-route with subtle inconsistencies in return shapes (`{ document, owner }` vs. just the document).
  **Fix:** Extract a single `findOwnedDocument(id, userId, options?)` in `src/lib/db-helpers.ts`.

- [x] **#2 `resolveAiProvider` user-fetch block duplicated 6×**
  The `prisma.user.findUnique({ select: { openRouterKey, anthropicKey, aiProvider, anthropicModel } })` + `resolveAiProvider(user ?? ...)` + 402 guard is identical in `chat`, `diff`, `contradiction-check`, `ingest-canon`, `prepopulate-character`, and `brainstorm` routes.
  **Fix:** Extract `resolveProviderForUser(userId: string)` into `src/lib/ai-provider.ts`.

- [x] **#3 `CanonIngestionModal` can leave orphaned blank documents**
  `handleAccept` does `POST /api/documents` then `PATCH /api/documents/:id`. If the PATCH fails, a blank document exists with no content and the proposal is silently removed from the UI.
  **Fix:** Make `POST /api/documents` accept optional `tiptapJson` + `meta` at creation time so the operation is a single atomic call.

- [x] **#4 Silent data loss after SSE stream in chat route**
  In `src/app/api/ai/chat/route.ts`, the DB writes after the stream completes (`chatMessage.createMany`) are inside a `ReadableStream` callback with no error handling. If they throw, the client already received the response and the messages are silently not persisted.
  **Fix:** Wrap post-stream DB writes in `try/catch` and log errors.

---

## P2 — Significant

- [x] **#5 `sessionStorage` side-channel between `Sidebar` and `DocumentWorkspace`**
  `Sidebar.tsx` writes AI proposals to `sessionStorage.setItem(\`prepopulate-${id}\`, ...)` and `DocumentWorkspace.tsx` reads them back. This is SSR-unsafe, untyped, and fragile.
  **Fix:** Replace with URL query params or a server-side mechanism.

- [x] **#6 `Sidebar.tsx` is ~1900 lines with business logic in the UI**
  Contains 12 SVG icon components, 5 modal components, drag-and-drop components, multi-step API orchestration (create doc → trigger prepopulate-character → write sessionStorage), and the age gate flow.
  **Fix:** Split modals into `src/components/sidebar/SidebarModals.tsx`, icons into `src/components/icons/`, and extract business logic into custom hooks (`useDocumentCreate`, `useAgeGate`).

- [x] **#7 Version-cap logic duplicated**
  The "count versions, delete oldest if at cap, create new" pattern is copy-pasted between `versions/route.ts` and `restore/[versionId]/route.ts`.
  **Fix:** Extract `createVersionWithCap(documentId, tiptapJson, label?)` into a lib helper.

- [x] **#8 `AiMessage` / `ChatMessage` are identical duplicate types**
  `src/lib/ai-provider.ts` exports `AiMessage` and `src/lib/ai-context.ts` exports `ChatMessage` — both are `{ role: "user" | "assistant"; content: string }`.
  **Fix:** Keep one, re-export the other.

- [x] **#9 No input length validation on free-text fields**
  `body.content` in chat, `body.sourceText` in ingest-canon/prepopulate-character, and `body.name` across all create routes have no upper-bound checks. A 1MB chat message is accepted.
  **Fix:** Add explicit max-length guards (e.g. 10,000 chars for source text, 200 for names) and return 400.

- [x] **#10 `savedPrompts` ownership check is inconsistent**
  `saved-prompts/[id]/route.ts` uses `findUnique` + in-memory `userId` comparison. All other routes use `findFirst({ where: { id, userId } })`.
  **Fix:** Change to `prisma.savedPrompt.findFirst({ where: { id, userId: session.user.id } })`.

---

## P3 — Moderate

- [ ] **#11 Scope param construction duplicated in `DocumentMetaBar` and `DocumentLinksBar`**
  Both build `storyId ? \`storyId=${storyId}\` : seriesId ? ...` independently.
  **Fix:** Extract `buildScopeParam(storyId, seriesId, universeId): string | null` as a shared utility in `src/lib/documents.ts`.

- [ ] **#12 PATCH body validation for stories/series/universes duplicated 3×**
  Same field validation logic in `stories/[id]/route.ts`, `series/[id]/route.ts`, `universes/[id]/route.ts`.
  **Fix:** Extract `buildHierarchyPatchData(body)` into `src/lib/hierarchy.ts`.

- [ ] **#13 Async params type inconsistency across routes**
  Some routes use `{ params: { id: string } }` (sync), others `{ params: Promise<{ id: string }> }` (Next.js 15 async).
  **Fix:** Standardize on the async pattern throughout with a shared `RouteParams<T>` type alias.

- [ ] **#14 `as any` and `as unknown as` casts**
  - `duplicate/route.ts`: `tiptapJson: original.tiptapJson as any` — fix to `as Prisma.InputJsonValue`
  - `documents/route.ts`: `buildTemplate(...) as unknown as Prisma.InputJsonValue` — add `satisfies Prisma.InputJsonValue` to the template builder's return type.

- [ ] **#15 `content-summary.ts` mutates fetched Prisma objects in-place**
  Line 67: `doc.contentSummary = summary` mutates the array returned by `prisma.document.findMany`.
  **Fix:** Build the return array explicitly instead of mutating in place.

- [ ] **#16 `ANTHROPIC_MODEL_IDS` typed as `Record<string, string>`**
  In `src/config/ai.ts`, invalid model key lookups are not caught at compile time.
  **Fix:** Use `Record<"HAIKU" | "SONNET" | "OPUS", string>` (or import the Prisma `AnthropicModel` enum).

- [ ] **#17 `scopeWhere` priority inconsistency in `GET /api/documents`**
  Ownership validation and the Prisma query use different priority for `storyId` vs. `seriesId` when both are provided. A request with both could validate ownership of one scope but query documents in another.
  **Fix:** Reject multi-scope requests explicitly (return 400) or enforce and document a strict priority.

- [ ] **#18 No shared `<Modal>` component**
  Five modals in `Sidebar.tsx` plus `ContradictionCheckerModal` and `CanonIngestionModal` all re-implement the `fixed inset-0 bg-black/40` backdrop + stop-propagation pattern.
  **Fix:** Extract `src/components/ui/Modal.tsx` with `<Modal title onClose>` handling backdrop, focus trap, and Escape key.

- [ ] **#19 `DocumentWorkspace` re-fetches full document on every diff accept**
  `handleAcceptDiff` does a `GET /api/documents/:id` to get current content before applying the change, even though the editor already holds it.
  **Fix:** Expose current editor content via a ref or callback and pass it into `handleAcceptDiff` directly.

---

## P4 — Minor / Cleanup

- [ ] **#20 Safe-filename sanitization copy-pasted 3×**
  The same `.replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-")` expression appears in three export routes.
  **Fix:** Extract `toSafeFilename(name: string): string` into `src/lib/export.ts`.

- [ ] **#21 Inline SVG icons defined locally in multiple components**
  12 icons in `Sidebar.tsx`, `HamburgerIcon` in `DashboardShell.tsx`, `TrashIcon` in `ChatPanel.tsx`.
  **Fix:** Move all to `src/components/icons/` with a barrel export.

- [ ] **#22 `session.ts` is dead code with a wrong guard**
  `src/lib/session.ts` is never imported anywhere. Its `isValidSession` guard checks `email` instead of `id`, which is inconsistent with how every route gates access.
  **Fix:** Delete the file.

- [ ] **#23 `fetchTree()` called without `void` in async handlers**
  In `Sidebar.tsx`, `fetchTree()` is fire-and-forget inside async functions but is not prefixed with `void`.
  **Fix:** Add `void fetchTree()` for explicitness, matching the pattern used elsewhere in the codebase.

- [ ] **#24 `RenameModal` `saving` state is effectively dead**
  `setSaving(true)` is called but the modal closes before `saving` ever returns to `false`, making the state useless.
  **Fix:** Remove the `saving` state from `RenameModal`, or make `submit` async and await `onConfirm`.
