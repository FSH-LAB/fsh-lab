# FSH-LAB

A unified monorepo hosting side projects, learning prototypes, and production applications managed by Fredrik Sundt-Hansen. Built with **pnpm workspaces**, **Turborepo**, **Terraform**, and **GitHub Actions**.

## Applications & Packages

### Applications (`apps/`)

| Application                         | Description                                                      | Stack                              | Status     |
| ----------------------------------- | ---------------------------------------------------------------- | ---------------------------------- | ---------- |
| [`helgefolelse`](apps/helgefolelse) | A weekend feeling tracker in `Europe/Oslo` time                  | Next.js 16, React 19, Tailwind CSS | Production |
| [`status`](apps/status)             | Real-time system status, uptime monitoring, and incident history | Next.js 16, React 19, Tailwind CSS | Production |

### Shared Packages (`packages/`)

| Package                   | Purpose                                               |
| ------------------------- | ----------------------------------------------------- |
| `@repo/eslint-config`     | Shared ESLint configurations across apps and packages |
| `@repo/typescript-config` | Standardized TypeScript configurations                |

## Getting Started

Install Node.js 24 or newer and enable pnpm through Corepack. The repository pins the pnpm version in `package.json`.

```sh
corepack enable pnpm
pnpm install
pnpm dev
```

Run commands from the repository root unless noted otherwise.

## Common Commands

| Command               | Purpose                                       |
| --------------------- | --------------------------------------------- |
| `pnpm dev`            | Start development servers across all apps     |
| `pnpm build`          | Build all applications and packages           |
| `pnpm lint`           | Run ESLint across workspace                   |
| `pnpm typecheck`      | Run TypeScript checks across workspace        |
| `pnpm test`           | Run unit tests across workspace               |
| `pnpm format:check`   | Verify code formatting for CI                 |
| `pnpm format`         | Auto-format supported files with Prettier     |
| `pnpm lint:workflows` | Lint GitHub Actions workflows with actionlint |

### Scoped Execution

Target a specific application or package using Turborepo filters:

```sh
# Run dev for a single app
pnpm --filter helgefolelse dev

# Run tests for a single app
pnpm --filter helgefolelse test

# Run smoke test against a running local container
SMOKE_URL=http://localhost:8080 SHA="$(git rev-parse HEAD)" pnpm --filter helgefolelse test:smoke
```

## Adding a New Application

Adding a new application is powered by zero-touch GitOps discovery:

1. **Create the Application Directory**:
   Create `apps/<name>` containing `infra.json`, `package.json`, `/api/health`, and `tests/smoke.mjs` (see [`.agents/skills/add-app/SKILL.md`](.agents/skills/add-app/SKILL.md) for the universal boundary contracts and runbook).

2. **Open a Pull Request**:
   - `ci.yml` lints, typechecks, tests, and builds changed packages via Turborepo, validates Terraform, audits workflows, and builds + smoke-tests images of affected apps. Branch protection only requires the aggregate `CI` check.

3. **Merge to `main`**:
   - After `CI` passes, the same run calls `infra.yml` (dev, then production) if `infra/` or an `infra.json` changed, provisioning the Cloud Run service shell.
   - It then calls `cd.yml` once per affected app, which publishes the container (root `Dockerfile`, `gcr.io/distroless/nodejs24-debian13:nonroot`), runs candidate revision smoke tests, and promotes traffic in dev and then production.

No manual `.tf` edits, per-app workflows, or operator pre-apply steps are required.

## Architecture & CI/CD

- **CI (`.github/workflows/ci.yml`)**: The single pipeline entry point. Parallel verify jobs (code, workflows, infrastructure, images) feed one `CI` gate; on `main` it continues into infrastructure apply and per-app delivery. Uses Turborepo affected detection, so new apps need no workflow changes.
- **CD (`.github/workflows/cd.yml` -> `.github/actions/build-image`, `.github/actions/cloud-run-rollout`)**: Reusable per-app delivery: builds a minimal Distroless image with BuildKit caching, scans with Trivy, attests provenance, and deploys to Google Cloud Run in `dev` then `production`. Each app runs independently and deliveries are serialized per app. Use `rollback.yml` to redeploy an earlier release.
- **Candidate Verification**: Deployments roll out to a tagged `--no-traffic` candidate revision first, run automated smoke tests against the candidate URL, and only promote traffic to 100% upon success.
- **Infrastructure (`infra/`)**: Reusable Terraform modules (`infra/modules/cloud-run-app`) with auto-discovery of `apps/*/infra.json` manifests deployed via `.github/workflows/infra.yml`. Workload Identity Federation (WIF) eliminates long-lived service account keys.
