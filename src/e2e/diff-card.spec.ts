import { test, expect } from "@playwright/test";

const TEST_EMAIL = `e2e-diff-${Date.now()}@example.com`;
const TEST_PASSWORD = "testpassword123";
const BASE = "http://localhost:3000";

const DOC_WITH_HEADINGS = {
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "Introduction" }],
    },
    {
      type: "paragraph",
      content: [{ type: "text", text: "Old intro content here." }],
    },
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "Other Section" }],
    },
    {
      type: "paragraph",
      content: [{ type: "text", text: "Unchanged section text." }],
    },
  ],
};

function makeEditProposal(overrides: Record<string, unknown> = {}) {
  return {
    id: "p-edit-1",
    heading: "Introduction",
    headingLevel: 2,
    beforeMarkdown: "Old intro content here.",
    newMarkdown: "Updated intro content via diff.",
    isNew: false,
    ...overrides,
  };
}

function makeNewProposal(overrides: Record<string, unknown> = {}) {
  return {
    id: "p-new-1",
    heading: null,
    headingLevel: 0,
    beforeMarkdown: "",
    newMarkdown: "Brand new appended section content.",
    isNew: true,
    ...overrides,
  };
}

async function registerAndLogin(page: import("@playwright/test").Page) {
  await page.request.post(`${BASE}/api/auth/register`, {
    data: { email: TEST_EMAIL, password: TEST_PASSWORD },
  });
  await page.goto("/signin");
  await page.getByLabel(/email/i).fill(TEST_EMAIL);
  await page.getByLabel(/password/i).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL("**/dashboard");
}

async function createDocument(
  page: import("@playwright/test").Page,
  tiptapJson?: object,
): Promise<string> {
  const storyRes = await page.request.post(`${BASE}/api/stories`, {
    data: { name: "Diff Test Story", mode: "ORIGINAL", rating: "G" },
  });
  const { id: storyId } = (await storyRes.json()) as { id: string };
  const docRes = await page.request.post(`${BASE}/api/documents`, {
    data: { name: "Diff Test Doc", type: "CHARACTER", storyId },
  });
  const { id: docId } = (await docRes.json()) as { id: string };
  if (tiptapJson !== undefined) {
    await page.request.patch(`${BASE}/api/documents/${docId}`, {
      data: { tiptapJson },
    });
  }
  return docId;
}

async function mockDiffRoute(
  page: import("@playwright/test").Page,
  proposals: object[],
) {
  await page.route("**/api/ai/diff", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ proposals }),
    });
  });
}

async function openDiffCards(
  page: import("@playwright/test").Page,
  docId: string,
) {
  await page.goto(`/dashboard/documents/${docId}`);
  await page.waitForSelector('[data-testid="tiptap-editor"]');
  // Switch to Edit mode (only one "Edit" button exists when in Chat mode)
  await page.getByRole("button", { name: "Edit" }).click();
  await page.getByLabel("Edit instruction input").fill("Make some edits");
  await page.getByLabel("Request edit").click();
  await page.waitForSelector('[role="region"][aria-label^="Proposed edit:"]');
}

test.describe("DiffCard Accept/Reject", () => {
  test.beforeEach(async ({ page }) => {
    await registerAndLogin(page);
  });

  test('DiffCard shows "Before" and "After" sections', async ({ page }) => {
    const docId = await createDocument(page);
    await mockDiffRoute(page, [makeEditProposal()]);
    await openDiffCards(page, docId);

    const card = page.getByRole("region", {
      name: /Proposed edit: Edit: Introduction/i,
    });
    await expect(card.getByText("Before")).toBeVisible();
    await expect(card.getByText("After")).toBeVisible();
    await expect(card.getByText("Old intro content here.")).toBeVisible();
    await expect(card.getByText("Updated intro content via diff.")).toBeVisible();
  });

  test("long content is clamped to prevent overflow", async ({ page }) => {
    const longText = "A ".repeat(300).trim();
    const docId = await createDocument(page);
    await mockDiffRoute(page, [
      makeEditProposal({ beforeMarkdown: longText, newMarkdown: longText }),
    ]);
    await openDiffCards(page, docId);

    const pres = page.locator(
      '[role="region"][aria-label^="Proposed edit:"] pre',
    );
    await expect(pres.first()).toHaveClass(/line-clamp-5/);
  });

  test('clicking "Accept" updates editor content immediately', async ({
    page,
  }) => {
    const docId = await createDocument(page, DOC_WITH_HEADINGS);
    await mockDiffRoute(page, [makeNewProposal()]);
    await openDiffCards(page, docId);

    await page
      .getByRole("region", { name: /Proposed edit: New section/i })
      .getByRole("button", { name: "Accept" })
      .click();

    await expect(page.locator('[role="textbox"]')).toContainText(
      "Brand new appended section content.",
      { timeout: 5000 },
    );
  });

  test('"Accept" creates a version snapshot visible in History', async ({
    page,
  }) => {
    const docId = await createDocument(page, DOC_WITH_HEADINGS);
    await mockDiffRoute(page, [makeEditProposal()]);
    await openDiffCards(page, docId);

    await page
      .getByRole("region", { name: /Proposed edit: Edit: Introduction/i })
      .getByRole("button", { name: "Accept" })
      .click();

    await page.getByTestId("version-history-button").click();
    await page.waitForSelector('[data-testid="version-history-panel"]');
    await expect(page.getByText("Saved version")).toBeVisible();
  });

  test('"Accept" shows "Saved" indicator in the editor toolbar', async ({
    page,
  }) => {
    const docId = await createDocument(page, DOC_WITH_HEADINGS);
    await mockDiffRoute(page, [makeNewProposal()]);
    await openDiffCards(page, docId);

    await page
      .getByRole("region", { name: /Proposed edit: New section/i })
      .getByRole("button", { name: "Accept" })
      .click();

    await expect(page.getByText("Saved")).toBeVisible({ timeout: 8000 });
  });

  test('"Reject" removes the card and leaves document content unchanged', async ({
    page,
  }) => {
    const docId = await createDocument(page, DOC_WITH_HEADINGS);
    await mockDiffRoute(page, [makeNewProposal()]);
    await openDiffCards(page, docId);

    await page
      .getByRole("region", { name: /Proposed edit: New section/i })
      .getByRole("button", { name: "Reject" })
      .click();

    await expect(
      page.getByRole("region", { name: /Proposed edit:/i }),
    ).not.toBeVisible();
    await expect(page.locator('[role="textbox"]')).not.toContainText(
      "Brand new appended section content.",
    );
    await expect(page.locator('[role="textbox"]')).toContainText(
      "Old intro content here.",
    );
  });

  test("accepting one and rejecting another behave independently", async ({
    page,
  }) => {
    const proposal1 = makeEditProposal({
      id: "p1",
      newMarkdown: "Accepted proposal content.",
    });
    const proposal2 = makeNewProposal({
      id: "p2",
      newMarkdown: "Rejected proposal content.",
    });
    const docId = await createDocument(page, DOC_WITH_HEADINGS);
    await mockDiffRoute(page, [proposal1, proposal2]);
    await openDiffCards(page, docId);

    await page
      .getByRole("region", { name: /Proposed edit: Edit: Introduction/i })
      .getByRole("button", { name: "Accept" })
      .click();
    await page
      .getByRole("region", { name: /Proposed edit: New section/i })
      .getByRole("button", { name: "Reject" })
      .click();

    await expect(
      page.getByRole("region", { name: /Proposed edit:/i }),
    ).not.toBeVisible();

    const editor = page.locator('[role="textbox"]');
    await expect(editor).toContainText("Accepted proposal content.", {
      timeout: 5000,
    });
    await expect(editor).not.toContainText("Rejected proposal content.");
  });

  test('accepting a "new section" proposal appends content to the document', async ({
    page,
  }) => {
    const docId = await createDocument(page, DOC_WITH_HEADINGS);
    await mockDiffRoute(page, [makeNewProposal()]);
    await openDiffCards(page, docId);

    await page
      .getByRole("region", { name: /Proposed edit: New section/i })
      .getByRole("button", { name: "Accept" })
      .click();

    const editor = page.locator('[role="textbox"]');
    await expect(editor).toContainText("Introduction", { timeout: 5000 });
    await expect(editor).toContainText("Brand new appended section content.");
    await expect(editor).toContainText("Unchanged section text.");
  });

  test('accepting an "existing section" proposal replaces only that section', async ({
    page,
  }) => {
    const docId = await createDocument(page, DOC_WITH_HEADINGS);
    await mockDiffRoute(page, [makeEditProposal()]);
    await openDiffCards(page, docId);

    await page
      .getByRole("region", { name: /Proposed edit: Edit: Introduction/i })
      .getByRole("button", { name: "Accept" })
      .click();

    const editor = page.locator('[role="textbox"]');
    await expect(editor).toContainText("Updated intro content via diff.", {
      timeout: 5000,
    });
    await expect(editor).not.toContainText("Old intro content here.");
    await expect(editor).toContainText("Unchanged section text.");
  });

  test("accepting two proposals in quick succession does not duplicate content", async ({
    page,
  }) => {
    const proposal1 = makeNewProposal({
      id: "p1",
      newMarkdown: "First unique section content.",
    });
    const proposal2 = makeNewProposal({
      id: "p2",
      newMarkdown: "Second unique section content.",
    });
    const docId = await createDocument(page, DOC_WITH_HEADINGS);
    await mockDiffRoute(page, [proposal1, proposal2]);
    await openDiffCards(page, docId);

    // Accept the first card
    await page
      .getByRole("region", { name: /Proposed edit:/i })
      .first()
      .getByRole("button", { name: "Accept" })
      .click();
    // Accept the now-first card (previously second) before the first has fully settled
    await page
      .getByRole("region", { name: /Proposed edit:/i })
      .first()
      .getByRole("button", { name: "Accept" })
      .click();

    // Wait for both cards to be gone
    await expect(
      page.getByRole("region", { name: /Proposed edit:/i }),
    ).not.toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(500);

    const editorText =
      (await page.locator('[role="textbox"]').textContent()) ?? "";
    // Neither proposal's content should appear more than once (no duplication)
    const count1 = editorText.split("First unique section content.").length - 1;
    const count2 = editorText.split("Second unique section content.").length - 1;
    expect(count1).toBeLessThanOrEqual(1);
    expect(count2).toBeLessThanOrEqual(1);
  });
});
