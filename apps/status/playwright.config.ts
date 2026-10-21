import { defineNextPlaywrightConfig } from "@repo/playwright-config/next";

export default defineNextPlaywrightConfig({
  appName: "status",
  port: 3006,
  env: {
    HELGEFOLELSE_HEALTH_URL: "http://localhost:3006/api/health",
  },
});
