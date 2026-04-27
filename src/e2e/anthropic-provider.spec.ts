import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3000";

async function registerAndLogin(page: import("@playwright/test").Page) {
  const email = `e2e-provider-${Date.now()}@example.com`;
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

test.describe("Anthropic API Provider Settings", () => {
  test("settings page shows provider toggle with OpenRouter and Anthropic options", async ({
    page,
  }) => {
    await registerAndLogin(page);
    await page.goto("/settings");

    await expect(page.getByRole("radio", { name: /openrouter/i })).toBeVisible();
    await expect(page.getByRole("radio", { name: /anthropic/i })).toBeVisible();
  });

  test("selecting Anthropic shows sk-ant placeholder and saves key", async ({ page }) => {
    await registerAndLogin(page);
    await page.goto("/settings");

    await page.getByRole("radio", { name: /anthropic/i }).click();

    const input = page.getByLabel(/anthropic api key/i);
    await expect(input).toBeVisible();
    await expect(input).toHaveAttribute("placeholder", /sk-ant/i);

    await input.fill("sk-ant-api03-test-fake-key");
    await page.getByRole("button", { name: /save key/i }).click();

    await expect(page.getByRole("status")).toContainText(/saved/i);
  });

  test("switching back to OpenRouter shows sk-or placeholder", async ({ page }) => {
    await registerAndLogin(page);
    await page.goto("/settings");

    await page.getByRole("radio", { name: /anthropic/i }).click();
    await page.getByRole("radio", { name: /openrouter/i }).click();

    const input = page.getByLabel(/openrouter api key/i);
    await expect(input).toHaveAttribute("placeholder", /sk-or/i);
  });
});
