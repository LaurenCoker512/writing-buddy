import { test, expect, type APIRequestContext } from "@playwright/test";

const TEST_EMAIL = `e2e-map-${Date.now()}@example.com`;
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

async function createStory(request: APIRequestContext, name: string): Promise<string> {
  const res = await request.post(`${BASE}/api/stories`, {
    data: { name, mode: "ORIGINAL", rating: "G" },
  });
  const body = (await res.json()) as { id: string };
  return body.id;
}

async function createDocument(
  request: APIRequestContext,
  name: string,
  type: string,
  storyId: string,
  meta?: Record<string, unknown>,
): Promise<string> {
  const res = await request.post(`${BASE}/api/documents`, {
    data: { name, type, storyId },
  });
  const body = (await res.json()) as { id: string };
  if (meta) {
    await request.patch(`${BASE}/api/documents/${body.id}`, { data: { meta } });
  }
  return body.id;
}

test.describe("Relationship Map", () => {
  test("renders character nodes and relationship edges for a story", async ({ page }) => {
    await registerAndLogin(page);

    const storyId = await createStory(page.request, "Graph Story");
    const charAId = await createDocument(page.request, "Alice", "CHARACTER", storyId, {
      role: "Protagonist",
    });
    const charBId = await createDocument(page.request, "Bob", "CHARACTER", storyId, {
      role: "Supporting",
    });
    const charCId = await createDocument(page.request, "Carol", "CHARACTER", storyId);

    await createDocument(page.request, "Alice & Bob", "RELATIONSHIP", storyId, {
      characterIds: [charAId, charBId],
      relationshipType: "Family",
    });
    await createDocument(page.request, "Alice & Carol", "RELATIONSHIP", storyId, {
      characterIds: [charAId, charCId],
      relationshipType: "Mentor",
    });

    await page.goto(`/dashboard/stories/${storyId}/map`);
    await expect(page.getByText("Relationship Map")).toBeVisible();

    // 3 nodes and 2 edges should render
    const nodes = page.locator(".react-flow__node");
    await expect(nodes).toHaveCount(3);

    const edges = page.locator(".react-flow__edge");
    await expect(edges).toHaveCount(2);
  });

  test("clicking a character node navigates to that character's document", async ({ page }) => {
    await registerAndLogin(page);

    const storyId = await createStory(page.request, "Nav Story");
    const charId = await createDocument(page.request, "Navigator", "CHARACTER", storyId);

    await page.goto(`/dashboard/stories/${storyId}/map`);
    await expect(page.locator(".react-flow__node")).toHaveCount(1);

    await page.locator(".react-flow__node").first().click();
    await page.waitForURL(`**/dashboard/documents/${charId}`);
    expect(page.url()).toContain(`/dashboard/documents/${charId}`);
  });

  test("scope toggle to Full Universe shows universe-level characters", async ({ page }) => {
    await registerAndLogin(page);

    // Create universe → story
    const uniRes = await page.request.post(`${BASE}/api/universes`, {
      data: { name: "Test Universe", mode: "ORIGINAL", rating: "G" },
    });
    const { id: universeId } = (await uniRes.json()) as { id: string };

    const storyRes = await page.request.post(`${BASE}/api/stories`, {
      data: { name: "Uni Story", mode: "ORIGINAL", rating: "G", universeId },
    });
    const { id: storyId } = (await storyRes.json()) as { id: string };

    // story character
    await createDocument(page.request, "Story Char", "CHARACTER", storyId);
    // universe character
    await createDocument(page.request, "Universe Char", "CHARACTER", universeId);

    await page.goto(`/dashboard/stories/${storyId}/map`);
    // Story scope: 1 node
    await expect(page.locator(".react-flow__node")).toHaveCount(1);

    // Switch to full universe
    await page.getByTestId("scope-universe").click();
    await expect(page.locator(".react-flow__node")).toHaveCount(1); // universe has 1 char
  });
});
