import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3000";
const TEST_PASSWORD = "testpassword123";

function makeEmail(label: string) {
  return `e2e-chat-${label}-${Date.now()}@example.com`;
}

async function registerAndLogin(page: import("@playwright/test").Page) {
  const email = makeEmail("main");
  await page.request.post(`${BASE}/api/auth/register`, {
    data: { email, password: TEST_PASSWORD },
  });
  await page.goto("/signin");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL("**/dashboard");
}

async function createDocument(
  page: import("@playwright/test").Page,
): Promise<string> {
  const storyRes = await page.request.post(`${BASE}/api/stories`, {
    data: { name: "Chat Test Story", mode: "ORIGINAL", rating: "G" },
  });
  const { id: storyId } = (await storyRes.json()) as { id: string };
  const docRes = await page.request.post(`${BASE}/api/documents`, {
    data: { name: "Chat Test Doc", type: "CHARACTER", storyId },
  });
  const { id: docId } = (await docRes.json()) as { id: string };
  return docId;
}

function makeSseBody(text: string): string {
  return [
    `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}`,
    "data: [DONE]",
    "",
  ].join("\n");
}

async function mockChatRoute(
  page: import("@playwright/test").Page,
  text = "Hello from AI!",
  delayMs = 0,
) {
  await page.route("**/api/ai/chat", async (route) => {
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    await route.fulfill({
      status: 200,
      contentType: "text/event-stream",
      body: makeSseBody(text),
    });
  });
}

async function mockDiffRoute(
  page: import("@playwright/test").Page,
  proposals: object[],
) {
  await page.route("**/api/ai/diff", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ proposals }),
    });
  });
}

async function mockMessagesRoute(
  page: import("@playwright/test").Page,
  docId: string,
  messages: Array<{ id: string; role: string; content: string }> = [],
  chatSummary: string | null = null,
) {
  await page.route(`**/api/documents/${docId}/messages`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ messages, chatSummary }),
    });
  });
}

async function openDocument(
  page: import("@playwright/test").Page,
  docId: string,
) {
  await page.goto(`/dashboard/documents/${docId}`);
  await page.waitForSelector('[data-testid="tiptap-editor"]');
}

test.describe("AI Chat Panel UI", () => {
  test.beforeEach(async ({ page }) => {
    await registerAndLogin(page);
  });

  test("user message is right-aligned; assistant response is left-aligned", async ({
    page,
  }) => {
    const docId = await createDocument(page);
    await mockChatRoute(page, "Assistant reply here.");
    await openDocument(page, docId);

    await page.getByLabel("Chat message input").fill("User question here.");
    await page.getByLabel("Send message").click();

    // User bubble container uses justify-end; assistant uses justify-start
    const userBubble = page
      .locator('[class*="justify-end"]')
      .filter({ hasText: "User question here." });
    await expect(userBubble).toBeVisible({ timeout: 5000 });

    const assistantBubble = page
      .locator('[class*="justify-start"]')
      .filter({ hasText: "Assistant reply here." });
    await expect(assistantBubble).toBeVisible({ timeout: 5000 });
  });

  test("streaming shows a blinking cursor, then resolves with content", async ({
    page,
  }) => {
    const docId = await createDocument(page);
    // 1.5 s delay so we can observe the cursor before content arrives
    await mockChatRoute(page, "Streamed content.", 1500);
    await openDocument(page, docId);

    await page.getByLabel("Chat message input").fill("Stream test");
    await page.getByLabel("Send message").click();

    // Cursor visible while response is pending
    await expect(page.getByLabel("Loading response")).toBeVisible({
      timeout: 3000,
    });

    // After the mock responds, cursor is gone and content appears
    await expect(page.getByLabel("Loading response")).not.toBeVisible({
      timeout: 5000,
    });
    await expect(page.getByText("Streamed content.")).toBeVisible();
  });

  test("Shift+Enter inserts a newline and does not send", async ({ page }) => {
    const docId = await createDocument(page);
    let requestMade = false;
    await page.route("**/api/ai/chat", (route) => {
      requestMade = true;
      void route.continue();
    });
    await openDocument(page, docId);

    const input = page.getByLabel("Chat message input");
    await input.fill("Line one");
    await input.press("Shift+Enter");

    // Input still has content (not cleared on send)
    await expect(input).toHaveValue(/Line one/);
    expect(requestMade).toBe(false);
  });

  test("input and Send button are disabled while response is streaming", async ({
    page,
  }) => {
    const docId = await createDocument(page);
    await mockChatRoute(page, "Done.", 1500);
    await openDocument(page, docId);

    await page.getByLabel("Chat message input").fill("Disable check");
    await page.getByLabel("Send message").click();

    // During streaming the cursor is visible — input should be disabled
    await expect(page.getByLabel("Loading response")).toBeVisible({
      timeout: 3000,
    });
    await expect(page.getByLabel("Chat message input")).toBeDisabled();
    await expect(page.getByLabel("Send message")).toBeDisabled();

    // After streaming completes, controls re-enable
    await expect(page.getByLabel("Chat message input")).not.toBeDisabled({
      timeout: 5000,
    });
  });

  test("hovering an assistant message shows trash icon; clicking it removes the message", async ({
    page,
  }) => {
    const docId = await createDocument(page);
    await mockMessagesRoute(page, docId, [
      { id: "msg-a-1", role: "assistant", content: "Stored assistant reply" },
    ]);
    await page.route(`**/api/documents/${docId}/messages/msg-a-1`, (route) =>
      route.fulfill({ status: 200, body: "{}" }),
    );
    await openDocument(page, docId);

    await expect(page.getByText("Stored assistant reply")).toBeVisible();

    // Hover the group container to trigger group-hover:visible on the trash button
    const assistantContainer = page
      .locator(".group")
      .filter({ hasText: "Stored assistant reply" });
    await assistantContainer.hover();

    // The button is in the DOM (visibility: hidden by default); click with force
    // to bypass the CSS-controlled visibility state in the headless test browser
    const deleteBtn = assistantContainer.getByLabel("Delete message");
    await expect(deleteBtn).toHaveCount(1);
    await deleteBtn.click({ force: true });

    await expect(page.getByText("Stored assistant reply")).not.toBeVisible({
      timeout: 3000,
    });
  });

  test("with no API key (402), shows 'No API key configured' banner with Settings link", async ({
    page,
  }) => {
    const docId = await createDocument(page);
    await page.route("**/api/ai/chat", (route) =>
      route.fulfill({ status: 402, body: "{}" }),
    );
    await openDocument(page, docId);

    await page.getByLabel("Chat message input").fill("Test message");
    await page.getByLabel("Send message").click();

    await expect(
      page.getByText("No API key configured", { exact: false }),
    ).toBeVisible({ timeout: 5000 });
    await expect(
      page.getByRole("link", { name: /OpenRouter API key in Settings/i }),
    ).toBeVisible();
  });

  test("blocking /api/ai/chat shows 'Something went wrong'", async ({
    page,
  }) => {
    const docId = await createDocument(page);
    await page.route("**/api/ai/chat", (route) =>
      route.fulfill({ status: 500, body: "{}" }),
    );
    await openDocument(page, docId);

    await page.getByLabel("Chat message input").fill("This will fail");
    await page.getByLabel("Send message").click();

    await expect(
      page.getByText("Something went wrong", { exact: false }),
    ).toBeVisible({ timeout: 5000 });
  });

  test("pasting 10,001 characters is rejected with 'Something went wrong'", async ({
    page,
  }) => {
    const docId = await createDocument(page);
    await openDocument(page, docId);

    const longInput = "a".repeat(10_001);
    await page.getByLabel("Chat message input").fill(longInput);
    await page.getByLabel("Send message").click();

    // Server returns 400 for content > 10,000 chars → component shows error
    await expect(
      page.getByText("Something went wrong", { exact: false }),
    ).toBeVisible({ timeout: 8000 });
  });

  test("switching to Edit mode and submitting shows DiffCard proposals", async ({
    page,
  }) => {
    const docId = await createDocument(page);
    await mockDiffRoute(page, [
      {
        id: "p-chat-1",
        heading: "Introduction",
        headingLevel: 2,
        beforeMarkdown: "Old text.",
        newMarkdown: "New text from chat edit.",
        isNew: false,
      },
    ]);
    await openDocument(page, docId);

    await page.getByRole("button", { name: "Edit" }).click();
    await page.getByLabel("Edit instruction input").fill("Improve the intro");
    await page.getByLabel("Request edit").click();

    await expect(
      page.getByRole("region", { name: /Proposed edit:/i }),
    ).toBeVisible({ timeout: 8000 });
  });

  test("switching back to Chat mode keeps conversation history intact", async ({
    page,
  }) => {
    const docId = await createDocument(page);
    await mockMessagesRoute(page, docId, [
      { id: "msg-u-2", role: "user", content: "Original user message" },
      { id: "msg-a-2", role: "assistant", content: "Original AI response" },
    ]);
    await openDocument(page, docId);

    // History is visible in Chat mode
    await expect(page.getByText("Original user message")).toBeVisible();
    await expect(page.getByText("Original AI response")).toBeVisible();

    // Switch to Edit mode
    await page.getByRole("button", { name: "Edit" }).click();

    // History still visible in Edit mode
    await expect(page.getByText("Original user message")).toBeVisible();
    await expect(page.getByText("Original AI response")).toBeVisible();

    // Switch back to Chat mode (exact: true avoids matching sidebar project buttons)
    await page.getByRole("button", { name: "Chat", exact: true }).click();

    // History persists
    await expect(page.getByText("Original user message")).toBeVisible();
    await expect(page.getByText("Original AI response")).toBeVisible();
  });

  test('"No edit proposals were generated" shown when AI returns empty proposals', async ({
    page,
  }) => {
    const docId = await createDocument(page);
    await mockDiffRoute(page, []);
    await openDocument(page, docId);

    await page.getByRole("button", { name: "Edit" }).click();
    await page.getByLabel("Edit instruction input").fill("Do something");
    await page.getByLabel("Request edit").click();

    await expect(
      page.getByText("No edit proposals were generated", { exact: false }),
    ).toBeVisible({ timeout: 8000 });
  });

  test("chat summary banner is visible when chatSummary is set", async ({
    page,
  }) => {
    const docId = await createDocument(page);
    await mockMessagesRoute(
      page,
      docId,
      [{ id: "msg-a-3", role: "assistant", content: "Summarized reply" }],
      "This is the chat summary.",
    );
    await openDocument(page, docId);

    await expect(
      page.getByText("Earlier conversation has been summarized.", {
        exact: false,
      }),
    ).toBeVisible({ timeout: 5000 });
  });
});
