import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3000";

async function registerAndLogin(page: import("@playwright/test").Page) {
  const email = `e2e-contradiction-${Date.now()}@example.com`;
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

test.describe("Contradiction Checker", () => {
  test("story context menu triggers token estimate modal, confirm runs check, results appear", async ({
    page,
  }) => {
    await registerAndLogin(page);

    await page.getByRole("button", { name: /new project/i }).click();
    await page.waitForSelector('[data-testid="new-project-modal"]');
    await page.getByLabel("Project name").fill("Contradiction Test Story");
    await page.getByRole("button", { name: /^create$/i }).click();
    await page.waitForSelector('[data-testid^="story-node-"]');

    await page.locator('[data-testid^="story-menu-"]').first().click();
    await page.waitForSelector('[data-testid="context-menu"]');
    await page.getByRole("menuitem", { name: /check for contradictions/i }).click();

    await page.waitForSelector('[data-testid="contradiction-checker-modal"]');
    await page.waitForSelector('[data-testid="contradiction-confirm-button"]');

    await expect(page.locator('[data-testid="contradiction-checker-modal"]')).toBeVisible();

    await page.locator('[data-testid="contradiction-confirm-button"]').click();

    await page.waitForSelector(
      '[data-testid="contradiction-no-issues"],[data-testid="contradiction-issues-list"]',
    );
    await expect(
      page
        .locator('[data-testid="contradiction-no-issues"]')
        .or(page.locator('[data-testid="contradiction-issues-list"]')),
    ).toBeVisible();
  });
});
