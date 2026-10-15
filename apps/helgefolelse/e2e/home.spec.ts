import { test, expect } from "@playwright/test";

test.describe("Home page", () => {
  test("renders helgefølelse with tide visualisation", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto("/");

    // Document title
    await expect(page).toHaveTitle(/helgefølelse/);

    // Header wordmark
    await expect(page.getByRole("heading", { name: "helgefølelse" })).toBeVisible();

    // The tide visualization scene & SVG
    const scene = page.locator("#app");
    await expect(scene).toBeVisible();

    const sea = page.locator("#ocean-svg");
    await expect(sea).toBeVisible();

    // Readout percentage displays
    const readout = page.locator(".readout--air");
    await expect(readout).toBeVisible();
    await expect(readout).toContainText("%");

    // Verify no unhandled client console errors
    expect(consoleErrors).toEqual([]);
  });

  test("health check endpoint returns status ok", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.status).toBe("ok");
    expect(data).toHaveProperty("ready");
    expect(data.ready).toBe(true);
  });
});
