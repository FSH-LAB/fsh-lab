# FSH-LAB

A unified monorepo hosting side projects, learning prototypes, and production applications managed by Fredrik Sundt-Hansen. Built with **pnpm workspaces**, **Turborepo**, **Terraform**, and **GitHub Actions**.

## Applications & Packages

### Applications (`apps/`)

| Application                         | Description                                     | Stack                              | Status     |
| ----------------------------------- | ----------------------------------------------- | ---------------------------------- | ---------- |
| [`helgefolelse`](apps/helgefolelse) | A weekend feeling tracker in `Europe/Oslo` time | Next.js 16, React 19, Tailwind CSS | Production |

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

1. **Scaffold the App**:
   Create a new directory under `apps/<app-name>` with its `package.json` and `Dockerfile`.
2. **Link Shared Configs**:
   Add workspace dependencies in its `package.json`:
   ```json
   {
     "devDependencies": {
       "@repo/eslint-config": "workspace:*",
       "@repo/typescript-config": "workspace:*"
     }
   }
   ```
3. **Provision Infrastructure**:
   In `infra/main.tf`, instantiate the reusable Cloud Run module:
   ```hcl
   module "<app-name>" {
     source         = "./modules/cloud-run-app"
     app            = "<app-name>"
     display_name   = "<Display Name>"
     project_id     = google_project.environment.project_id
     region         = local.region
     deployer_email = google_service_account.deployer.email
   }
   ```
4. **Wire Deployment Pipeline**:
   Add `.github/workflows/deploy-<app-name>.yml` triggering on `apps/<app-name>/**` and invoking `.github/workflows/release-app.yml` with `app: <app-name>`.

## Architecture & CI/CD

- **CI (`.github/workflows/ci.yml`)**: Runs on pull requests and pushes to `main`. Leverages Turborepo affected filtering (`--affected`) on pull requests to only test changed packages and their dependents, keeping verification fast as the monorepo expands.
- **CD (`.github/workflows/deploy-*.yml` -> `release-app.yml`)**: App-scoped pipelines build, scan with Trivy, attest provenance, and deploy container images to Google Cloud Run across `dev` and `production` environments.
- **Candidate Verification**: Deployments roll out to a tagged `--no-traffic` candidate revision first, run automated smoke tests against the candidate URL, and only promote traffic to 100% upon success.
- **Infrastructure (`infra/`)**: Reusable Terraform modules (`infra/modules/cloud-run-app`) deployed via `.github/workflows/infra.yml`. Workload Identity Federation (WIF) eliminates long-lived service account keys.
