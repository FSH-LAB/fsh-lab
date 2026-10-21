import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: ["apps/*/vitest.config.mts", "packages/*/vitest.config.mts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "cobertura"],
      reportsDirectory: "coverage",
      include: ["apps/*/src/**/*.{ts,tsx}", "packages/*/src/**/*.ts"],
      exclude: [
        "**/*.test.*",
        "**/*.config.*",
        "**/node_modules/**",
        "**/dist/**",
        "**/.next/**",
        "**/e2e/**",
      ],
    },
  },
});
