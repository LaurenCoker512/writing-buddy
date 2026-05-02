import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3000";
const TEST_PASSWORD = "testpassword123";

async function registerAndLogin(page: import("@playwright/test").Page) {
  const email = `e2e-export-ctx-${Date.now()}@example.com`;
  await page.request.post(`${BASE}/api/auth/register`, {
    data: { email, password: TEST_PASSWORD },
  });
  await page.goto("/signin");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL("**/dashboard");
}

async function createStoryAndDocument(
  page: import("@playwright/test").Page,
): Promise<{ storyId: string; docId: string }> {
  const storyRes = await page.request.post(`${BASE}/api/stories`, {
    data: { name: "Context Export Story", mode: "ORIGINAL", rating: "G" },
  });
  const { id: storyId } = (await storyRes.json()) as { id: string };
  const docRes = await page.request.post(`${BASE}/api/documents`, {
    data: { name: "Context Export Doc", type: "CHARACTER", storyId },
  });
  const { id: docId } = (await docRes.json()) as { id: string };
  return { storyId, docId };
}

async function openDocumentContextMenu(
  page: import("@playwright/test").Page,
  storyId: string,
  docId: string,
) {
  // Standalone stories start collapsed — click the expand chevron
  const storyGroupDiv = page
    .getByTestId(`story-node-${storyId}`)
    .locator("xpath=..");
  await storyGroupDiv.getByLabel(/expand/i).click();

  // Hover document node to reveal ... button, then click it
  await page.getByTestId(`document-node-${docId}`).hover();
  await page.getByTestId(`document-menu-${docId}`).click();
}

test.describe("Export — context menu", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await registerAndLogin(page);
    await page.waitForSelector('[data-testid="project-tree"]');
  });

  test("Export as Markdown downloads a .md file", async ({ page }) => {
    const { storyId, docId } = await createStoryAndDocument(page);
    await page.reload();
    await page.waitForSelector('[data-testid="project-tree"]');

    await openDocumentContextMenu(page, storyId, docId);

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("menuitem", { name: "Export as Markdown" }).click(),
    ]);

    expect(download.suggestedFilename()).toMatch(/\.md$/);
  });

  test("Export as PDF opens a new tab for the PDF endpoint", async ({ page }) => {
    const { storyId, docId } = await createStoryAndDocument(page);
    await page.reload();
    await page.waitForSelector('[data-testid="project-tree"]');

    await openDocumentContextMenu(page, storyId, docId);

    // The link has target="_blank" — verify it opens a popup (new tab).
    // PDF content is already verified at the integration level.
    const [popup] = await Promise.all([
      page.waitForEvent("popup"),
      page.getByRole("menuitem", { name: "Export as PDF" }).click(),
    ]);

    expect(popup).not.toBeNull();
  });
});
