---
name: add-app
description: >-
  Use this skill when adding a new application to the FSH-LAB monorepo across any
  language, framework, or use case (Web UI, API service, background worker, or static site).
  Guides workspace setup, containerization, operational health contracts,
  candidate smoke testing, Terraform infrastructure, Turborepo bridging, and CI/CD pipelines.
---

# Add App to Monorepo

This skill guides you through adding a new standalone application under `apps/<app>` in the FSH-LAB monorepo.

> [!NOTE]
> Applications in this monorepo can be written in **any programming language or runtime** (Go, Python, Rust, Node.js, Next.js, static site generators, etc.).
> This standard defines the **universal boundary contracts**—infrastructure, containerization, operational health, candidate smoke testing, task orchestration, and CI/CD pipelines—while keeping application domain logic strictly isolated.

---

## 1. Application Archetypes

Every application belongs to an archetype with distinct runtime expectations:

| Archetype                      | Description & Examples             | Health Check (`/api/health`)                  | Candidate Smoke Test Target                     |
| :----------------------------- | :--------------------------------- | :-------------------------------------------- | :---------------------------------------------- |
| **Web Application (UI)**       | Next.js, Remix, Astro, Svelte      | HTTP 200 JSON with status/ready               | `GET /` renders page HTML                       |
| **Backend API / Service**      | Go Chi/Gin, FastAPI, Axum, Fastify | HTTP 200 JSON with status/ready               | `GET /` or `/api` returns JSON descriptor       |
| **Background Worker / Daemon** | Queue processor, event listener    | HTTP 200 JSON via embedded port 8080 listener | `/api/health` asserts loop liveness & readiness |
| **Static Site / SPA**          | Vite, React SPA, Doc site          | HTTP 200 JSON via static server               | `GET /` serves HTML assets                      |

---

## 2. The 7 Universal Platform Contracts

Every application added to `apps/<app>` must adhere to these contracts:

1. **Identity & Naming**:
   - Slug: `^[a-z][a-z0-9-]{1,20}[a-z0-9]$` (3–22 lowercase characters/digits/hyphens).
   - Hard constraint: GCP Service Account character limit requires `<app>-runtime` to be &le; 30 characters.
2. **Container Contract**:
   - Next.js applications build using the shared root `Dockerfile` with `--build-arg APP_NAME=<app>`.
   - Polyglot or custom runtimes provide `apps/<app>/Dockerfile` buildable with monorepo root context.
   - Container must expose and listen on HTTP port `8080` (or respect `$PORT` defaulting to `8080`).
   - Must execute as an unprivileged, non-root user (e.g. UID 65532 / nonroot in distroless, or UID 1000).
   - Must pass container vulnerability scans (`trivy` with zero HIGH/CRITICAL unpatched CVEs).
3. **Operational Health Contract**:
   - Exposes `GET /api/health` returning JSON: `{ "status": "ok", "ready": true, "commit": "<GIT_SHA>", "uptime": <seconds> }`.
   - Reads runtime commit from the `GIT_SHA` environment variable injected by the deploy pipeline.
4. **Candidate Smoke Test Contract**:
   - `apps/<app>/tests/smoke.mjs` verifying candidate revisions using `node --test` in the CI runner before traffic promotion.
   - Receives `SMOKE_URL` and `SHA` environment variables; polls `/api/health` with retry/backoff (up to 60s) until ready, then asserts entrypoint responsiveness.
   - Automatically attaches `Authorization: Bearer <SMOKE_TOKEN>` if `SMOKE_TOKEN` is present, enabling seamless zero-traffic smoke verification for private Cloud Run services (`public: false`).
5. **Infrastructure Contract (Terraform Zero-Touch Discovery)**:
   - Declared via `apps/<app>/infra.json` (specifying `displayName`, `public`, `cpu`, `memory`, `minInstances`, `maxInstances`).
   - Auto-discovered by `infra/main.tf` via `fileset()` and provisioned through `modules/cloud-run-app`.
   - No manual edits to `.tf` files or local `terraform apply` runs required.
6. **Continuous Delivery Contract (GitHub Actions Dynamic Matrix)**:
   - Deployments are fanned out automatically: `.github/workflows/ci.yml` detects affected apps via Turborepo and calls the reusable `.github/workflows/cd.yml` once per app.
   - No per-app workflow files needed.
7. **Task Orchestration (Turborepo & Catalogs)**:
   - Pinned dependencies leverage pnpm catalogs (`"next": "catalog:"`, `"react": "catalog:"`, etc.).
   - `apps/<app>/package.json` exposing scripts: `dev`, `build`, `lint`, `typecheck`, `test`, `test:smoke`.
   - Non-Node runtimes invoke their native toolchains (or clean no-op `node -e 'process.exit(0)'` if not applicable).

---

## 3. Required File Layout & Specifications

When adding a new application `apps/<app>`, create the following directory structure:

```
apps/<app>/
├── infra.json               # Required: Infrastructure metadata for Terraform discovery
├── package.json             # Required: Monorepo workspace package & Turborepo task hooks
├── tests/
│   └── smoke.mjs            # Required: Candidate revision smoke test for CD pipeline
├── src/                     # Application source files
│   └── app/api/health/      # Health check endpoint (for Next.js apps)
└── Dockerfile               # Required ONLY for custom/polyglot runtimes (Next.js uses root Dockerfile)
```

### 3.1 `infra.json`

Every app requires an `apps/<app>/infra.json` file. It is discovered automatically by Terraform in `infra/main.tf`:

```json
{
  "displayName": "My Application",
  "public": true,
  "cpu": "1",
  "memory": "512Mi",
  "minInstances": 0,
  "maxInstances": 2
}
```

Field reference:

- `displayName` (string, required): Human-readable service name.
- `public` (boolean, optional, default: `true`): Whether the Cloud Run service is publicly accessible without authentication.
- `cpu` (string, optional, default: `"1"`): Cloud Run CPU allocation.
- `memory` (string, optional, default: `"512Mi"`): Cloud Run memory limit.
- `minInstances` (number, optional, default: `0`): Minimum warm instances.
- `maxInstances` (number, optional, default: `2`): Maximum instance scaling cap.

### 3.2 `package.json`

Every app must be a valid pnpm workspace package. Reference shared dependencies using pnpm catalogs (`"catalog:"`):

```json
{
  "name": "<app>",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev --port 3002",
    "build": "next build",
    "lint": "eslint",
    "typecheck": "tsc --noEmit",
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
```

_For non-Node / polyglot runtimes_, `package.json` acts as the Turborepo task bridge:

```json
{
  "name": "<app>",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "./scripts/dev.sh",
    "build": "./scripts/build.sh",
    "lint": "./scripts/lint.sh",
    "typecheck": "node -e 'process.exit(0)'",
    "test": "./scripts/test.sh",
    "test:smoke": "node --test tests/smoke.mjs"
  }
}
```

### 3.3 Operational Health Check (`/api/health`)

The health endpoint must return HTTP 200 with JSON matching this structure:

```ts
export function GET() {
  return Response.json({
    status: "ok",
    ready: true,
    commit: process.env.GIT_SHA ?? null,
    uptime: Math.floor(process.uptime()),
  });
}
```

### 3.4 Candidate Smoke Test (`tests/smoke.mjs`)

The CD pipeline runs this script against candidate revisions before switching traffic. It receives `SMOKE_URL` and `SHA`:

```js
import assert from "node:assert/strict";
import test from "node:test";

const smokeUrl = process.env.SMOKE_URL;
const expectedSha = process.env.SHA;
const authToken = process.env.SMOKE_TOKEN || process.env.SMOKE_AUTH_TOKEN;
const headers = authToken ? { Authorization: `Bearer ${authToken}` } : {};

if (!smokeUrl) {
  console.error("SMOKE_URL environment variable is required");
  process.exit(1);
}

const base = smokeUrl.replace(/\/$/, "");

test("candidate revision smoke verification", async () => {
  // 1. Poll /api/health with backoff (up to 60s)
  const healthUrl = `${base}/api/health`;
  const deadline = Date.now() + 60_000;
  let healthy = false;
  let lastError;

  while (Date.now() < deadline) {
    try {
      const res = await fetch(healthUrl, {
        headers,
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const body = await res.json();
        if (body.status === "ok" && body.ready === true) {
          if (!expectedSha || (body.commit ?? body.sha) === expectedSha) {
            healthy = true;
            break;
          }
        }
      }
    } catch (err) {
      lastError = err;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }

  assert.ok(
    healthy,
    `Service failed health check within 60s. Last error: ${lastError}`,
  );

  // 2. Verify root entrypoint
  const entryRes = await fetch(`${base}/`, {
    headers,
    signal: AbortSignal.timeout(5000),
  });
  assert.ok(entryRes.ok, `Entrypoint returned HTTP ${entryRes.status}`);
});
```

---

## 4. Phased Agent Runbook (Step-by-Step Procedure)

### Phase 1: Classification & Naming Assessment

- Identify the app's archetype (Web UI, API service, background worker, or static site).
- Choose an app name conforming to `^[a-z][a-z0-9-]{1,20}[a-z0-9]$` (&le; 22 chars for GCP SA limits).

### Phase 2: Workspace Setup

1. Create directory `apps/<app>`.
2. Create `apps/<app>/infra.json` with desired Cloud Run resource limits.
3. Create `apps/<app>/package.json` linking workspace configs (`@repo/*`) and catalog dependencies.
4. Run `pnpm install` from the repo root to link the workspace package and update `pnpm-lock.yaml`.

### Phase 3: Runtime Implementation & Port Contract

1. Implement application code under `apps/<app>/src`.
2. Implement `GET /api/health` returning JSON `{ status: "ok", ready: true, commit, uptime }`.
3. Containerization:
   - Next.js applications automatically build with the root `Dockerfile` using Google Distroless (`gcr.io/distroless/nodejs24-debian13:nonroot`).
   - Polyglot or custom runtimes provide `apps/<app>/Dockerfile` exposing port `8080` and executing as an unprivileged non-root user.

### Phase 4: Candidate Smoke Test

Create `apps/<app>/tests/smoke.mjs` verifying:

- `/api/health` reports `{ status: "ok", ready: true }` and matches `expectedSha`.
- Root endpoint (`/`) responds with HTTP 200.

### Phase 5: Verification Checklist

Execute the complete verification checklist before committing:

```bash
# 1. Link workspace and update lockfile
pnpm install

# 2. Lint workflow definitions
pnpm lint:workflows

# 3. Validate Terraform infrastructure discovery
terraform -chdir=infra init -backend=false
terraform -chdir=infra validate
terraform -chdir=infra test

# 4. Verify app lifecycle tasks via Turborepo
pnpm turbo run lint typecheck test build --filter=<app>...

# 5. Format check
pnpm format:check
```

### Phase 6: (Optional) Register in Status Dashboard

Add an entry to `MONITORED_SERVICES_CONFIG` in `apps/status/src/lib/services.ts` to include the new application in live uptime monitoring.
