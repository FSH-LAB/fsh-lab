import { definePlaywrightConfig } from "./base.js";

/**
 * Playwright configuration tailored for Next.js applications in standalone mode.
 * Standardizes webServer to run against the pre-built standalone server.
 *
 * @param {Object} options
 * @param {string} options.appName Application directory name under apps/
 * @param {number} options.port HTTP port the local standalone server listens on
 * @param {import("@playwright/test").PlaywrightTestConfig} [options.overrides]
 * @returns {import("@playwright/test").PlaywrightTestConfig}
 */
export function defineNextPlaywrightConfig(options) {
  const { appName, port, overrides = {} } = options;
  const baseUrl =
    process.env.PLAYWRIGHT_TEST_BASE_URL || `http://localhost:${port}`;

  const defaultWebServer = process.env.PLAYWRIGHT_TEST_BASE_URL
    ? undefined
    : {
        command: `mkdir -p .next/standalone/apps/${appName}/.next/static && cp -R .next/static/. .next/standalone/apps/${appName}/.next/static/ && if [ -d public ]; then mkdir -p .next/standalone/apps/${appName}/public && cp -R public/. .next/standalone/apps/${appName}/public/; fi && PORT=${port} node .next/standalone/apps/${appName}/server.js`,
        url: baseUrl,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      };

  const { use = {}, webServer, ...restOverrides } = overrides;

  return definePlaywrightConfig({
    use: {
      baseURL: baseUrl,
      ...use,
    },
    webServer: webServer !== undefined ? webServer : defaultWebServer,
    ...restOverrides,
  });
}
