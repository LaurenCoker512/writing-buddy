import { test, expect, type APIRequestContext } from "@playwright/test";

const TEST_EMAIL = `e2e-scene-order-${Date.now()}@example.com`;
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
    data: { name: "Test Story", mode: "ORIGINAL", rating: "G" },
  });
  const body = (await res.json()) as { id: string };
  return body.id;
}

async function createScene(
  request: APIRequestContext,
  name: string,
  storyId: string,
): Promise<string> {
  const res = await request.post(`${BASE}/api/documents`, {
    data: { name, type: "SCENE", storyId },
  });
  const body = (await res.json()) as { id: string };
  return body.id;
}

test.describe("Scene Ordering", () => {
  test("drag Scene 3 above Scene 1; verify sidebar order updates", async ({ page }) => {
    await registerAndLogin(page);

    const storyId = await createStory(page.request);
    await createScene(page.request, "Scene 1", storyId);
    await createScene(page.request, "Scene 2", storyId);
    await createScene(page.request, "Scene 3", storyId);

    await page.reload();

    // Expand the story so document nodes render in the sidebar
    const storyRow = page.getByTestId(`story-node-${storyId}`).locator("..");
    await storyRow.getByLabel("Expand").click();
    await page.waitForSelector('[data-testid^="document-node-"]');

    // Find all scene items in the sidebar under the Scenes section
    const sceneItems = page.locator('text=Scene 1, text=Scene 2, text=Scene 3');

    // Verify initial order: Scene 1 before Scene 3
    const scene1 = page.getByText("Scene 1").first();
    const scene3 = page.getByText("Scene 3").first();

    const scene1Box = await scene1.boundingBox();
    const scene3Box = await scene3.boundingBox();

    expect(scene1Box).not.toBeNull();
    expect(scene3Box).not.toBeNull();

    if (scene1Box && scene3Box) {
      expect(scene1Box.y).toBeLessThan(scene3Box.y);
    }

    // Drag Scene 3 drag handle to above Scene 1
    // Find the grip handle for Scene 3 (it's in the same group as the scene text)
    const scene3Row = page.locator('li').filter({ hasText: 'Scene 3' }).first();
    const scene1Row = page.locator('li').filter({ hasText: 'Scene 1' }).first();

    await scene3Row.hover();
    const gripHandle = scene3Row.getByLabel(/Drag to reorder Scene 3/i);
    const scene1RowBox = await scene1Row.boundingBox();
    const gripBox = await gripHandle.boundingBox();

    if (scene1RowBox && gripBox) {
      await page.mouse.move(gripBox.x + gripBox.width / 2, gripBox.y + gripBox.height / 2);
      await page.mouse.down();
      await page.mouse.move(
        scene1RowBox.x + scene1RowBox.width / 2,
        scene1RowBox.y - 5,
        { steps: 10 },
      );
      await page.mouse.up();
    }

    // After drag, Scene 3 should appear above Scene 1
    await page.waitForTimeout(200);

    const scene1After = page.getByText("Scene 1").first();
    const scene3After = page.getByText("Scene 3").first();

    const scene1BoxAfter = await scene1After.boundingBox();
    const scene3BoxAfter = await scene3After.boundingBox();

    if (scene1BoxAfter && scene3BoxAfter) {
      expect(scene3BoxAfter.y).toBeLessThan(scene1BoxAfter.y);
    }

    void sceneItems;
  });
});
