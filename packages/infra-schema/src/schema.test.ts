import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { APP_SLUG_REGEX, validateInfraManifest } from "./schema.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appsDir = path.resolve(__dirname, "../../../apps");

describe("infraSchema validation", () => {
  it("accepts a minimal valid manifest and defaults public to true", () => {
    const minimal = { displayName: "Minimal App" };
    expect(validateInfraManifest(minimal)).toEqual({
      displayName: "Minimal App",
      public: true,
    });
  });

  it("accepts a full valid manifest with all fields", () => {
    const full = {
      displayName: "Full App",
      public: true,
      cpu: "1000m",
      memory: "512Mi",
      minInstances: 0,
      maxInstances: 3,
      env: { KEY: "value" },
      healthPath: "/api/health",
      uptimePeriod: "60s",
      uptimeTimeout: "10s",
    };
    expect(validateInfraManifest(full)).toEqual(full);
  });

  it("rejects an empty displayName", () => {
    expect(() => validateInfraManifest({ displayName: "" })).toThrow();
  });

  it("rejects invalid cpu format", () => {
    expect(() =>
      validateInfraManifest({ displayName: "Test", cpu: "invalid-cpu" }),
    ).toThrow(/cpu must be a valid Cloud Run CPU unit/);
  });

  it("rejects invalid memory format", () => {
    expect(() =>
      validateInfraManifest({ displayName: "Test", memory: "1024MB" }),
    ).toThrow(/memory must be a valid Cloud Run memory unit/);
  });

  it("rejects minInstances > maxInstances", () => {
    expect(() =>
      validateInfraManifest({
        displayName: "Test",
        minInstances: 5,
        maxInstances: 2,
      }),
    ).toThrow(/minInstances must be less than or equal to maxInstances/);
  });

  it("rejects negative minInstances", () => {
    expect(() =>
      validateInfraManifest({
        displayName: "Test",
        minInstances: -1,
      }),
    ).toThrow();
  });
});

describe("monorepo apps/*/infra.json validation", () => {
  const appEntries = fs
    .readdirSync(appsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  it("discovers standard applications in apps/", () => {
    expect(appEntries).toContain("helgefolelse");
    expect(appEntries).toContain("status");
  });

  for (const app of appEntries) {
    const manifestPath = path.join(appsDir, app, "infra.json");

    if (fs.existsSync(manifestPath)) {
      describe(`app manifest: apps/${app}/infra.json`, () => {
        it("has a valid app directory slug matching platform contract", () => {
          expect(app).toMatch(APP_SLUG_REGEX);
        });

        it("satisfies GCP service account 30-character limit for <app>-runtime", () => {
          const saId = `${app}-runtime`;
          expect(saId.length).toBeLessThanOrEqual(30);
        });

        it("validates successfully against infraSchema", () => {
          const raw = fs.readFileSync(manifestPath, "utf-8");
          const parsed = JSON.parse(raw);
          const validated = validateInfraManifest(parsed);
          expect(validated.displayName).toBeDefined();
          expect(validated.displayName.length).toBeGreaterThan(0);
        });
      });
    }
  }
});
