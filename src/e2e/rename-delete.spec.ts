import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3000";
const TEST_PASSWORD = "testpassword123";

// ── Helpers ───────────────────────────────────────────────────────────────────

async function registerAndLogin(page: import("@playwright/test").Page) {
  const email = `e2e-rename-delete-${Date.now()}@example.com`;
  await page.request.post(`${BASE}/api/auth/register`, {
    data: { email, password: TEST_PASSWORD },
  });
  await page.goto("/signin");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL("**/dashboard");
}

async function createUniverse(
  page: import("@playwright/test").Page,
  name: string,
): Promise<string> {
  const res = await page.request.post(`${BASE}/api/universes`, {
    data: { name, mode: "ORIGINAL", rating: "G" },
  });
  return ((await res.json()) as { id: string }).id;
}

async function createSeries(
  page: import("@playwright/test").Page,
  name: string,
  universeId?: string,
): Promise<string> {
  const res = await page.request.post(`${BASE}/api/series`, {
    data: { name, mode: "ORIGINAL", rating: "G", universeId },
  });
  return ((await res.json()) as { id: string }).id;
}

async function createStory(
  page: import("@playwright/test").Page,
  name: string,
  opts: { universeId?: string; seriesId?: string } = {},
): Promise<string> {
  const res = await page.request.post(`${BASE}/api/stories`, {
    data: { name, mode: "ORIGINAL", rating: "G", ...opts },
  });
  return ((await res.json()) as { id: string }).id;
}

async function createDocument(
  page: import("@playwright/test").Page,
  name: string,
  storyId: string,
  type = "CHARACTER",
): Promise<string> {
  const res = await page.request.post(`${BASE}/api/documents`, {
    data: { name, type, storyId },
  });
  return ((await res.json()) as { id: string }).id;
}

/** Hover a node (making the .group parent active) then click its … menu button. */
async function openContextMenu(
  page: import("@playwright/test").Page,
  nodeTestId: string,
  menuTestId: string,
) {
  await page.getByTestId(nodeTestId).hover();
  await page.getByTestId(menuTestId).click();
}

/** Expand a standalone story by clicking its chevron. */
async function expandStory(
  page: import("@playwright/test").Page,
  storyId: string,
) {
  await page
    .getByTestId(`story-node-${storyId}`)
    .locator("xpath=..")
    .getByLabel(/expand/i)
    .click();
}

// ── Rename Modal ──────────────────────────────────────────────────────────────

test.describe("Rename Modal", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await registerAndLogin(page);
    await page.waitForSelector('[data-testid="project-tree"]');
  });

  test("modal opens with the current name pre-filled", async ({ page }) => {
    const storyId = await createStory(page, "Pre-filled Story");
    await page.reload();
    await page.waitForSelector('[data-testid="project-tree"]');

    await openContextMenu(page, `story-node-${storyId}`, `story-menu-${storyId}`);
    await page.getByRole("menuitem", { name: "Rename" }).click();

    await expect(page.getByLabel("New name")).toHaveValue("Pre-filled Story");
  });

  test("pressing Enter submits and saves the new name", async ({ page }) => {
    const storyId = await createStory(page, "Enter Submit Story");
    await page.reload();
    await page.waitForSelector('[data-testid="project-tree"]');

    await openContextMenu(page, `story-node-${storyId}`, `story-menu-${storyId}`);
    await page.getByRole("menuitem", { name: "Rename" }).click();

    await page.getByLabel("New name").fill("Renamed Via Enter");
    await page.getByLabel("New name").press("Enter");

    // Modal is gone
    await expect(
      page.getByRole("heading", { name: /rename story/i }),
    ).not.toBeVisible({ timeout: 5000 });

    // Sidebar shows the new name
    await expect(
      page.getByTestId(`story-node-${storyId}`),
    ).toHaveAttribute("aria-label", "Renamed Via Enter", { timeout: 8000 });
  });

  test("Rename button is disabled when name is blank", async ({ page }) => {
    const storyId = await createStory(page, "Blank Name Story");
    await page.reload();
    await page.waitForSelector('[data-testid="project-tree"]');

    await openContextMenu(page, `story-node-${storyId}`, `story-menu-${storyId}`);
    await page.getByRole("menuitem", { name: "Rename" }).click();

    await page.getByLabel("New name").clear();

    await expect(page.getByRole("button", { name: "Rename" })).toBeDisabled();
  });

  test("submitting the same name closes the modal without an API call", async ({
    page,
  }) => {
    const storyId = await createStory(page, "Same Name Story");
    await page.reload();
    await page.waitForSelector('[data-testid="project-tree"]');

    let patchCalled = false;
    await page.route(`**/api/stories/${storyId}`, async (route) => {
      if (route.request().method() === "PATCH") patchCalled = true;
      await route.continue();
    });

    await openContextMenu(page, `story-node-${storyId}`, `story-menu-${storyId}`);
    await page.getByRole("menuitem", { name: "Rename" }).click();

    // Input is pre-filled with the current name; click Rename without changing it
    await expect(page.getByLabel("New name")).toHaveValue("Same Name Story");
    await page.getByRole("button", { name: "Rename" }).click();

    // Modal closes without a PATCH request
    await expect(
      page.getByRole("heading", { name: /rename story/i }),
    ).not.toBeVisible({ timeout: 3000 });
    expect(patchCalled).toBe(false);
  });

  test("Save button shows loading state and cannot be clicked twice", async ({
    page,
  }) => {
    const storyId = await createStory(page, "Loading State Story");
    await page.reload();
    await page.waitForSelector('[data-testid="project-tree"]');

    // Slow the PATCH so we can observe the loading state
    await page.route(`**/api/stories/${storyId}`, async (route) => {
      if (route.request().method() === "PATCH") {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({}),
        });
      } else {
        await route.continue();
      }
    });

    await openContextMenu(page, `story-node-${storyId}`, `story-menu-${storyId}`);
    await page.getByRole("menuitem", { name: "Rename" }).click();

    await page.getByLabel("New name").fill("New Loading Name");
    await page.getByRole("button", { name: "Rename" }).click();

    // While the PATCH is in flight the button shows "Saving…" and is disabled
    await expect(page.getByRole("button", { name: /saving/i })).toBeVisible({
      timeout: 3000,
    });
    await expect(page.getByRole("button", { name: /saving/i })).toBeDisabled();

    // After the mock responds the modal is gone
    await expect(
      page.getByRole("heading", { name: /rename story/i }),
    ).not.toBeVisible({ timeout: 5000 });
  });

  test("sidebar AND document header both update after rename", async ({
    page,
  }) => {
    const storyId = await createStory(page, "Header Update Story");
    const docId = await createDocument(page, "Original Doc Name", storyId);

    // Open the document page
    await page.goto(`/dashboard/documents/${docId}`);
    await page.waitForSelector('[data-testid="tiptap-editor"]');

    // Expand the story to expose the document node in the sidebar
    await expandStory(page, storyId);

    // Open the document's rename modal from the sidebar
    await openContextMenu(
      page,
      `document-node-${docId}`,
      `document-menu-${docId}`,
    );
    await page.getByRole("menuitem", { name: "Rename" }).click();

    await page.getByLabel("New name").fill("Renamed Doc Name");
    await page.getByRole("button", { name: "Rename" }).click();

    // Sidebar tree updates
    await expect(
      page.getByTestId(`document-node-${docId}`),
    ).toHaveAttribute("aria-label", "Renamed Doc Name", { timeout: 8000 });

    // Document page header also updates (requires router.refresh() in handleRename)
    await expect(page.locator("h1")).toContainText("Renamed Doc Name", {
      timeout: 8000,
    });
  });
});

// ── Delete Modal ──────────────────────────────────────────────────────────────

test.describe("Delete Modal", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await registerAndLogin(page);
    await page.waitForSelector('[data-testid="project-tree"]');
  });

  test("Universe delete modal warns that children will be orphaned", async ({
    page,
  }) => {
    const univId = await createUniverse(page, "Universe With Children");
    await createSeries(page, "Child Series", univId);

    await page.reload();
    await page.waitForSelector('[data-testid="project-tree"]');

    await openContextMenu(
      page,
      `universe-node-${univId}`,
      `universe-menu-${univId}`,
    );
    await page.getByRole("menuitem", { name: "Delete" }).click();

    await expect(
      page.getByRole("heading", { name: /delete universe/i }),
    ).toBeVisible();
    await expect(
      page.getByText("orphaned, not deleted", { exact: false }),
    ).toBeVisible();
  });

  test("Series delete modal warns that children will be orphaned", async ({
    page,
  }) => {
    const seriesId = await createSeries(page, "Series With Children");
    await createStory(page, "Child Story", { seriesId });

    await page.reload();
    await page.waitForSelector('[data-testid="project-tree"]');

    await page.getByTestId(`series-node-${seriesId}`).hover();
    await page.getByTestId(`series-menu-${seriesId}`).click();
    await page.getByRole("menuitem", { name: "Delete" }).click();

    await expect(
      page.getByRole("heading", { name: /delete series/i }),
    ).toBeVisible();
    await expect(
      page.getByText("orphaned, not deleted", { exact: false }),
    ).toBeVisible();
  });

  test("clicking Cancel closes the modal without deleting", async ({ page }) => {
    const storyId = await createStory(page, "Cancel Delete Story");

    await page.reload();
    await page.waitForSelector('[data-testid="project-tree"]');

    await openContextMenu(
      page,
      `story-node-${storyId}`,
      `story-menu-${storyId}`,
    );
    await page.getByRole("menuitem", { name: "Delete" }).click();

    await expect(
      page.getByRole("heading", { name: /delete story/i }),
    ).toBeVisible();
    // exact: true avoids matching story-node buttons whose aria-label contains "Cancel"
    await page.getByRole("button", { name: "Cancel", exact: true }).click();

    // Modal is gone
    await expect(
      page.getByRole("heading", { name: /delete story/i }),
    ).not.toBeVisible();

    // Story is still in the sidebar
    await expect(
      page.getByTestId(`story-node-${storyId}`),
    ).toBeVisible();
  });

  test("deleting the currently open document redirects to dashboard", async ({
    page,
  }) => {
    const storyId = await createStory(page, "Redirect After Delete Story");
    const docId = await createDocument(page, "Doc To Delete", storyId);

    await page.goto(`/dashboard/documents/${docId}`);
    await page.waitForSelector('[data-testid="tiptap-editor"]');

    // Expand story so the document node is visible in the sidebar
    await expandStory(page, storyId);

    // Delete the document via the sidebar context menu
    await openContextMenu(
      page,
      `document-node-${docId}`,
      `document-menu-${docId}`,
    );
    await page.getByRole("menuitem", { name: "Delete" }).click();

    await expect(
      page.getByRole("heading", { name: /delete document/i }),
    ).toBeVisible();
    // exact: true avoids matching story-node buttons whose aria-label contains "Delete"
    await page.getByRole("button", { name: "Delete", exact: true }).click();

    // Should navigate away from the deleted document's URL
    await expect(page).not.toHaveURL(`**/documents/${docId}`, {
      timeout: 8000,
    });
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 8000 });
  });
});
