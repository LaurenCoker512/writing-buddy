import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3000";

async function registerAndLogin(page: import("@playwright/test").Page) {
  const email = `e2e-rating-${Date.now()}@example.com`;
  const password = "testpassword123";
  await page.request.post(`${BASE}/api/auth/register`, {
    data: { email, password },
  });
  await page.goto("/signin");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL("**/dashboard");
}

test.describe("Content Rating & Explicit Unlock", () => {
  test("first E-rating attempt shows age gate; after confirmation, project is created", async ({
    page,
  }) => {
    await registerAndLogin(page);

    await page.getByRole("button", { name: /new project/i }).click();
    await page.waitForSelector('[data-testid="new-project-modal"]');

    await page.getByLabel("Project name").fill("Adult Story");
    await page.getByRole("button", { name: /^E$/ }).click();

    await page.waitForSelector('[data-testid="age-gate-modal"]');
    await expect(page.locator('[data-testid="age-gate-modal"]')).toBeVisible();

    await page.getByRole("button", { name: /i am 18\+/i }).click();
    await expect(page.locator('[data-testid="age-gate-modal"]')).not.toBeVisible();

    await page.getByRole("button", { name: /^create$/i }).click();
    await page.waitForSelector('[data-testid^="universe-node-"],[data-testid^="series-node-"],[data-testid^="story-node-"]');
    await expect(page.locator('text=Adult Story')).toBeVisible();
  });

  test("second E-rating project shows no age gate", async ({ page }) => {
    await registerAndLogin(page);

    await page.request.patch(`${BASE}/api/account/explicit-enable`);

    await page.goto("/dashboard");
    await page.getByRole("button", { name: /new project/i }).click();
    await page.waitForSelector('[data-testid="new-project-modal"]');

    await page.getByLabel("Project name").fill("Second Adult Story");
    await page.getByRole("button", { name: /^E$/ }).click();

    await expect(page.locator('[data-testid="age-gate-modal"]')).not.toBeVisible();
  });
});
