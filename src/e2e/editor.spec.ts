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
    request,
  }) => {
    const storyId = await createStory(request, "My Story");
    const docId = await createDocument(request, "Aragorn", storyId);

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
