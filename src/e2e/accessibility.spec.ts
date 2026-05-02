import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3000";
const TEST_PASSWORD = "testpassword123";

async function registerAndLogin(page: import("@playwright/test").Page) {
  const email = `e2e-a11y-${Date.now()}@example.com`;
  await page.request.post(`${BASE}/api/auth/register`, {
    data: { email, password: TEST_PASSWORD },
  });
  await page.goto("/signin");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL("**/dashboard");
}

// ── Authenticated accessibility tests ─────────────────────────────────────────

test.describe("Accessibility — modal and sidebar", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await registerAndLogin(page);
  });

  test("Tab through New Project modal: all inputs and buttons reachable without mouse", async ({
    page,
  }) => {
    await page.goto("/dashboard");
    await page.waitForSelector('[data-testid="project-tree"]');

    await page.getByRole("button", { name: "New project" }).click();
    await expect(page.getByTestId("new-project-modal")).toBeVisible();

    // autoFocus lands on the name input
    await expect(page.getByLabel("Project name")).toBeFocused({ timeout: 2000 });

    // Tab forward through mode buttons, rating buttons, Cancel
    // DOM order after name input: Original → Fanfic → G → T → M → E → Cancel
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Original" })).toBeFocused();

    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Fanfic" })).toBeFocused();

    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "G", exact: true })).toBeFocused();

    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab"); // T → M → E
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Cancel" })).toBeFocused();

    // Focus trap: Tab from last enabled element wraps to first (type buttons) — NOT outside
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "universe" })).toBeFocused();

    // Continue through the type buttons back to the name input
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "series" })).toBeFocused();

    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "story" })).toBeFocused();

    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Project name")).toBeFocused();
  });

  test("+ and ... sidebar buttons are keyboard-focusable and become visible on focus", async ({
    page,
  }) => {
    const res = await page.request.post(`${BASE}/api/stories`, {
      data: { name: "A11y Story", mode: "ORIGINAL", rating: "G" },
    });
    const { id: storyId } = (await res.json()) as { id: string };

    await page.goto("/dashboard");
    await page.waitForSelector('[data-testid="project-tree"]');

    // Before any focus: buttons are visually hidden (computed opacity: 0)
    await expect(page.getByTestId(`story-add-doc-${storyId}`)).toHaveCSS("opacity", "0");
    await expect(page.getByTestId(`story-menu-${storyId}`)).toHaveCSS("opacity", "0");

    // Tab from the story name button reaches the + (add-doc) button
    await page.getByTestId(`story-node-${storyId}`).focus();
    await page.keyboard.press("Tab");

    await expect(page.getByTestId(`story-add-doc-${storyId}`)).toBeFocused();
    // focus:opacity-100 makes it visible when keyboard-focused
    await expect(page.getByTestId(`story-add-doc-${storyId}`)).toHaveCSS("opacity", "1");

    // Tab again reaches the ... (menu) button
    await page.keyboard.press("Tab");

    await expect(page.getByTestId(`story-menu-${storyId}`)).toBeFocused();
    await expect(page.getByTestId(`story-menu-${storyId}`)).toHaveCSS("opacity", "1");
  });

  test("Focus stays within an open modal (no tab escape to background)", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForSelector('[data-testid="project-tree"]');

    await page.getByRole("button", { name: "New project" }).click();
    await expect(page.getByTestId("new-project-modal")).toBeVisible();
    await expect(page.getByLabel("Project name")).toBeFocused({ timeout: 2000 });

    // Tab through all 7 elements after name input to reach Cancel
    for (let i = 0; i < 7; i++) {
      await page.keyboard.press("Tab");
    }
    await expect(page.getByRole("button", { name: "Cancel" })).toBeFocused();

    // One more Tab — focus trap wraps to first element inside the modal, not to the browser chrome
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "universe" })).toBeFocused();

    // Confirm that focused element is a descendant of the modal panel
    await expect(page.getByTestId("new-project-modal").locator(":focus")).toBeAttached();
  });

  test("Pressing Escape closes any open modal", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForSelector('[data-testid="project-tree"]');

    await page.getByRole("button", { name: "New project" }).click();
    await expect(page.getByTestId("new-project-modal")).toBeVisible();

    await page.keyboard.press("Escape");

    await expect(page.getByTestId("new-project-modal")).not.toBeVisible();
  });

  test("Icon-only sidebar buttons have aria-label attributes", async ({ page }) => {
    await page.goto("/dashboard");
    await page.waitForSelector('[data-testid="project-tree"]');

    // Collapse/expand toggle is always icon-only; verify it has an aria-label
    const collapseBtn = page.getByRole("button", { name: /collapse sidebar/i });
    await expect(collapseBtn).toBeVisible();
    await expect(collapseBtn).toHaveAttribute("aria-label");

    // Collapse to icon-only mode — New Project button loses its text label
    await collapseBtn.click();

    // New Project button is now icon-only; aria-label must still be present
    const newProjectBtn = page.getByRole("button", { name: "New project" });
    await expect(newProjectBtn).toBeVisible();
    await expect(newProjectBtn).toHaveAttribute("aria-label", "New project");

    // The toggle now shows "Expand sidebar" and has an aria-label
    await expect(
      page.getByRole("button", { name: /expand sidebar/i }),
    ).toHaveAttribute("aria-label");
  });
});

// ── Sign-in form validation (no auth required) ────────────────────────────────

test.describe("Accessibility — form validation errors", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test("Sign-in validation errors appear adjacent to their field", async ({ page }) => {
    await page.goto("/signin");

    // Submit with empty fields to trigger per-field validation
    await page.getByRole("button", { name: /sign in/i }).click();

    // Email error is adjacent to the email input
    await expect(page.locator("#email-error")).toBeVisible();
    await expect(page.locator("#email-error")).toContainText("Email is required");
    // Input links to the error via aria-describedby
    await expect(page.locator("#email")).toHaveAttribute("aria-describedby", "email-error");

    // Password error is adjacent to the password input
    await expect(page.locator("#password-error")).toBeVisible();
    await expect(page.locator("#password-error")).toContainText("Password is required");
    await expect(page.locator("#password")).toHaveAttribute("aria-describedby", "password-error");
  });
});
