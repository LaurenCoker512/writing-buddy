import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3000";

function makeCredentials(label: string) {
  return {
    email: `e2e-modals-${label}-${Date.now()}@example.com`,
    password: "testpassword123",
  };
}

async function registerAndLogin(page: import("@playwright/test").Page) {
  const { email, password } = makeCredentials("main");
  await page.request.post(`${BASE}/api/auth/register`, {
    data: { email, password },
  });
  await page.goto("/signin");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL("**/dashboard");
}

// ── New Project Modal ─────────────────────────────────────────────────────────

test.describe("New Project Modal", () => {
  test.beforeEach(async ({ page }) => {
    await registerAndLogin(page);
  });

  test("blank name: Create button is disabled", async ({ page }) => {
    await page.getByTestId("new-project-btn").click();
    await expect(page.getByTestId("new-project-modal")).toBeVisible();
    await expect(page.getByRole("button", { name: /^create$/i })).toBeDisabled();
  });

  test("pressing Enter in name field submits the form", async ({ page }) => {
    await page.getByTestId("new-project-btn").click();
    await page.getByLabel(/project name/i).fill("Enter Story");
    await page.getByLabel(/project name/i).press("Enter");
    await page.waitForURL("**/map", { timeout: 10000 });
    expect(page.url()).toContain("/map");
  });

  test("toggling type shows and hides parent dropdowns", async ({ page }) => {
    const univRes = await page.request.post(`${BASE}/api/universes`, {
      data: { name: "Test Universe", mode: "ORIGINAL", rating: "G" },
    });
    const univBody = (await univRes.json()) as { id: string };
    await page.request.post(`${BASE}/api/series`, {
      data: { name: "Test Series", mode: "ORIGINAL", rating: "G", universeId: univBody.id },
    });
    // Suppress unused var warning; id used only to ensure series is created under universe
    void univBody;
    await page.goto("/dashboard");

    await page.getByTestId("new-project-btn").click();
    const modal = page.getByTestId("new-project-modal");

    // Story (default): both universe and series dropdowns visible
    // Labels are not htmlFor-associated, so check by text content
    await expect(modal.getByText("Universe (optional)")).toBeVisible();
    await expect(modal.getByText("Series (optional)")).toBeVisible();

    // Universe type: no parent dropdowns
    await modal.getByRole("button", { name: /^universe$/i }).click();
    await expect(modal.getByText("Universe (optional)")).not.toBeVisible();
    await expect(modal.getByText("Series (optional)")).not.toBeVisible();

    // Series type: only universe dropdown, no series dropdown
    await modal.getByRole("button", { name: /^series$/i }).click();
    await expect(modal.getByText("Universe (optional)")).toBeVisible();
    await expect(modal.getByText("Series (optional)")).not.toBeVisible();
  });

  test("creating a Story navigates to the story map", async ({ page }) => {
    await page.getByTestId("new-project-btn").click();
    await page.getByLabel(/project name/i).fill("My New Story");
    await page.getByRole("button", { name: /^create$/i }).click();
    await page.waitForURL("**/map", { timeout: 10000 });
    expect(page.url()).toMatch(/\/dashboard\/stories\/[^/]+\/map/);
  });

  test("creating a Series under a Universe: series appears in sidebar", async ({ page }) => {
    const univRes = await page.request.post(`${BASE}/api/universes`, {
      data: { name: "Parent Universe", mode: "ORIGINAL", rating: "G" },
    });
    const univBody = (await univRes.json()) as { id: string };
    await page.goto("/dashboard");

    await page.getByTestId("new-project-btn").click();
    const modal = page.getByTestId("new-project-modal");
    await modal.getByRole("button", { name: /^series$/i }).click();
    await modal.getByLabel(/project name/i).fill("Child Series");
    // Labels lack htmlFor — use nth(0) for the only select in the series-type modal
    await modal.locator("select").nth(0).selectOption(univBody.id);
    await modal.getByRole("button", { name: /^create$/i }).click();

    await expect(modal).not.toBeVisible({ timeout: 8000 });
    await expect(page.getByText("Child Series")).toBeVisible();
  });

  test("changing Universe selection resets the Series dropdown", async ({ page }) => {
    const univRes = await page.request.post(`${BASE}/api/universes`, {
      data: { name: "Reset Universe", mode: "ORIGINAL", rating: "G" },
    });
    const univBody = (await univRes.json()) as { id: string };
    await page.request.post(`${BASE}/api/series`, {
      data: { name: "Reset Series", mode: "ORIGINAL", rating: "G", universeId: univBody.id },
    });
    await page.goto("/dashboard");

    await page.getByTestId("new-project-btn").click();
    const modal = page.getByTestId("new-project-modal");

    // Labels lack htmlFor — use nth(0) for universe, nth(1) for series
    const universeSelect = modal.locator("select").nth(0);
    const seriesSelect = modal.locator("select").nth(1);

    // Select a universe and then a series
    await universeSelect.selectOption(univBody.id);
    await seriesSelect.selectOption({ label: "Reset Series" });

    // Deselect the universe — series should reset to "— None —"
    await universeSelect.selectOption("");
    await expect(seriesSelect).toHaveValue("");
  });

  test("creating a Fanfic Universe opens Canon Ingestion Modal", async ({ page }) => {
    await page.getByTestId("new-project-btn").click();
    const modal = page.getByTestId("new-project-modal");
    await modal.getByRole("button", { name: /^universe$/i }).click();
    await modal.getByLabel(/project name/i).fill("Fanfic Universe");
    await modal.getByRole("button", { name: /^fanfic$/i }).click();
    await modal.getByRole("button", { name: /^create$/i }).click();

    await expect(page.getByTestId("canon-ingestion-modal")).toBeVisible({ timeout: 10000 });
  });
});

// ── New Document Modal ────────────────────────────────────────────────────────

test.describe("New Document Modal", () => {
  let storyId: string;

  test.beforeEach(async ({ page }) => {
    await registerAndLogin(page);
    const res = await page.request.post(`${BASE}/api/stories`, {
      data: { name: "Test Story", mode: "ORIGINAL", rating: "G" },
    });
    const body = (await res.json()) as { id: string };
    storyId = body.id;
    await page.goto("/dashboard");
  });

  test("blank name: Create button is disabled", async ({ page }) => {
    await page.getByTestId(`story-node-${storyId}`).hover();
    await page.getByTestId(`story-add-doc-${storyId}`).click();
    await expect(page.getByTestId("new-document-modal")).toBeVisible();
    await expect(page.getByRole("button", { name: /^create$/i })).toBeDisabled();
  });

  test("pressing Enter in name field closes the modal and adds the document", async ({
    page,
  }) => {
    // Expand the story so the document list is visible after creation
    const storyRow = page.getByTestId(`story-node-${storyId}`).locator("..");
    await storyRow.getByLabel("Expand").click();

    await page.getByTestId(`story-node-${storyId}`).hover();
    await page.getByTestId(`story-add-doc-${storyId}`).click();
    await page.getByLabel(/document name/i).fill("Enter Document");
    await page.getByLabel(/document name/i).press("Enter");
    await expect(page.getByTestId("new-document-modal")).not.toBeVisible({ timeout: 8000 });
    await expect(page.getByText("Enter Document")).toBeVisible({ timeout: 8000 });
  });

  test("Story: all 6 document types are shown", async ({ page }) => {
    await page.getByTestId(`story-node-${storyId}`).hover();
    await page.getByTestId(`story-add-doc-${storyId}`).click();
    const modal = page.getByTestId("new-document-modal");
    for (const label of ["Character", "Relationship", "Worldbuilding", "Plot", "Scene", "Other"]) {
      await expect(modal.getByRole("button", { name: new RegExp(`^${label}$`, "i") })).toBeVisible();
    }
  });

  test("Universe: Scene type is absent", async ({ page }) => {
    const univRes = await page.request.post(`${BASE}/api/universes`, {
      data: { name: "Doc Universe", mode: "ORIGINAL", rating: "G" },
    });
    const univBody = (await univRes.json()) as { id: string };
    await page.goto("/dashboard");

    await page.getByTestId(`universe-node-${univBody.id}`).hover();
    await page.getByTestId(`universe-add-doc-${univBody.id}`).click();
    const modal = page.getByTestId("new-document-modal");
    await expect(modal.getByRole("button", { name: /^character$/i })).toBeVisible();
    await expect(modal.getByRole("button", { name: /^scene$/i })).not.toBeVisible();
  });

  test("Fanfic story + CHARACTER: Source Material textarea is visible", async ({ page }) => {
    const fanficRes = await page.request.post(`${BASE}/api/stories`, {
      data: { name: "Fanfic Story", mode: "FANFIC", rating: "G" },
    });
    const fanficBody = (await fanficRes.json()) as { id: string };
    await page.goto("/dashboard");

    await page.getByTestId(`story-node-${fanficBody.id}`).hover();
    await page.getByTestId(`story-add-doc-${fanficBody.id}`).click();
    const modal = page.getByTestId("new-document-modal");
    // CHARACTER is the default type
    await expect(modal.getByLabel(/source material/i)).toBeVisible();
  });

  test("Original story + CHARACTER: Source Material textarea is absent", async ({ page }) => {
    await page.getByTestId(`story-node-${storyId}`).hover();
    await page.getByTestId(`story-add-doc-${storyId}`).click();
    const modal = page.getByTestId("new-document-modal");
    // CHARACTER is the default type; story is ORIGINAL
    await expect(modal.getByLabel(/source material/i)).not.toBeVisible();
  });
});
