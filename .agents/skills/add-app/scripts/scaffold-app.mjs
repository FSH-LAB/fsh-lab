#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../../../..");

function printHelp() {
  console.log(`
Usage:
  pnpm scaffold:app <app-name> "[display-name]" [options]

Arguments:
  <app-name>              App slug (3-22 lowercase chars/digits/hyphens, e.g. "portal", "api-gateway")
  [display-name]          Human-readable app name (default: title-cased slug, e.g. "Api Gateway")

Options:
  --template <type>       Template type: "nextjs" (default) or "minimal" (polyglot / custom runtime)
  --port <port>           Local dev port (default: auto-detected next available port from 3000+)
  --dry-run               Print actions that would be taken without writing files
  --force                 Overwrite existing files if app directory exists
  --help, -h              Show this help message
`);
}

function titleCase(slug) {
  return slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function parseArgs(args) {
  let appName = "";
  let displayName = "";
  let template = "nextjs";
  let port = null;
  let dryRun = false;
  let force = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg === "--force") {
      force = true;
    } else if (arg === "--template") {
      i++;
      template = args[i]?.toLowerCase() || "nextjs";
      if (template !== "nextjs" && template !== "minimal") {
        console.error(
          `Error: Unsupported template "${template}". Choose "nextjs" or "minimal".`,
        );
        process.exit(1);
      }
    } else if (arg === "--port") {
      i++;
      port = parseInt(args[i], 10);
      if (Number.isNaN(port) || port < 1024 || port > 65535) {
        console.error(
          "Error: --port must be a valid integer between 1024 and 65535.",
        );
        process.exit(1);
      }
    } else if (!appName && !arg.startsWith("-")) {
      appName = arg;
    } else if (!displayName && !arg.startsWith("-")) {
      displayName = arg;
    }
  }

  if (!appName) {
    console.error("Error: <app-name> is required.");
    printHelp();
    process.exit(1);
  }

  const APP_NAME_REGEX = /^[a-z][a-z0-9-]{1,20}[a-z0-9]$/;
  if (!APP_NAME_REGEX.test(appName)) {
    console.error(
      `Error: Invalid app name "${appName}".\nMust match ^[a-z][a-z0-9-]{1,20}[a-z0-9]$ (3-22 lowercase letters, numbers, or hyphens, start with letter, end with letter/digit).\nRationale: GCP Service Account character limits for "<app>-runtime".`,
    );
    process.exit(1);
  }

  if (!displayName) {
    displayName = titleCase(appName);
  }

  return { appName, displayName, template, port, dryRun, force };
}

function detectNextPorts(appsDir) {
  let maxDevPort = 2999;
  let maxE2ePort = 3004;

  if (fs.existsSync(appsDir)) {
    const entries = fs.readdirSync(appsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const pkgPath = path.join(appsDir, entry.name, "package.json");
        if (fs.existsSync(pkgPath)) {
          try {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
            const devScript = pkg.scripts?.dev || "";
            const match = devScript.match(/--port\s+(\d+)/);
            if (match) {
              const p = parseInt(match[1], 10);
              if (p > maxDevPort) maxDevPort = p;
            } else if (devScript.includes("next dev")) {
              if (3000 > maxDevPort) maxDevPort = 3000;
            }
          } catch {
            // ignore
          }
        }

        const playwrightPath = path.join(
          appsDir,
          entry.name,
          "playwright.config.ts",
        );
        if (fs.existsSync(playwrightPath)) {
          const content = fs.readFileSync(playwrightPath, "utf-8");
          const match = content.match(/const\s+PORT\s*=\s*(\d+)/);
          if (match) {
            const p = parseInt(match[1], 10);
            if (p > maxE2ePort) maxE2ePort = p;
          }
        }
      }
    }
  }

  return {
    nextDevPort: maxDevPort + 1,
    nextE2ePort: maxE2ePort + 1,
  };
}

function writeFile(destPath, content, dryRun) {
  if (dryRun) {
    console.log(`[dry-run] Create ${path.relative(REPO_ROOT, destPath)}`);
    return;
  }
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.writeFileSync(destPath, content, "utf-8");
  console.log(`Created ${path.relative(REPO_ROOT, destPath)}`);
}

async function main() {
  const args = process.argv.slice(2);
  const { appName, displayName, template, port, dryRun, force } =
    parseArgs(args);

  const appsDir = path.join(REPO_ROOT, "apps");
  const targetAppDir = path.join(appsDir, appName);

  if (fs.existsSync(targetAppDir) && !force) {
    console.error(
      `Error: Directory already exists at ${path.relative(REPO_ROOT, targetAppDir)}.`,
    );
    console.error("Use --force to overwrite.");
    process.exit(1);
  }

  const portInfo = detectNextPorts(appsDir);
  const devPort = port || portInfo.nextDevPort;
  const e2ePort = portInfo.nextE2ePort;

  console.log(`\nScaffolding new app:`);
  console.log(`  App Name:     ${appName}`);
  console.log(`  Display Name: ${displayName}`);
  console.log(`  Template:     ${template}`);
  console.log(`  Dev Port:     ${devPort}`);
  if (template === "nextjs") {
    console.log(`  E2E Port:     ${e2ePort}`);
  }
  console.log(`  Target Dir:   apps/${appName}\n`);

  const files = {};

  // 1. Universal app files
  files[`apps/${appName}/infra.json`] =
    JSON.stringify(
      {
        displayName,
        public: true,
        cpu: "1000m",
        memory: "512Mi",
        minInstances: 0,
        maxInstances: 3,
      },
      null,
      2,
    ) + "\n";

  files[`apps/${appName}/tests/smoke.mjs`] =
    `import assert from "node:assert/strict";
import test from "node:test";

const smokeUrl = process.env.SMOKE_URL?.replace(/\\/$/, "");
const expectedSha = process.env.SHA;

if (!smokeUrl || !expectedSha) {
  console.error("SMOKE_URL and SHA environment variables are required.");
  process.exit(1);
}

test("${appName} candidate revision responds on health check", async () => {
  const deadline = Date.now() + 60_000;
  let lastError;

  while (Date.now() < deadline) {
    try {
      const res = await fetch(\`\${smokeUrl}/api/health\`);
      if (res.ok) {
        const data = await res.json();
        assert.equal(data.status, "ok");
        assert.equal(data.ready, true);
        assert.equal(data.commit, expectedSha);
        return;
      }
      lastError = new Error(\`Unexpected HTTP status: \${res.status}\`);
    } catch (err) {
      lastError = err;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }

  throw lastError || new Error("Timed out waiting for candidate health check");
});
`;

  if (template === "nextjs") {
    files[`apps/${appName}/package.json`] =
      JSON.stringify(
        {
          name: appName,
          version: "0.1.0",
          private: true,
          scripts: {
            dev: `next dev --port ${devPort}`,
            build: "next build --webpack",
            start: "next start --port 8080",
            lint: "eslint",
            typecheck: "next typegen && tsc --noEmit",
            test: "vitest run",
            "test:e2e": "playwright test",
            "test:smoke": "node --test tests/smoke.mjs",
          },
          dependencies: {
            next: "catalog:",
            react: "catalog:",
            "react-dom": "catalog:",
          },
          devDependencies: {
            "@playwright/test": "catalog:",
            "@repo/eslint-config": "workspace:*",
            "@repo/typescript-config": "workspace:*",
            "@tailwindcss/postcss": "catalog:",
            "@types/node": "catalog:",
            "@types/react": "catalog:",
            "@types/react-dom": "catalog:",
            eslint: "catalog:",
            tailwindcss: "catalog:",
            typescript: "catalog:",
            vitest: "catalog:",
          },
        },
        null,
        2,
      ) + "\n";

    files[`apps/${appName}/tsconfig.json`] =
      JSON.stringify(
        {
          extends: "@repo/typescript-config/nextjs.json",
          compilerOptions: {
            plugins: [{ name: "next" }],
            paths: {
              "@/*": ["./src/*"],
            },
          },
          include: [
            "next-env.d.ts",
            "**/*.ts",
            "**/*.tsx",
            ".next/types/**/*.ts",
          ],
          exclude: ["node_modules"],
        },
        null,
        2,
      ) + "\n";

    files[`apps/${appName}/eslint.config.mjs`] =
      `import nextConfig from "@repo/eslint-config/next";

export default nextConfig;
`;

    files[`apps/${appName}/next.config.ts`] =
      `import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
};

export default nextConfig;
`;

    files[`apps/${appName}/postcss.config.mjs`] = `export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
`;

    files[`apps/${appName}/vitest.config.mts`] =
      `import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
  },
});
`;

    files[`apps/${appName}/playwright.config.ts`] =
      `import { defineConfig, devices } from "@playwright/test";

const PORT = ${e2ePort};
const BASE_URL = \`http://localhost:\${PORT}\`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: \`pnpm start --port \${PORT}\`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
`;

    files[`apps/${appName}/src/app/api/health/route.ts`] =
      `import { NextResponse } from "next/server";

const startTime = Date.now();

export function GET() {
  const commit = process.env.GIT_SHA || "development";
  const uptime = Math.floor((Date.now() - startTime) / 1000);

  return NextResponse.json({
    status: "ok",
    ready: true,
    commit,
    uptime,
    app: "${appName}",
  });
}
`;

    files[`apps/${appName}/src/app/api/health/route.test.ts`] =
      `import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /api/health", () => {
  it("returns operational health status payload", async () => {
    const res = await GET();
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.status).toBe("ok");
    expect(json.ready).toBe(true);
    expect(json.app).toBe("${appName}");
  });
});
`;

    files[`apps/${appName}/src/app/layout.tsx`] =
      `import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "${displayName}",
  description: "${displayName} application on FSH-LAB",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
`;

    files[`apps/${appName}/src/app/page.tsx`] =
      `export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 text-center">
      <h1 className="text-4xl font-bold tracking-tight text-neutral-900">${displayName}</h1>
      <p className="mt-4 text-lg text-neutral-600">
        Deployed to Google Cloud Run via FSH-LAB GitOps automation.
      </p>
    </main>
  );
}
`;

    files[`apps/${appName}/src/app/globals.css`] = `@import "tailwindcss";
`;

    files[`apps/${appName}/README.md`] = `# ${displayName} (\`apps/${appName}\`)

Next.js application within the FSH-LAB monorepo.

## Development

\`\`\`sh
pnpm --filter ${appName} dev
\`\`\`

## Build & Test

\`\`\`sh
pnpm --filter ${appName} build
pnpm --filter ${appName} test
\`\`\`
`;
  } else if (template === "minimal") {
    files[`apps/${appName}/package.json`] =
      JSON.stringify(
        {
          name: appName,
          version: "0.1.0",
          private: true,
          type: "module",
          scripts: {
            dev: `node --watch server.mjs --port ${devPort}`,
            build: "node -e 'process.exit(0)'",
            lint: "node -e 'process.exit(0)'",
            typecheck: "node -e 'process.exit(0)'",
            test: "node --test tests/*.test.mjs",
            "test:smoke": "node --test tests/smoke.mjs",
          },
        },
        null,
        2,
      ) + "\n";

    files[`apps/${appName}/server.mjs`] = `import http from "node:http";

const PORT = parseInt(process.env.PORT || "${devPort}", 10);
const startTime = Date.now();

const server = http.createServer((req, res) => {
  if (req.url === "/api/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        status: "ok",
        ready: true,
        commit: process.env.GIT_SHA || "development",
        uptime: Math.floor((Date.now() - startTime) / 1000),
      }),
    );
    return;
  }

  res.writeHead(200, { "Content-Type": "text/html" });
  res.end("<h1>${displayName}</h1>");
});

server.listen(PORT, () => {
  console.log(\`${appName} listening on port \${PORT}\`);
});
`;

    files[`apps/${appName}/Dockerfile`] = `FROM node:24-slim
WORKDIR /app
COPY package.json server.mjs ./
EXPOSE 8080
USER 1000
CMD ["node", "server.mjs"]
`;

    files[`apps/${appName}/tests/health.test.mjs`] =
      `import assert from "node:assert/strict";
import test from "node:test";

test("sanity check", () => {
  assert.equal(1 + 1, 2);
});
`;

    files[`apps/${appName}/README.md`] = `# ${displayName} (\`apps/${appName}\`)

Application within the FSH-LAB monorepo.
`;
  }

  for (const [relPath, content] of Object.entries(files)) {
    const destPath = path.join(REPO_ROOT, relPath);
    writeFile(destPath, content, dryRun);
  }

  console.log(`\n[Success] App "${appName}" scaffolded successfully!`);
  console.log(`\nZero-Touch GitOps Lifecycle:`);
  console.log(
    `  - Manifest:     apps/${appName}/infra.json created with Cloud Run defaults.`,
  );
  console.log(
    `  - Dependencies: package.json linked with pnpm workspace catalogs.`,
  );
  console.log(
    `  - Dockerfile:   Next.js builds use centralized root Dockerfile.`,
  );
  console.log(`  - Infrastructure: Auto-discovered by Terraform on PR/merge.`);
  console.log(
    `  - Deployments:  Auto-discovered by .github/workflows/deploy.yml matrix on merge.\n`,
  );
  console.log(`Next steps:`);
  console.log(`  1. Run "pnpm install"`);
  console.log(
    `  2. Run "pnpm turbo run lint typecheck test build --filter=${appName}..."`,
  );
  console.log(`  3. Commit and open a PR!\n`);
}

main().catch((err) => {
  console.error("Scaffolding failed:", err);
  process.exit(1);
});
