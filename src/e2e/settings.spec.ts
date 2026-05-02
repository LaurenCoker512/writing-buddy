import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3000";

function makeCredentials(label: string) {
  return {
    email: `e2e-settings-${label}-${Date.now()}@example.com`,
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
  return { email, password };
}

// ── API Key UI ────────────────────────────────────────────────────────────────

test.describe("Settings — API Key UI", () => {
  test.beforeEach(async ({ page }) => {
    await registerAndLogin(page);
    await page.goto("/settings");
  });

  test("saving an OpenRouter key shows confirmation message", async ({
    page,
  }) => {
    await page.getByRole("radio", { name: /openrouter/i }).check();
    await page.getByLabel(/openrouter api key/i).fill("sk-or-test-key-123");
    await page.getByRole("button", { name: /save key/i }).click();
    await expect(
      page.getByRole("status", { name: /key saved/i }).or(page.getByText(/key saved/i)),
    ).toBeVisible();
  });

  test("after saving a key, reloading shows 'A key is currently configured'", async ({
    page,
  }) => {
    await page.getByRole("radio", { name: /openrouter/i }).check();
    await page.getByLabel(/openrouter api key/i).fill("sk-or-test-key-456");
    await page.getByRole("button", { name: /save key/i }).click();
    await expect(page.getByText(/key saved/i)).toBeVisible();

    await page.reload();
    await expect(
      page.getByText(/a key is currently configured/i),
    ).toBeVisible();
  });

  test("updating an existing key shows 'Key updated.'", async ({ page }) => {
    // Save first key
    await page.getByRole("radio", { name: /openrouter/i }).check();
    await page.getByLabel(/openrouter api key/i).fill("sk-or-first-key");
    await page.getByRole("button", { name: /save key/i }).click();
    await expect(page.getByText(/key saved/i)).toBeVisible();

    // Reload so the form sees a configured key, then update
    await page.reload();
    await page.getByLabel(/openrouter api key/i).fill("sk-or-second-key");
    await page.getByRole("button", { name: /update key/i }).click();
    await expect(page.getByText(/key updated/i)).toBeVisible();
  });

  test("submitting an empty key shows an error and does not crash", async ({
    page,
  }) => {
    // The input has `required` — the browser blocks submission, so we trigger
    // it via the API directly to verify the server also rejects it.
    const response = await page.request.patch(`${BASE}/api/settings/api-key`, {
      data: { apiKey: "", provider: "OPENROUTER" },
    });
    expect(response.status()).toBe(400);
  });

  test("switching to Anthropic hides OpenRouter UI and shows model selector", async ({
    page,
  }) => {
    await page.getByRole("radio", { name: /openrouter/i }).check();
    await expect(page.getByText(/model/i).first()).not.toBeVisible();

    await page.getByRole("radio", { name: /anthropic/i }).check();
    await expect(page.getByText(/model/i).first()).toBeVisible();
    await expect(page.getByRole("radio", { name: /haiku/i })).toBeVisible();
  });

  test("switching to OpenRouter hides model selector", async ({ page }) => {
    // Start on Anthropic
    await page.getByRole("radio", { name: /anthropic/i }).check();
    await expect(page.getByRole("radio", { name: /haiku/i })).toBeVisible();

    // Switch back
    await page.getByRole("radio", { name: /openrouter/i }).check();
    await expect(page.getByRole("radio", { name: /haiku/i })).not.toBeVisible();
  });

  test("saving a model selection shows 'Model updated.'", async ({ page }) => {
    await page.getByRole("radio", { name: /anthropic/i }).check();
    await page.getByRole("radio", { name: /sonnet/i }).check();
    await expect(page.getByText(/model updated/i)).toBeVisible();
  });

  test("blocked PATCH for model shows 'Failed to update model.'", async ({
    page,
  }) => {
    await page.getByRole("radio", { name: /anthropic/i }).check();

    await page.route("**/api/settings/anthropic-model", (route) =>
      route.fulfill({ status: 500, body: "error" }),
    );

    await page.getByRole("radio", { name: /sonnet/i }).check();
    await expect(page.getByText(/failed to update model/i)).toBeVisible();
  });
});

// ── Account Deletion UI ───────────────────────────────────────────────────────

test.describe("Settings — Account Deletion UI", () => {
  test("clicking 'Delete account' then 'Cancel' closes panel; account not deleted", async ({
    page,
  }) => {
    await registerAndLogin(page);
    await page.goto("/settings");

    await page.getByRole("button", { name: /delete account/i }).click();
    await expect(
      page.getByText(/permanently delete your account/i),
    ).toBeVisible();

    await page.getByRole("button", { name: /cancel/i }).click();
    await expect(
      page.getByText(/permanently delete your account/i),
    ).not.toBeVisible();

    // Verify we're still signed in (settings page still accessible)
    await expect(page.getByRole("heading", { name: /settings/i })).toBeVisible();
  });

  test("confirming deletion signs out and redirects to /signin", async ({
    page,
  }) => {
    await registerAndLogin(page);
    await page.goto("/settings");

    await page.getByRole("button", { name: /delete account/i }).click();
    await page.getByRole("button", { name: /yes, delete my account/i }).click();
    await page.waitForURL("**/signin");
    expect(page.url()).toContain("/signin");
  });

  test("after deletion, signing in with old credentials fails", async ({
    page,
  }) => {
    const { email, password } = makeCredentials("delete-verify");
    await page.request.post(`${BASE}/api/auth/register`, {
      data: { email, password },
    });

    // Sign in and delete the account
    await page.goto("/signin");
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill(password);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL("**/dashboard");

    await page.goto("/settings");
    await page.getByRole("button", { name: /delete account/i }).click();
    await page.getByRole("button", { name: /yes, delete my account/i }).click();
    await page.waitForURL("**/signin");

    // Try to sign in again
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill(password);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(
      page.getByText(/invalid email or password/i),
    ).toBeVisible();
  });
});
