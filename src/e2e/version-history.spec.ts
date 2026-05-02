import { test, expect, type APIRequestContext } from "@playwright/test";

const TEST_EMAIL = `e2e-versions-${Date.now()}@example.com`;
const TEST_PASSWORD = "testpassword123";
const BASE = "http://localhost:3000";

async function registerAndLogin(page: import("@playwright/test").Page) {
  await page.request.post(`${BASE}/api/auth/register`, {
    data: { email: TEST_EMAIL, password: TEST_PASSWORD },
  });
  await page.goto("/signin");
  await page.getByLabel(/email/i).fill(TEST_EMAIL);
  await page.getByLabel(/password/i).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL("**/dashboard");
}

async function createStory(request: APIRequestContext): Promise<string> {
  const res = await request.post(`${BASE}/api/stories`, {
    data: { name: "Version Test Story", mode: "ORIGINAL", rating: "G" },
  });
  const body = (await res.json()) as { id: string };
  return body.id;
}

async function createDocument(
  request: APIRequestContext,
  storyId: string,
): Promise<string> {
  const res = await request.post(`${BASE}/api/documents`, {
    data: { name: "Version Test Doc", type: "CHARACTER", storyId },
  });
  const body = (await res.json()) as { id: string };
  return body.id;
}

async function createVersion(
  request: APIRequestContext,
  docId: string,
  content: string,
): Promise<string> {
  const tiptapJson = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text: content }],
      },
    ],
  };
  const res = await request.post(`${BASE}/api/documents/${docId}/versions`, {
    data: { tiptapJson },
  });
  const body = (await res.json()) as { id: string };
  return body.id;
}

test.describe("Version History Panel", () => {
  test.beforeEach(async ({ page }) => {
    await registerAndLogin(page);
  });

  test("version appears in history panel after creation", async ({
    page,
  }) => {
    const storyId = await createStory(page.request);
    const docId = await createDocument(page.request, storyId);
    await createVersion(page.request, docId, "Version one content");

    await page.goto(`/dashboard/documents/${docId}`);
    await page.waitForSelector('[data-testid="tiptap-editor"]');

    await page.getByTestId("version-history-button").click();
    await page.waitForSelector('[data-testid="version-history-panel"]');

    await expect(page.getByText("Saved version")).toBeVisible();
  });

  test("restoring a version reverts document content and adds new history entry", async ({
    page,
  }) => {
    const storyId = await createStory(page.request);
    const docId = await createDocument(page.request, storyId);

    // Create an older version with distinctive content
    await createVersion(page.request, docId, "Original version content");

    // Update the document to newer content
    const newerJson = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Newer content" }],
        },
      ],
    };
    await page.request.patch(`${BASE}/api/documents/${docId}`, {
      data: { tiptapJson: newerJson },
    });

    await page.goto(`/dashboard/documents/${docId}`);
    await page.waitForSelector('[data-testid="tiptap-editor"]');

    await page.getByTestId("version-history-button").click();
    await page.waitForSelector('[data-testid="version-history-panel"]');

    // Select the version (it's already selected by default as first item)
    await page.getByTestId("restore-version-button").click();

    // Wait for restore to complete
    await page.waitForFunction(() => {
      const btn = document.querySelector('[data-testid="restore-version-button"]');
      return btn && !btn.textContent?.includes("Restoring");
    });

    // A new "Restored" entry should appear at the top of history
    await expect(page.getByText("Restored")).toBeVisible();

    // The editor should now show the restored content
    await expect(page.locator('[role="textbox"]')).toContainText(
      "Original version content",
    );
  });
});
