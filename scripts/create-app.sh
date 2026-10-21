#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Scaffold a new Application in FSH-LAB monorepo
#
# Adheres to the 7 universal platform contracts:
# 1. Identity & Naming (slug regex <= 22 chars)
# 2. Container Contract (builds with root Dockerfile)
# 3. Operational Health Contract (/api/health)
# 4. Candidate Smoke Test Contract (tests/smoke.mjs)
# 5. Infrastructure Contract (apps/<app>/infra.json)
# 6. Continuous Delivery Contract (auto-detected by Turborepo matrix)
# 7. Task Orchestration (linked via pnpm catalogs & @repo/*)
# ==============================================================================

APP_NAME="${1:-}"
DISPLAY_NAME="${2:-$APP_NAME}"

if [[ -z "$APP_NAME" ]]; then
  echo "Usage: $0 <app-slug> [displayName]" >&2
  echo "Example: $0 analytics 'Platform Analytics'" >&2
  exit 1
fi

# Validate app slug: 3-22 lowercase alphanumeric + hyphens
if [[ ! "$APP_NAME" =~ ^[a-z][a-z0-9-]{1,20}[a-z0-9]$ ]]; then
  echo "Error: App name '$APP_NAME' must match ^[a-z][a-z0-9-]{1,20}[a-z0-9]$ (3-22 chars, lowercase, hyphens allowed, cannot end in hyphen)." >&2
  exit 1
fi

# Validate display name: non-empty, max 50 chars, no line breaks
if [[ -z "${DISPLAY_NAME// }" ]]; then
  echo "Error: Display name cannot be empty or whitespace only." >&2
  exit 1
fi

if [[ ${#DISPLAY_NAME} -gt 50 ]]; then
  echo "Error: Display name exceeds 50 characters." >&2
  exit 1
fi

if [[ "$DISPLAY_NAME" =~ [$'\r'$'\n'] ]]; then
  echo "Error: Display name cannot contain line breaks." >&2
  exit 1
fi

# Safely serialize display name to JSON to prevent JSON, TypeScript string, or JSX injection
DISPLAY_JSON=$(node -e 'process.stdout.write(JSON.stringify(process.argv[1]))' "$DISPLAY_NAME")

APP_DIR="apps/$APP_NAME"
if [[ -d "$APP_DIR" ]]; then
  echo "Error: Directory '$APP_DIR' already exists." >&2
  exit 1
fi

echo "==> Scaffolding new application: $APP_NAME ($DISPLAY_NAME)..."
mkdir -p "$APP_DIR/src/app/api/health"
mkdir -p "$APP_DIR/tests"

# 1. infra.json
cat > "$APP_DIR/infra.json" <<EOF
{
  "displayName": $DISPLAY_JSON,
  "public": true,
  "cpu": "1000m",
  "memory": "512Mi",
  "minInstances": 0,
  "maxInstances": 2
}
EOF

# 2. package.json
cat > "$APP_DIR/package.json" <<EOF
{
  "name": "$APP_NAME",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build --webpack",
    "start": "next start",
    "lint": "eslint",
    "typecheck": "next typegen && tsc --noEmit",
    "test": "vitest run",
    "test:smoke": "node --test tests/smoke.mjs"
  },
  "dependencies": {
    "next": "catalog:",
    "react": "catalog:",
    "react-dom": "catalog:"
  },
  "devDependencies": {
    "@repo/eslint-config": "workspace:*",
    "@repo/typescript-config": "workspace:*",
    "@types/node": "catalog:",
    "@types/react": "catalog:",
    "@types/react-dom": "catalog:",
    "eslint": "catalog:",
    "typescript": "catalog:",
    "vitest": "catalog:"
  }
}
EOF

# 3. next.config.ts
cat > "$APP_DIR/next.config.ts" <<EOF
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
};

export default nextConfig;
EOF

# 4. tsconfig.json
cat > "$APP_DIR/tsconfig.json" <<EOF
{
  "extends": "@repo/typescript-config/nextjs.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts",
    ".next/dev/types/**/*.ts",
    "**/*.mts"
  ],
  "exclude": ["node_modules"]
}
EOF

# 5. eslint.config.mjs
cat > "$APP_DIR/eslint.config.mjs" <<EOF
import { nextConfig } from "@repo/eslint-config/next";

export default nextConfig;
EOF

# 6. vitest.config.mts
cat > "$APP_DIR/vitest.config.mts" <<EOF
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    exclude: ["**/node_modules/**", "**/dist/**", "**/e2e/**"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
EOF

# 7. Operational Health Contract: /api/health
cat > "$APP_DIR/src/app/api/health/route.ts" <<EOF
export function GET() {
  return Response.json({
    status: "ok",
    ready: true,
    commit: process.env.GIT_SHA ?? null,
    uptime: Math.floor(process.uptime()),
  });
}
EOF

cat > "$APP_DIR/src/app/api/health/route.test.ts" <<'EOF'
import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("health API route", () => {
  it("returns ok status and readiness", async () => {
    const response = GET();
    const data = await response.json();

    expect(data.status).toBe("ok");
    expect(data.ready).toBe(true);
    expect(typeof data.uptime).toBe("number");
  });
});
EOF

# 8. src/app/layout.tsx
cat > "$APP_DIR/src/app/layout.tsx" <<EOF
import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

const appTitle = $DISPLAY_JSON;

export const metadata: Metadata = {
  title: appTitle,
  description: \`\${appTitle} application in FSH-LAB.\`,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
EOF

# 9. src/app/page.tsx
cat > "$APP_DIR/src/app/page.tsx" <<EOF
const appTitle = $DISPLAY_JSON;

export default function Page() {
  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>{appTitle}</h1>
      <p>Application is healthy and running.</p>
    </main>
  );
}
EOF

# 10. src/app/globals.css
cat > "$APP_DIR/src/app/globals.css" <<EOF
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}
EOF

# 11. Candidate Smoke Test: tests/smoke.mjs
cat > "$APP_DIR/tests/smoke.mjs" <<EOF
import assert from "node:assert/strict";
import { setTimeout } from "node:timers/promises";
import { test } from "node:test";

const baseUrl = process.env.SMOKE_URL;
const commit = process.env.SHA;
const authToken = process.env.SMOKE_TOKEN || process.env.SMOKE_AUTH_TOKEN;
const headers = authToken ? { Authorization: \`Bearer \${authToken}\` } : {};

assert.ok(baseUrl, "SMOKE_URL must point to a running app");
assert.match(commit ?? "", /^[0-9a-f]{40}\$/, "SHA must be a full commit SHA");

async function request(path) {
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await fetch(new URL(path, baseUrl), {
        headers,
        signal: AbortSignal.timeout(5_000),
      });
      assert.equal(response.status, 200, \`\${path} must return HTTP 200\`);
      return await response.text();
    } catch (error) {
      if (attempt === 10) throw error;
      await setTimeout(2_000);
    }
  }
}

test(
  "health reports the deployed commit and readiness",
  { timeout: 90_000 },
  async () => {
    const data = JSON.parse(await request("/api/health"));
    assert.equal(data.status, "ok");
    assert.equal(data.commit ?? data.sha, commit);
    assert.equal(data.ready, true);
  },
);

test("home page renders", { timeout: 90_000 }, async () => {
  const html = await request("/");
  const expectedTitle = $DISPLAY_JSON;
  assert.ok(html.includes(expectedTitle), "Home page should contain display name");
});
EOF

# 12. .gitignore
cat > "$APP_DIR/.gitignore" <<EOF
.next
node_modules
.turbo
next-env.d.ts
EOF

echo "==> Application '$APP_NAME' created at '$APP_DIR'!"
echo "==> Running pnpm install to link workspace dependencies..."
pnpm install

echo ""
echo "SUCCESS: '$APP_NAME' is fully configured and ready!"
echo "To develop locally: pnpm turbo run dev --filter=$APP_NAME"
echo "When pushed to main, Terraform and CI/CD will automatically deploy it."
