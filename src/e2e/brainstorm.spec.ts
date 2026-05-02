import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3000";
const TEST_PASSWORD = "testpassword123";

async function registerAndLogin(page: import("@playwright/test").Page) {
  const email = `e2e-brainstorm-${Date.now()}@example.com`;
  await page.request.post(`${BASE}/api/auth/register`, {
    data: { email, password: TEST_PASSWORD },
  });
  await page.goto("/signin");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL("**/dashboard");
}

const MOCK_LOGLINES = [
  "A lone wolf detective in a cyberpunk city must solve the murder of an AI.",
  "A princess discovers her fairy godmother is actually a rogue algorithm.",
  "Two rival time travelers accidentally create the same paradox.",
  "A marine biologist discovers mermaids are running an underwater corporation.",
  "An aging superhero opens a retirement home for former villains.",
];

test.describe("Brainstorm page", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await registerAndLogin(page);
  });

  test("5 logline cards appear after clicking Generate", async ({ page }) => {
    await page.route("**/api/brainstorm", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ loglines: MOCK_LOGLINES }),
      });
    });

    await page.goto("/dashboard/brainstorm");
    await page.getByTestId("generate-btn").click();

    await expect(page.getByTestId("logline-card")).toHaveCount(5, { timeout: 10000 });
  });

  test("'Regenerate' on one card replaces only that card", async ({ page }) => {
    let callCount = 0;
    await page.route("**/api/brainstorm", async (route) => {
      callCount++;
      const loglines = callCount === 1 ? MOCK_LOGLINES : ["Replacement logline only."];
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ loglines }),
      });
    });

    await page.goto("/dashboard/brainstorm");
    await page.getByTestId("generate-btn").click();
    await expect(page.getByTestId("logline-card")).toHaveCount(5, { timeout: 10000 });

    const firstCard = page.getByTestId("logline-card").first();
    await firstCard.getByLabel("Regenerate this logline").click();

    // Wait for replacement text to appear on that card
    await expect(firstCard.locator("p")).toContainText("Replacement logline only.", {
      timeout: 10000,
    });

    // Still 5 cards total
    await expect(page.getByTestId("logline-card")).toHaveCount(5);

    // Other cards retain their original text
    await expect(page.getByTestId("logline-card").nth(1).locator("p")).toHaveText(
      MOCK_LOGLINES[1]!,
    );
  });

  test("'Discard' removes only that card", async ({ page }) => {
    await page.route("**/api/brainstorm", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ loglines: MOCK_LOGLINES }),
      });
    });

    await page.goto("/dashboard/brainstorm");
    await page.getByTestId("generate-btn").click();
    await expect(page.getByTestId("logline-card")).toHaveCount(5, { timeout: 10000 });

    const firstCard = page.getByTestId("logline-card").first();
    const discardedText = await firstCard.locator("p").innerText();
    await firstCard.getByTestId("discard-btn").click();

    await expect(page.getByTestId("logline-card")).toHaveCount(4);
    await expect(page.getByTestId("logline-list")).not.toContainText(discardedText);
    // Remaining cards still present
    await expect(page.getByTestId("logline-card").nth(0).locator("p")).toHaveText(
      MOCK_LOGLINES[1]!,
    );
  });

  test("'Save to Library' turns green/disabled; logline appears on /dashboard/prompts", async ({
    page,
  }) => {
    await page.route("**/api/brainstorm", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ loglines: MOCK_LOGLINES }),
      });
    });

    await page.goto("/dashboard/brainstorm");
    await page.getByTestId("generate-btn").click();
    await expect(page.getByTestId("logline-card")).toHaveCount(5, { timeout: 10000 });

    const firstCard = page.getByTestId("logline-card").first();
    const savedText = await firstCard.locator("p").innerText();

    await firstCard.getByRole("button", { name: "Save to Library" }).click();

    // Button transitions to "Saved" state and is disabled
    await expect(firstCard.getByRole("button", { name: "Saved" })).toBeVisible({
      timeout: 5000,
    });
    await expect(firstCard.getByRole("button", { name: "Saved" })).toBeDisabled();

    // Navigate to prompts library and verify the prompt appears
    await page.goto("/dashboard/prompts");
    await expect(page.getByTestId("prompt-list")).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId("prompt-list")).toContainText(savedText);
  });

  test("error banner appears when the network request fails", async ({ page }) => {
    await page.route("**/api/brainstorm", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ message: "Server error" }),
      });
    });

    await page.goto("/dashboard/brainstorm");
    await page.getByTestId("generate-btn").click();

    await expect(page.getByRole("alert")).toBeVisible({ timeout: 10000 });
  });
});
