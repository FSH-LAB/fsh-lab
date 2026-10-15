import { defineConfig, devices } from "@playwright/test";

/**
 * Standard base Playwright configuration for fsh-lab monorepo apps.
 * Provides sensible defaults for CI retries, parallel execution, chromium project,
 * trace on failure, and list reporting.
 *
 * @param {import("@playwright/test").PlaywrightTestConfig} [customConfig]
 * @returns {import("@playwright/test").PlaywrightTestConfig}
 */
export function definePlaywrightConfig(customConfig = {}) {
  const { use = {}, projects, ...rest } = customConfig;

  return defineConfig({
    testDir: "./e2e",
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: "list",
    use: {
      trace: "on-first-retry",
      ...use,
    },
    projects: projects ?? [
      {
        name: "chromium",
        use: { ...devices["Desktop Chrome"] },
      },
    ],
    ...rest,
  });
}

