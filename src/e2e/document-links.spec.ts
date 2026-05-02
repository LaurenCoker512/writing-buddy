import { test, expect } from "@playwright/test";

const TEST_EMAIL = `e2e-doclinks-${Date.now()}@example.com`;
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

async function createStory(
  request: import("@playwright/test").APIRequestContext,
): Promise<string> {
  const res = await request.post(`${BASE}/api/stories`, {
    data: { name: "Test Story", mode: "ORIGINAL", rating: "G" },
  });
  const body = (await res.json()) as { id: string };
  return body.id;
}

async function createDocument(
  request: import("@playwright/test").APIRequestContext,
  name: string,
  type: string,
  storyId: string,
  meta?: Record<string, unknown>,
): Promise<string> {
  const res = await request.post(`${BASE}/api/documents`, {
    data: { name, type, storyId, ...(meta !== undefined ? { meta } : {}) },
  });
  const body = (await res.json()) as { id: string };
  return body.id;
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

test.describe("Document Links Bar", () => {
  let storyId: string;
  let char1Id: string;
  let char2Id: string;
  let relId: string;
  let plotId: string;

  test.beforeEach(async ({ page }) => {
    await registerAndLogin(page);
    // Use page.request so API calls carry the authenticated session cookie.
    storyId = await createStory(page.request);
    char1Id = await createDocument(page.request, "Aragorn", "CHARACTER", storyId);
    char2Id = await createDocument(page.request, "Boromir", "CHARACTER", storyId);
    relId = await createDocument(page.request, "Rivals", "RELATIONSHIP", storyId, {
      characterIds: [char1Id, char2Id],
    });
    plotId = await createDocument(page.request, "The Journey", "PLOT", storyId);
  });

  // ── CHARACTER doc ───────────────────────────────────────────────────────────

  test("CHARACTER doc with a relationship: links bar shows the relationship doc", async ({
    page,
  }) => {
    await page.goto(`/dashboard/documents/${char1Id}`);

    const linksBar = page.getByText(/^Relationships$/i);
    await expect(linksBar).toBeVisible({ timeout: 8000 });
    await expect(page.getByRole("link", { name: "Rivals" })).toBeVisible();
  });

  test("CHARACTER doc with a relationship: link shows the other character's name", async ({
    page,
  }) => {
    await page.goto(`/dashboard/documents/${char1Id}`);

    await expect(page.getByText(/^Relationships$/i)).toBeVisible({ timeout: 8000 });
    // The links bar renders "Rivals with Boromir" when viewing Aragorn's doc
    await expect(page.getByRole("link", { name: "Boromir" })).toBeVisible();
  });

  // ── RELATIONSHIP doc ────────────────────────────────────────────────────────

  test("RELATIONSHIP doc: links bar shows both character docs", async ({ page }) => {
    await page.goto(`/dashboard/documents/${relId}`);

    const linksBar = page.getByText(/^Characters$/i);
    await expect(linksBar).toBeVisible({ timeout: 8000 });
    await expect(page.getByRole("link", { name: "Aragorn" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Boromir" })).toBeVisible();
  });

  // ── Link navigation ─────────────────────────────────────────────────────────

  test("clicking a character link from the RELATIONSHIP doc navigates to that document", async ({
    page,
  }) => {
    await page.goto(`/dashboard/documents/${relId}`);

    await expect(page.getByText(/^Characters$/i)).toBeVisible({ timeout: 8000 });
    await page.getByRole("link", { name: "Aragorn" }).click();
    await expect(page).toHaveURL(`/dashboard/documents/${char1Id}`);
  });

  test("clicking a relationship link from the CHARACTER doc navigates to that document", async ({
    page,
  }) => {
    await page.goto(`/dashboard/documents/${char1Id}`);

    await expect(page.getByText(/^Relationships$/i)).toBeVisible({ timeout: 8000 });
    await page.getByRole("link", { name: "Rivals" }).click();
    await expect(page).toHaveURL(`/dashboard/documents/${relId}`);
  });

  // ── PLOT/SCENE doc — no links bar ───────────────────────────────────────────

  test("PLOT document: no links bar rendered", async ({ page }) => {
    await page.goto(`/dashboard/documents/${plotId}`);

    // Wait for the editor heading to confirm the page has loaded
    await expect(
      page.getByRole("heading", { name: "The Journey" }),
    ).toBeVisible({ timeout: 8000 });

    await expect(page.getByText(/^Relationships$/i)).not.toBeVisible();
    await expect(page.getByText(/^Characters$/i)).not.toBeVisible();
  });
});
