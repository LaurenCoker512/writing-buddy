import { test, expect, type APIRequestContext } from "@playwright/test";

const TEST_EMAIL = `e2e-fanfic-ai-${Date.now()}@example.com`;
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

async function createUniverse(request: APIRequestContext, name: string): Promise<string> {
  const res = await request.post(`${BASE}/api/universes`, {
    data: { name, mode: "FANFIC", rating: "T" },
  });
  const body = (await res.json()) as { id: string };
  return body.id;
}

async function createDocument(
  request: APIRequestContext,
  name: string,
  type: string,
  universeId: string,
  meta?: Record<string, unknown>,
): Promise<string> {
  const res = await request.post(`${BASE}/api/documents`, {
    data: { name, type, universeId },
  });
  const body = (await res.json()) as { id: string };
  if (meta) {
    await request.patch(`${BASE}/api/documents/${body.id}`, { data: { meta } });
  }
  return body.id;
}

test.describe("Fanfic Mode: AU Variants", () => {
  test("duplicate canon worldbuilding entry shows [AU] badge in sidebar", async ({ page }) => {
    await registerAndLogin(page);

    const universeId = await createUniverse(page.request, "Harry Potter Universe");
    const docId = await createDocument(
      page.request,
      "Hogwarts",
      "WORLDBUILDING",
      universeId,
      { isCanon: true },
    );

    // Navigate to dashboard and expand the universe
    await page.goto("/dashboard");
    await page.waitForSelector(`[data-testid="document-node-${docId}"]`);

    // Open context menu for the canon document
    await page.hover(`[data-testid="document-node-${docId}"]`);
    await page.click(`[data-testid="document-menu-${docId}"]`);
    await page.waitForSelector('[data-testid="context-menu"]');

    // Click "Duplicate as AU"
    await page.getByRole("menuitem", { name: /duplicate as au/i }).click();

    // Wait for sidebar to refresh and show the AU document
    await page.waitForSelector('[aria-label="AU variant"]');
    const auBadge = page.locator('[aria-label="AU variant"]').first();
    await expect(auBadge).toBeVisible();
    await expect(auBadge).toContainText("AU");

    // Canon document should still show [C] badge
    const canonBadge = page.locator('[aria-label="Canon"]').first();
    await expect(canonBadge).toBeVisible();
  });
});
