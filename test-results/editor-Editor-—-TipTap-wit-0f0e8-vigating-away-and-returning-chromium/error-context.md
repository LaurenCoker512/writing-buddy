# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: editor.spec.ts >> Editor — TipTap with autosave >> content persists after navigating away and returning
- Location: src/e2e/editor.spec.ts:43:7

# Error details

```
Test timeout of 30000ms exceeded while running "beforeEach" hook.
```

```
Error: page.waitForURL: Test timeout of 30000ms exceeded.
=========================== logs ===========================
waiting for navigation to "**/dashboard" until "load"
============================================================
```

# Page snapshot

```yaml
- generic [ref=e3]:
  - heading "Server error" [level=1] [ref=e4]
  - generic [ref=e6]:
    - paragraph [ref=e7]: There is a problem with the server configuration.
    - paragraph [ref=e8]: Check the server logs for more information.
```

# Test source

```ts
  1  | import { test, expect, type APIRequestContext } from "@playwright/test";
  2  | 
  3  | const TEST_EMAIL = `e2e-editor-${Date.now()}@example.com`;
  4  | const TEST_PASSWORD = "testpassword123";
  5  | const BASE = "http://localhost:3000";
  6  | 
  7  | async function registerAndLogin(page: import("@playwright/test").Page) {
  8  |   await page.request.post(`${BASE}/api/auth/register`, {
  9  |     data: { email: TEST_EMAIL, password: TEST_PASSWORD },
  10 |   });
  11 |   await page.goto("/signin");
  12 |   await page.getByLabel(/email/i).fill(TEST_EMAIL);
  13 |   await page.getByLabel(/password/i).fill(TEST_PASSWORD);
  14 |   await page.getByRole("button", { name: /sign in/i }).click();
> 15 |   await page.waitForURL("**/dashboard");
     |              ^ Error: page.waitForURL: Test timeout of 30000ms exceeded.
  16 | }
  17 | 
  18 | async function createStory(request: APIRequestContext, name: string): Promise<string> {
  19 |   const res = await request.post(`${BASE}/api/stories`, {
  20 |     data: { name, mode: "ORIGINAL", rating: "G" },
  21 |   });
  22 |   const body = (await res.json()) as { id: string };
  23 |   return body.id;
  24 | }
  25 | 
  26 | async function createDocument(
  27 |   request: APIRequestContext,
  28 |   name: string,
  29 |   storyId: string,
  30 | ): Promise<string> {
  31 |   const res = await request.post(`${BASE}/api/documents`, {
  32 |     data: { name, type: "CHARACTER", storyId },
  33 |   });
  34 |   const body = (await res.json()) as { id: string };
  35 |   return body.id;
  36 | }
  37 | 
  38 | test.describe("Editor — TipTap with autosave", () => {
  39 |   test.beforeEach(async ({ page }) => {
  40 |     await registerAndLogin(page);
  41 |   });
  42 | 
  43 |   test("content persists after navigating away and returning", async ({
  44 |     page,
  45 |     request,
  46 |   }) => {
  47 |     const storyId = await createStory(request, "My Story");
  48 |     const docId = await createDocument(request, "Aragorn", storyId);
  49 | 
  50 |     await page.goto(`/dashboard/documents/${docId}`);
  51 |     await page.waitForSelector('[data-testid="tiptap-editor"]');
  52 | 
  53 |     const editor = page.locator('[role="textbox"]');
  54 |     await editor.click();
  55 |     await editor.type("A ranger from the north");
  56 | 
  57 |     // Wait for autosave (2s debounce + buffer)
  58 |     await page.waitForTimeout(3000);
  59 | 
  60 |     // Navigate away and return
  61 |     await page.goto("/dashboard");
  62 |     await page.goto(`/dashboard/documents/${docId}`);
  63 |     await page.waitForSelector('[data-testid="tiptap-editor"]');
  64 | 
  65 |     await expect(page.locator('[role="textbox"]')).toContainText(
  66 |       "A ranger from the north",
  67 |     );
  68 |   });
  69 | });
  70 | 
```