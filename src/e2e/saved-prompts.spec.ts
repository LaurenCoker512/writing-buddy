import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3000";
const TEST_PASSWORD = "testpassword123";

async function registerAndLogin(page: import("@playwright/test").Page) {
  const email = `e2e-saved-prompts-${Date.now()}@example.com`;
  await page.request.post(`${BASE}/api/auth/register`, {
    data: { email, password: TEST_PASSWORD },
  });
  await page.goto("/signin");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL("**/dashboard");
}

async function createPrompt(
  page: import("@playwright/test").Page,
  content: string,
  mode: "ORIGINAL" | "FANFIC" = "ORIGINAL",
  sourceTitle?: string,
): Promise<string> {
  const res = await page.request.post(`${BASE}/api/saved-prompts`, {
    data: { content, mode, ...(sourceTitle ? { sourceTitle } : {}) },
  });
  const body = (await res.json()) as { id: string };
  return body.id;
}

test.describe("Saved Prompts Library", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await registerAndLogin(page);
  });

  test("empty state visible when no prompts exist", async ({ page }) => {
    await page.goto("/dashboard/prompts");
    await expect(page.getByText("No saved prompts yet.")).toBeVisible();
  });

  test("inline edit: textarea appears pre-filled; saving updates content", async ({ page }) => {
    await createPrompt(page, "Original prompt content");
    await page.goto("/dashboard/prompts");
    await page.waitForSelector('[data-testid="prompt-row"]');

    await page.getByRole("button", { name: "Edit prompt" }).click();

    const textarea = page.getByLabel("Edit prompt content");
    await expect(textarea).toBeVisible();
    await expect(textarea).toHaveValue("Original prompt content");

    await textarea.fill("Updated prompt content");
    await page.getByRole("button", { name: "Save" }).click();

    await expect(page.getByTestId("prompt-row")).toContainText("Updated prompt content", {
      timeout: 5000,
    });
    await expect(page.getByLabel("Edit prompt content")).not.toBeVisible();
  });

  test("inline edit: Cancel restores the original content without saving", async ({ page }) => {
    await createPrompt(page, "Do not change me");
    await page.goto("/dashboard/prompts");
    await page.waitForSelector('[data-testid="prompt-row"]');

    await page.getByRole("button", { name: "Edit prompt" }).click();

    await page.getByLabel("Edit prompt content").fill("Changed content");
    await page.getByRole("button", { name: "Cancel" }).click();

    await expect(page.getByTestId("prompt-row")).toContainText("Do not change me");
    await expect(page.getByLabel("Edit prompt content")).not.toBeVisible();
  });

  test("Delete removes the prompt immediately", async ({ page }) => {
    await createPrompt(page, "To be deleted");
    await page.goto("/dashboard/prompts");
    await page.waitForSelector('[data-testid="prompt-row"]');

    await page.getByRole("button", { name: "Delete prompt" }).click();

    await expect(page.getByTestId("prompt-row")).not.toBeVisible({ timeout: 5000 });
    await expect(page.getByText("No saved prompts yet.")).toBeVisible();
  });

  test("adding a Fanfic prompt shows the Fanfic badge and source title", async ({ page }) => {
    await page.goto("/dashboard/prompts");
    await page.getByTestId("add-prompt-btn").click();

    await page.getByRole("button", { name: "Fanfic", exact: true }).click();
    await page.getByPlaceholder("Source title (optional)").fill("Pride and Prejudice");
    await page.getByLabel("Prompt content").fill("A Fanfic logline about Darcy");

    await page.getByRole("button", { name: "Add Prompt" }).click();

    const promptRow = page.getByTestId("prompt-row");
    await expect(promptRow).toBeVisible({ timeout: 5000 });
    await expect(promptRow).toContainText("Fanfic");
    await expect(promptRow).toContainText("Pride and Prejudice");
  });

  test("blank content is blocked on Add (button disabled)", async ({ page }) => {
    await page.goto("/dashboard/prompts");
    await page.getByTestId("add-prompt-btn").click();

    // Content textarea is empty — Add Prompt button must be disabled
    await expect(page.getByRole("button", { name: "Add Prompt" })).toBeDisabled();
  });

  test("Convert modal requires a name; happy path navigates to a plot document", async ({
    page,
  }) => {
    await createPrompt(page, "An epic adventure story logline");
    await page.goto("/dashboard/prompts");
    await page.waitForSelector('[data-testid="prompt-row"]');

    await page.getByTestId("convert-btn").click();

    const modal = page.getByTestId("convert-modal");
    await expect(modal).toBeVisible();

    // Create Story disabled without a name
    await expect(modal.getByRole("button", { name: "Create Story" })).toBeDisabled();

    // Fill in a name and submit
    await modal.getByPlaceholder("Untitled Story").fill("My Epic Story");
    await expect(modal.getByRole("button", { name: "Create Story" })).toBeEnabled();
    await modal.getByRole("button", { name: "Create Story" }).click();

    // Should navigate to the newly created plot document
    await page.waitForURL("**/dashboard/documents/**", { timeout: 15000 });
  });
});
