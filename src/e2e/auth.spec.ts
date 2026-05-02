import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3000";

function makeCredentials(label: string) {
  return {
    email: `e2e-auth-${label}-${Date.now()}@example.com`,
    password: "testpassword123",
  };
}

async function register(
  page: import("@playwright/test").Page,
  email: string,
  password: string,
) {
  await page.request.post(`${BASE}/api/auth/register`, {
    data: { email, password },
  });
}

async function loginViaUI(
  page: import("@playwright/test").Page,
  email: string,
  password: string,
) {
  await page.goto("/signin");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL("**/dashboard");
}

test.describe("Auth — sign-out redirect", () => {
  test("sign-out redirects to /signin", async ({ page }) => {
    const { email, password } = makeCredentials("signout");
    await register(page, email, password);
    await loginViaUI(page, email, password);

    await page.getByRole("button", { name: /sign out/i }).click();
    await page.waitForURL("**/signin");
    expect(page.url()).toContain("/signin");
  });

  test("after sign-out, /dashboard redirects to /signin", async ({ page }) => {
    const { email, password } = makeCredentials("post-signout");
    await register(page, email, password);
    await loginViaUI(page, email, password);

    await page.getByRole("button", { name: /sign out/i }).click();
    await page.waitForURL("**/signin");

    await page.goto("/dashboard");
    await page.waitForURL("**/signin");
    expect(page.url()).toContain("/signin");
  });
});

test.describe("Auth — unauthenticated route guards", () => {
  test("/dashboard while signed out redirects to /signin", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForURL("**/signin");
    expect(page.url()).toContain("/signin");
  });

  test("/settings while signed out redirects to /signin", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForURL("**/signin");
    expect(page.url()).toContain("/signin");
  });
});
