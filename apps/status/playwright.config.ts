import { defineNextPlaywrightConfig } from "@repo/playwright-config/next";

export default defineNextPlaywrightConfig({
  appName: "status",
  port: 3006,
});
