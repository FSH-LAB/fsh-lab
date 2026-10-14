---
name: add-app
description: >-
  Use this skill when adding a new application to the FSH-LAB monorepo across any
  language, framework, or use case (Web UI, API service, background worker, or static site).
  Guides or automates workspace setup, multi-stage containerization, operational health contracts,
  candidate smoke testing, Terraform infrastructure, Turborepo bridging, and CI/CD pipelines.
---

# Add App to Monorepo

This skill guides you through adding a new standalone application under `apps/<app>` in the FSH-LAB monorepo.

> [!NOTE]
> Applications in this monorepo can be written in **any programming language or runtime** (Go, Python, Rust, Node.js, Next.js, static site generators, etc.).
> This standard defines the **universal boundary contracts**—infrastructure, containerization, operational health, candidate smoke testing, task orchestration, and CI/CD pipelines—while keeping application domain logic strictly isolated.

For the in-depth architectural specification, consult [references/app-specification.md](./references/app-specification.md).

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
   - `apps/<app>/Dockerfile` buildable with context set to the monorepo root.
   - Container must expose and listen on HTTP port `8080` (or respect `$PORT` defaulting to `8080`).
   - Must execute as an unprivileged, non-root user (e.g. UID 1000).
   - Must pass container vulnerability scans (`trivy` with zero HIGH/CRITICAL unpatched CVEs).
3. **Operational Health Contract**:
   - Exposes `GET /api/health` returning JSON: `{ "status": "ok", "ready": true, "commit": "<GIT_SHA>", "uptime": <seconds> }`.
   - Reads runtime commit from the `GIT_SHA` environment variable injected by the deploy pipeline.
4. **Candidate Smoke Test Contract**:
   - `apps/<app>/tests/smoke.mjs` verifying candidate revisions using `node --test` in the CI runner before traffic promotion.
   - Receives `SMOKE_URL` and `SHA` environment variables; polls `/api/health` with retry/backoff (up to 60s) until ready, then asserts entrypoint responsiveness.
5. **Infrastructure Contract (Terraform)**:
   - Module instance declared in `infra/main.tf` using `./modules/cloud-run-app`.
   - Service URL registered in `infra/outputs.tf` under `service_urls`.
6. **Continuous Delivery Contract (GitHub Actions)**:
   - Push trigger workflow in `.github/workflows/deploy-<app>.yml` invoking reusable `.github/workflows/release-app.yml`.
   - App listed in `.github/workflows/cd.yml` `workflow_dispatch.inputs.app.options` for rollback/redeploy.
7. **Task Orchestration (Turborepo Bridging)**:
   - `apps/<app>/package.json` exposing scripts: `dev`, `build`, `lint`, `typecheck`, `test`, `test:smoke`.
   - Non-Node runtimes invoke their native toolchains (or clean no-op `node -e 'process.exit(0)'` if not applicable).

---

## 3. Quick Start (Automated Scaffolding)

Use the built-in scaffolding CLI:

```bash
# Default Next.js full-stack app
pnpm scaffold:app <app-name> "[Display Name]"

# Or generic/polyglot starter (runnable zero-dependency baseline)
pnpm scaffold:app <app-name> "[Display Name]" --template minimal
```

Or invoke the script directly:

```bash
node .agents/skills/add-app/scripts/scaffold-app.mjs <app-name> "[Display Name]" [--template <nextjs|minimal>]
```

Supported flags:

- `--template <nextjs|minimal>`: Choose boilerplate style (default: `nextjs`). `minimal` generates a runnable, zero-dependency baseline that satisfies all 7 contracts out of the box.
- `--port <port>`: Explicitly specify local dev port (auto-detects next available integer `3000+` by default).
- `--dry-run`: Preview changes without modifying files.
- `--force`: Overwrite files if directory already exists.

---

## 4. Phased Agent Runbook (Step-by-Step Procedure)

### Phase 1: Classification & Naming Assessment

- Identify the app's archetype (Web UI, API service, background worker, or static site).
- Validate name against `^[a-z][a-z0-9-]{1,20}[a-z0-9]$` (&le; 22 chars for GCP SA limits).

### Phase 2: Automated Scaffolding

- Run `pnpm scaffold:app <app-name> "[Display Name]" --template <nextjs|minimal>` to generate files and wire Terraform + GitHub Actions.
- Run `pnpm install` to link the workspace package and update `pnpm-lock.yaml`.

### Phase 3: Runtime Implementation & Port Contract

- Implement your application logic using your language/framework of choice.
- Implement `GET /api/health` returning JSON: `{ status: "ok", ready: true, commit, uptime }`. Read `GIT_SHA` from environment variables.
- Configure `apps/<app>/Dockerfile`:
  - Ensure build context works from repo root.
  - Expose and listen on port `8080`.
  - Switch to an unprivileged user (UID 1000) before `CMD`.

### Phase 4: Turborepo Task Bridging

Ensure `apps/<app>/package.json` maps standard tasks to your toolchain:

- `dev`: Start local server using assigned port (`--port <port>`).
- `build`: Compile binaries or bundle assets (or `node -e 'process.exit(0)'` if interpreted).
- `lint`: Static analysis or format verification.
- `typecheck`: Type validation (or `node -e 'process.exit(0)'` if statically compiled).
- `test`: Unit and integration test runner.
- `test:smoke`: Invokes `node --test tests/smoke.mjs`.

### Phase 5: Candidate Smoke Test Customization

Inspect `apps/<app>/tests/smoke.mjs`:

- For Web UIs: Ensure root `/` test verifies expected HTML rendering.
- For APIs/Workers: Adjust root `/` test to verify JSON status or API descriptor.

### Phase 6: Verification Gating

Execute the complete verification checklist before committing (see below).

### Phase 7: (Optional) Register in Status Dashboard

Add an entry to `MONITORED_SERVICES_CONFIG` in `apps/status/src/lib/services.ts`.

---

## 5. Verification Checklist

Run these commands in order before committing any new application:

```bash
# 1. Link workspace and update lockfile
pnpm install

# 2. Lint workflow definitions
pnpm lint:workflows

# 3. Validate Terraform infrastructure
terraform -chdir=infra init -backend=false
terraform -chdir=infra validate
terraform -chdir=infra test

# 4. Verify app lifecycle tasks via Turborepo
pnpm turbo run lint typecheck test build --filter=<app>...

# 5. Verify local Docker build and candidate smoke test
docker build -t <app>:verify -f apps/<app>/Dockerfile .
docker run -d --name <app>-verify -p 8080:8080 -e GIT_SHA=0000000000000000000000000000000000000000 <app>:verify
SMOKE_URL=http://localhost:8080 SHA=0000000000000000000000000000000000000000 node --test apps/<app>/tests/smoke.mjs
docker rm -f <app>-verify

# 6. Format check
pnpm format:check
```
