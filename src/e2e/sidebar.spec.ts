import { test, expect, type APIRequestContext } from "@playwright/test";

// ── Helpers ──────────────────────────────────────────────────────────────────

const TEST_EMAIL = `e2e-sidebar-${Date.now()}@example.com`;
const TEST_PASSWORD = "testpassword123";
const BASE = "http://localhost:3000";

async function registerAndLogin(page: import("@playwright/test").Page) {
  // Register via API
  await page.request.post(`${BASE}/api/auth/register`, {
    data: { email: TEST_EMAIL, password: TEST_PASSWORD },
  });

  // Login via UI
  await page.goto("/signin");
  await page.getByLabel(/email/i).fill(TEST_EMAIL);
  await page.getByLabel(/password/i).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL("**/dashboard");
}

async function createUniverse(
  request: APIRequestContext,
  name: string,
): Promise<string> {
  const res = await request.post(`${BASE}/api/universes`, {
    data: { name, mode: "ORIGINAL", rating: "G" },
  });
  const body = (await res.json()) as { id: string };
  return body.id;
}

async function createSeries(
  request: APIRequestContext,
  name: string,
  universeId?: string,
): Promise<string> {
  const res = await request.post(`${BASE}/api/series`, {
    data: { name, mode: "ORIGINAL", rating: "G", universeId },
  });
  const body = (await res.json()) as { id: string };
  return body.id;
}

async function createStory(
  request: APIRequestContext,
  name: string,
  opts?: { universeId?: string; seriesId?: string },
): Promise<string> {
  const res = await request.post(`${BASE}/api/stories`, {
    data: { name, mode: "ORIGINAL", rating: "G", ...opts },
  });
  const body = (await res.json()) as { id: string };
  return body.id;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe("Sidebar — project tree", () => {
  test.beforeEach(async ({ page }) => {
    await registerAndLogin(page);
  });

  test("renders full Universe → Series → Story chain in sidebar", async ({
    page,
    request,
  }) => {
    const uId = await createUniverse(request, "Middle Earth");
    const sId = await createSeries(request, "Lord of the Rings", uId);
    await createStory(request, "The Fellowship", { universeId: uId, seriesId: sId });

    await page.reload();
    await page.waitForSelector('[data-testid="project-tree"]');

    // Universe node visible
    await expect(
      page.getByTestId(`universe-node-${uId}`),
    ).toBeVisible();

    // Expand universe (already expanded by default)
    // Series node visible under it
    await expect(
      page.getByTestId(`series-node-${sId}`),
    ).toBeVisible();

    // Click series to expand it
    await page.getByTestId(`series-node-${sId}`).click();

    // Story node visible under series
    await expect(page.locator('[data-testid^="story-node-"]')).toBeVisible();
  });

  test("rename a Story — updated name appears in sidebar", async ({
    page,
    request,
  }) => {
    const storyId = await createStory(request, "Original Title");
    await page.reload();
    await page.waitForSelector('[data-testid="project-tree"]');

    // Open context menu for the story
    const storyNode = page.getByTestId(`story-node-${storyId}`);
    await expect(storyNode).toBeVisible();

    // Hover to reveal the ... button
    await storyNode.hover();
    const menuBtn = page.getByTestId(`story-menu-${storyId}`);
    await menuBtn.click();

    // Click Rename in context menu
    await page.getByRole("menuitem", { name: "Rename" }).click();

    // Modal appears
    await expect(page.getByRole("heading", { name: /rename story/i })).toBeVisible();

    // Clear and type new name
    const input = page.getByLabel("New name");
    await input.clear();
    await input.fill("Renamed Title");
    await page.getByRole("button", { name: "Rename" }).click();

    // Updated name shows in sidebar
    await expect(page.getByText("Renamed Title")).toBeVisible();
  });

  test("delete a Universe — orphaned Series still exists in sidebar", async ({
    page,
    request,
  }) => {
    const uId = await createUniverse(request, "Deletable Universe");
    const sId = await createSeries(request, "Orphan Series", uId);

    await page.reload();
    await page.waitForSelector('[data-testid="project-tree"]');

    // Open context menu for the universe
    const universeNode = page.getByTestId(`universe-node-${uId}`);
    await universeNode.hover();
    const menuBtn = page.getByTestId(`universe-menu-${uId}`);
    await menuBtn.click();

    // Click Delete
    await page.getByRole("menuitem", { name: "Delete" }).click();

    // Confirm in modal
    await expect(page.getByRole("heading", { name: /delete universe/i })).toBeVisible();
    await page.getByRole("button", { name: "Delete" }).click();

    // Universe is gone
    await expect(
      page.getByTestId(`universe-node-${uId}`),
    ).not.toBeVisible();

    // Orphaned series still shows in sidebar (now standalone)
    await expect(
      page.getByTestId(`series-node-${sId}`),
    ).toBeVisible();
  });

  test("sidebar collapse and expand on desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForSelector('[data-testid="sidebar"]');

    const sidebar = page.getByTestId("sidebar");

    // Starts expanded (w-64 = 256px)
    await expect(sidebar).toHaveAttribute("data-collapsed", "false");

    // Collapse
    await page.getByTestId("sidebar-collapse-btn").click();
    await expect(sidebar).toHaveAttribute("data-collapsed", "true");

    // Expand again
    await page.getByTestId("sidebar-collapse-btn").click();
    await expect(sidebar).toHaveAttribute("data-collapsed", "false");
  });
});

test.describe("Sidebar — mobile", () => {
  test("sidebar is hidden on mobile and shown via hamburger", async ({ page }) => {
    // Register and login with mobile viewport
    await page.setViewportSize({ width: 390, height: 844 });

    await page.request.post(`${BASE}/api/auth/register`, {
      data: {
        email: `e2e-mobile-${Date.now()}@example.com`,
        password: TEST_PASSWORD,
      },
    });

    // Login (reuse same flow, just different email per test isolation)
    await page.goto("/signin");

    // Fill in with the last registered email by using a unique one per test
    const mobileEmail = `e2e-mobile-check-${Date.now()}@example.com`;
    await page.request.post(`${BASE}/api/auth/register`, {
      data: { email: mobileEmail, password: TEST_PASSWORD },
    });
    await page.getByLabel(/email/i).fill(mobileEmail);
    await page.getByLabel(/password/i).fill(TEST_PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL("**/dashboard");

    // Desktop sidebar should not be visible on mobile
    await expect(page.getByTestId("sidebar")).not.toBeVisible();

    // Mobile sidebar overlay should not be visible yet
    await expect(page.getByTestId("mobile-sidebar")).not.toBeAttached();

    // Click hamburger to open
    await page.getByTestId("hamburger-btn").click();
    await expect(page.getByTestId("mobile-sidebar")).toBeVisible();

    // Click backdrop to close
    await page.getByLabel("Close sidebar").click();
    await expect(page.getByTestId("mobile-sidebar")).not.toBeAttached();
  });
});
