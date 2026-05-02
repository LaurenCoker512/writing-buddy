import { test, expect, type APIRequestContext } from "@playwright/test";

const TEST_EMAIL = `e2e-editor-${Date.now()}@example.com`;
const TEST_PASSWORD = "testpassword123";
const BASE = "http://localhost:3000";

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

async function createStory(request: APIRequestContext, name: string): Promise<string> {
  const res = await request.post(`${BASE}/api/stories`, {
    data: { name, mode: "ORIGINAL", rating: "G" },
  });
  const body = (await res.json()) as { id: string };
  return body.id;
}

async function createDocument(
  request: APIRequestContext,
  name: string,
  storyId: string,
): Promise<string> {
  const res = await request.post(`${BASE}/api/documents`, {
    data: { name, type: "CHARACTER", storyId },
  });
  const body = (await res.json()) as { id: string };
  return body.id;
}

test.describe("Editor — TipTap with autosave", () => {
  test.beforeEach(async ({ page }) => {
    await registerAndLogin(page);
  });


  test("content persists after navigating away and returning", async ({
    page,
  }) => {
    const storyId = await createStory(page.request, "My Story");
    const docId = await createDocument(page.request, "Aragorn", storyId);

    await page.goto(`/dashboard/documents/${docId}`);
    await page.waitForSelector('[data-testid="tiptap-editor"]');

    const editor = page.locator('[role="textbox"]');
    await editor.click();
    await editor.type("A ranger from the north");

    // Wait for autosave (2s debounce + buffer)
    await page.waitForTimeout(3000);

    // Navigate away and return
    await page.goto("/dashboard");
    await page.goto(`/dashboard/documents/${docId}`);
    await page.waitForSelector('[data-testid="tiptap-editor"]');

    await expect(page.locator('[role="textbox"]')).toContainText(
      "A ranger from the north",
    );
  });
});

test.describe("Export toolbar", () => {
  async function freshLogin(page: import("@playwright/test").Page) {
    const email = `e2e-export-toolbar-${Date.now()}@example.com`;
    await page.request.post(`${BASE}/api/auth/register`, {
      data: { email, password: TEST_PASSWORD },
    });
    await page.goto("/signin");
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill(TEST_PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL("**/dashboard");
  }

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await freshLogin(page);
  });

  test("clicking 'Download as Markdown' triggers a .md download", async ({
    page,
  }) => {
    const storyId = await createStory(page.request, "MD Export Story");
    const docId = await createDocument(page.request, "Export Char", storyId);
    await page.goto(`/dashboard/documents/${docId}`);
    await page.waitForSelector('[data-testid="tiptap-editor"]');

    const editor = page.locator('[role="textbox"]');
    await editor.click();
    await editor.type("Content for export");

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByLabel("Download as Markdown").click(),
    ]);

    expect(download.suggestedFilename()).toMatch(/\.md$/);
  });

  test("clicking 'Copy as Markdown' copies content to clipboard", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);

    const storyId = await createStory(page.request, "Clipboard Story");
    const docId = await createDocument(page.request, "Clipboard Doc", storyId);
    await page.goto(`/dashboard/documents/${docId}`);
    await page.waitForSelector('[data-testid="tiptap-editor"]');

    const editor = page.locator('[role="textbox"]');
    await editor.click();
    await editor.type("Clipboard test content");

    await page.getByLabel("Copy as Markdown").click();

    const clipboardText = await page.evaluate(() =>
      navigator.clipboard.readText(),
    );
    expect(clipboardText).toContain("Clipboard test content");
  });

  test("clicking 'Export as PDF' opens a new tab for the PDF endpoint", async ({
    page,
  }) => {
    const storyId = await createStory(page.request, "PDF Export Story");
    const docId = await createDocument(page.request, "PDF Doc", storyId);
    await page.goto(`/dashboard/documents/${docId}`);
    await page.waitForSelector('[data-testid="tiptap-editor"]');

    // The link has target="_blank" — verify it opens a popup (new tab).
    // PDF content is already verified at the integration level.
    const [popup] = await Promise.all([
      page.waitForEvent("popup"),
      page.getByLabel("Export as PDF").click(),
    ]);

    expect(popup).not.toBeNull();
  });

  test("exporting an empty document produces a valid .md file without errors", async ({
    page,
  }) => {
    const storyId = await createStory(page.request, "Empty Export Story");
    const docId = await createDocument(page.request, "Empty Doc", storyId);
    await page.goto(`/dashboard/documents/${docId}`);
    await page.waitForSelector('[data-testid="tiptap-editor"]');

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByLabel("Download as Markdown").click(),
    ]);

    expect(download.suggestedFilename()).toMatch(/\.md$/);
    await expect(page.getByText(/error/i)).not.toBeVisible();
  });
});

// ── Document Workspace — Save Indicator ───────────────────────────────────────

test.describe("Document Workspace — save indicator", () => {
  async function freshLogin(page: import("@playwright/test").Page) {
    const email = `e2e-save-indicator-${Date.now()}@example.com`;
    await page.request.post(`${BASE}/api/auth/register`, {
      data: { email, password: TEST_PASSWORD },
    });
    await page.goto("/signin");
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill(TEST_PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL("**/dashboard");
  }

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await freshLogin(page);
  });

  test("'Saving…' appears after typing and resolves to 'Saved'", async ({ page }) => {
    const storyId = await createStory(page.request, "Autosave Story");
    const docId = await createDocument(page.request, "Autosave Doc", storyId);

    await page.goto(`/dashboard/documents/${docId}`);
    await page.waitForSelector('[data-testid="tiptap-editor"]');

    // Slow PATCH so the "Saving…" state is observable before "Saved"
    await page.route(`**/api/documents/${docId}`, async (route) => {
      if (route.request().method() === "PATCH") {
        await new Promise<void>((resolve) => setTimeout(resolve, 1200));
        await route.continue();
      } else {
        await route.continue();
      }
    });

    // Scope to the TipTap editor to avoid the ChatPanel textarea (also role=textbox)
    const tiptapTextbox = page
      .locator('[data-testid="tiptap-editor"]')
      .locator('[role="textbox"]');
    await tiptapTextbox.click();
    await tiptapTextbox.type("Autosave test content");

    // 2 s debounce → "Saving…" (aria-live) → PATCH resolves → "Saved"
    const saveIndicator = page.locator('[aria-live="polite"]');
    await expect(saveIndicator).toContainText(/Saving/, { timeout: 5000 });
    await expect(saveIndicator).toContainText("Saved", { timeout: 10000 });
  });

  test("'Save failed' appears when PATCH is blocked", async ({ page }) => {
    const storyId = await createStory(page.request, "Fail Story");
    const docId = await createDocument(page.request, "Fail Doc", storyId);

    await page.goto(`/dashboard/documents/${docId}`);
    await page.waitForSelector('[data-testid="tiptap-editor"]');

    await page.route(`**/api/documents/${docId}`, async (route) => {
      if (route.request().method() === "PATCH") {
        await route.fulfill({ status: 500, body: "" });
      } else {
        await route.continue();
      }
    });

    const tiptapTextbox = page
      .locator('[data-testid="tiptap-editor"]')
      .locator('[role="textbox"]');
    await tiptapTextbox.click();
    await tiptapTextbox.type("Fail save content");

    await expect(page.locator('[aria-live="polite"]')).toContainText("Save failed", {
      timeout: 10000,
    });
  });
});

// ── Document Workspace — Canon Badge ─────────────────────────────────────────

test.describe("Document Workspace — canon badge", () => {
  async function freshLogin(page: import("@playwright/test").Page) {
    const email = `e2e-canon-${Date.now()}@example.com`;
    await page.request.post(`${BASE}/api/auth/register`, {
      data: { email, password: TEST_PASSWORD },
    });
    await page.goto("/signin");
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill(TEST_PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL("**/dashboard");
  }

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await freshLogin(page);
  });

  test("canon badge (C, amber) is visible when isCanon is true", async ({ page }) => {
    const storyId = await createStory(page.request, "Canon Story");
    const res = await page.request.post(`${BASE}/api/documents`, {
      data: { name: "Canon Doc", type: "CHARACTER", storyId, meta: { isCanon: true } },
    });
    const { id: docId } = (await res.json()) as { id: string };

    await page.goto(`/dashboard/documents/${docId}`);
    await page.waitForSelector('[data-testid="tiptap-editor"]');

    await expect(page.getByLabel("Canon document")).toBeVisible();
    await expect(page.getByLabel("Canon document")).toContainText("C");
  });
});

// ── Document Workspace — Contradictions Button ────────────────────────────────

test.describe("Document Workspace — contradictions button", () => {
  async function freshLogin(page: import("@playwright/test").Page) {
    const email = `e2e-contradictions-${Date.now()}@example.com`;
    await page.request.post(`${BASE}/api/auth/register`, {
      data: { email, password: TEST_PASSWORD },
    });
    await page.goto("/signin");
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill(TEST_PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL("**/dashboard");
  }

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await freshLogin(page);
  });

  test("visible for story-scoped documents", async ({ page }) => {
    const storyId = await createStory(page.request, "Story Scope Story");
    const docId = await createDocument(page.request, "Story Scope Doc", storyId);

    await page.goto(`/dashboard/documents/${docId}`);
    await page.waitForSelector('[data-testid="tiptap-editor"]');

    await expect(page.getByTestId("contradiction-checker-button")).toBeVisible();
  });

  test("absent for universe-scoped documents", async ({ page }) => {
    const univRes = await page.request.post(`${BASE}/api/universes`, {
      data: { name: "Universe Scope Univ", mode: "ORIGINAL", rating: "G" },
    });
    const { id: univId } = (await univRes.json()) as { id: string };

    const docRes = await page.request.post(`${BASE}/api/documents`, {
      data: { name: "Universe Scope Doc", type: "CHARACTER", universeId: univId },
    });
    const { id: docId } = (await docRes.json()) as { id: string };

    await page.goto(`/dashboard/documents/${docId}`);
    await page.waitForSelector('[data-testid="tiptap-editor"]');

    await expect(page.getByTestId("contradiction-checker-button")).not.toBeVisible();
  });
});

// ── Document Workspace — Specialization ──────────────────────────────────────

test.describe("Document Workspace — specialization", () => {
  async function freshLogin(page: import("@playwright/test").Page) {
    const email = `e2e-specialization-${Date.now()}@example.com`;
    await page.request.post(`${BASE}/api/auth/register`, {
      data: { email, password: TEST_PASSWORD },
    });
    await page.goto("/signin");
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill(TEST_PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL("**/dashboard");
  }

  async function setupSpecializationFixture(page: import("@playwright/test").Page) {
    const univRes = await page.request.post(`${BASE}/api/universes`, {
      data: { name: "Spec Univ", mode: "ORIGINAL", rating: "G" },
    });
    const { id: univId } = (await univRes.json()) as { id: string };

    await page.request.post(`${BASE}/api/documents`, {
      data: { name: "Universe Char", type: "CHARACTER", universeId: univId },
    });

    const storyRes = await page.request.post(`${BASE}/api/stories`, {
      data: { name: "Spec Story", mode: "ORIGINAL", rating: "G", universeId: univId },
    });
    const { id: storyId } = (await storyRes.json()) as { id: string };

    const docRes = await page.request.post(`${BASE}/api/documents`, {
      data: { name: "Story Char", type: "CHARACTER", storyId },
    });
    const { id: docId } = (await docRes.json()) as { id: string };

    return docId;
  }

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await freshLogin(page);
  });

  test("'+ Link to universe document' visible when candidates exist", async ({ page }) => {
    const docId = await setupSpecializationFixture(page);

    await page.goto(`/dashboard/documents/${docId}`);
    await page.waitForSelector('[data-testid="tiptap-editor"]');

    await expect(page.getByTestId("link-parent-button")).toBeVisible();
    await expect(page.getByTestId("link-parent-button")).toContainText(
      "+ Link to universe document",
    );
  });

  test("specialization banner shows 'Specialization of:' with Change and Remove after linking", async ({
    page,
  }) => {
    const docId = await setupSpecializationFixture(page);

    await page.goto(`/dashboard/documents/${docId}`);
    await page.waitForSelector('[data-testid="tiptap-editor"]');

    await page.getByTestId("link-parent-button").click();
    await page.getByRole("button", { name: "Universe Char" }).click();

    // The outer span combines "Specialization of: Universe Char" in its textContent
    await expect(page.getByText(/Specialization of:/)).toBeVisible({ timeout: 5000 });
    await expect(page.getByLabel("Change parent document")).toBeVisible();
    await expect(page.getByLabel("Remove parent document link")).toBeVisible();
  });
});
