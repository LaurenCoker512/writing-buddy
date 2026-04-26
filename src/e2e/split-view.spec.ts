import { test, expect, type APIRequestContext } from "@playwright/test";

const TEST_EMAIL = `e2e-split-${Date.now()}@example.com`;
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

async function createStoryAndDocument(request: APIRequestContext): Promise<string> {
  const storyRes = await request.post(`${BASE}/api/stories`, {
    data: { name: "Split View Story", mode: "ORIGINAL", rating: "G" },
  });
  const { id: storyId } = (await storyRes.json()) as { id: string };

  const docRes = await request.post(`${BASE}/api/documents`, {
    data: { name: "Test Doc", type: "CHARACTER", storyId },
  });
  const { id: docId } = (await docRes.json()) as { id: string };
  return docId;
}

test.describe("Split-View Layout", () => {
  test.beforeEach(async ({ page }) => {
    await registerAndLogin(page);
  });

  test("drag divider resizes panels; both remain visible", async ({
    page,
    request,
  }) => {
    const docId = await createStoryAndDocument(request);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`/dashboard/documents/${docId}`);
    await page.waitForSelector('[data-testid="tiptap-editor"]');

    const divider = page.locator('[data-testid="split-divider"]');
    const editorPanel = page.locator('[data-testid="editor-panel"]');
    const chatPanel = page.locator('[data-testid="chat-panel"]');

    await expect(divider).toBeVisible();

    const dividerBox = await divider.boundingBox();
    if (!dividerBox) throw new Error("Divider not found");

    const centerX = dividerBox.x + dividerBox.width / 2;
    const centerY = dividerBox.y + dividerBox.height / 2;

    await page.mouse.move(centerX, centerY);
    await page.mouse.down();
    await page.mouse.move(centerX + 150, centerY, { steps: 10 });
    await page.mouse.up();

    await expect(editorPanel).toBeVisible();
    await expect(chatPanel).toBeVisible();
  });

  test("panels stack vertically on tablet viewport", async ({
    page,
    request,
  }) => {
    const docId = await createStoryAndDocument(request);
    await page.setViewportSize({ width: 900, height: 700 });
    await page.goto(`/dashboard/documents/${docId}`);
    await page.waitForSelector('[data-testid="tiptap-editor"]');

    const editorPanel = page.locator('[data-testid="editor-panel"]');
    const chatPanel = page.locator('[data-testid="chat-panel"]');

    await expect(editorPanel).toBeVisible();
    await expect(chatPanel).toBeVisible();

    const editorBox = await editorPanel.boundingBox();
    const chatBox = await chatPanel.boundingBox();

    // Editor should be above chat
    expect(editorBox!.y + editorBox!.height).toBeLessThanOrEqual(chatBox!.y + 1);
    // Draggable divider should not be visible on tablet
    await expect(page.locator('[data-testid="split-divider"]')).not.toBeVisible();
  });

  test("mobile toggle hides and reveals panels", async ({ page, request }) => {
    const docId = await createStoryAndDocument(request);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`/dashboard/documents/${docId}`);
    await page.waitForSelector('[data-testid="tiptap-editor"]');

    const editorPanel = page.locator('[data-testid="editor-panel"]');
    const chatPanel = page.locator('[data-testid="chat-panel"]');
    const editorTab = page.getByRole("tab", { name: /editor/i });
    const chatTab = page.getByRole("tab", { name: /ai chat/i });

    // Editor visible by default
    await expect(editorPanel).toBeVisible();
    await expect(chatPanel).not.toBeVisible();

    // Switch to AI Chat
    await chatTab.click();
    await expect(chatPanel).toBeVisible();
    await expect(editorPanel).not.toBeVisible();

    // Switch back to Editor
    await editorTab.click();
    await expect(editorPanel).toBeVisible();
    await expect(chatPanel).not.toBeVisible();
  });
});
