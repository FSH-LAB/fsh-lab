import { expect, test } from "@playwright/test";

test.describe("Status page", () => {
  test("renders status dashboard with operational hero banner and services", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    await page.goto("/");

    // Document title
    await expect(page).toHaveTitle(/FSH Lab System Status/);

    // Hero banner headline
    await expect(page.locator("h1")).toContainText(/Operational/i);

    // Services section
    await expect(page.locator("h2")).toContainText("Services & Applications");

    // Helgefølelse service card
    await expect(page.getByText("Helgefølelse")).toBeVisible();

    // Verify no unhandled client console errors
    expect(consoleErrors).toEqual([]);
  });

  test("opens and closes subscribe dialog with keyboard", async ({ page }) => {
    await page.goto("/");

    const subscribeBtn = page.getByRole("button", {
      name: /Subscribe to Updates/i,
    });
    await subscribeBtn.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Close via Escape key
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
  });

  test("health check endpoint returns status ok", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.status).toBe("ok");
    expect(data.ready).toBe(true);
  });
});
