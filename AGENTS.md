# Agent Guide

Monorepo managed with **pnpm** workspaces and **Turborepo**, hosting independent applications, shared packages, and cloud infrastructure.

## Repository Layout

- `apps/*` — Standalone applications and services. Each application is independently deployable and isolated:
  - `apps/helgefolelse` — Next.js web application.
  - `apps/status` — Next.js system status and uptime monitoring dashboard.
- `packages/*` — Shared internal libraries, tooling, and configurations (`@repo/*` namespace):
  - `packages/typescript-config` — Shared TypeScript configurations (`@repo/typescript-config`).
  - `packages/eslint-config` — Shared ESLint configurations (`@repo/eslint-config`).
- `infra/*` — Terraform infrastructure declarations, environments (`dev`, `production`), and policies.
- `.github/*` — CI/CD workflows, reusable deployment pipelines, and repository automation.

## Core Principles & Workspace Boundaries

- **Application Isolation**: Applications in `apps/*` must not import code directly from sibling applications. Reusable logic or configurations must be extracted to a shared package under `packages/*`.
- **Domain Independence**: Keep application-specific domain logic local to that application. Shared packages under `packages/*` must remain generic and decoupled from individual app requirements.
- **Dependency Hygiene**:
  - Use `pnpm` exclusively. Never introduce `package-lock.json` or `yarn.lock`.
  - Always link workspace packages using `workspace:*` (for example, `"@repo/typescript-config": "workspace:*"`).
  - Keep `pnpm-lock.yaml` synchronized when modifying dependency manifests.
- **Decoupled Infrastructure**: Routine application deployments (`.github/workflows/cd.yml`) handle container rollouts, smoke verification, and traffic promotion. Infrastructure and IAM changes are managed strictly via dedicated infrastructure pipelines (`.github/workflows/infra.yml`).

## Commands (Repo Root)

- **Install**: `pnpm install`
- **Development**: `pnpm dev`
- **Build**: `pnpm build`
- **Testing**: `pnpm test` (unit/integration) / `pnpm test:e2e` (end-to-end)
- **Quality & Linting**: `pnpm lint` / `pnpm typecheck` / `pnpm format:check` / `pnpm lint:workflows`
- **Format**: `pnpm format`
- **Adding Apps**: Follow the specification and boundary contracts in `.agents/skills/add-app/SKILL.md` to add new applications adhering to monorepo infra & CI/CD standards.
- **Scoped Execution**:
  - Run task for a specific app or package:
    `pnpm turbo run <task> --filter=<target>` (e.g. `pnpm turbo run test --filter=helgefolelse`)
  - Run task for a target and its dependencies:
    `pnpm turbo run <task> --filter=<target>...`

## Engineering Standards

- **Verification**: Run affected tests, linting, and typechecks before committing changes.
- **Commit Messages**: Follow Conventional Commits format (`type(scope): description`, e.g. `feat(helgefolelse): ...`, `fix(infra): ...`, `chore(deps): ...`).
- **Health Checks**: Web applications and services exposing HTTP endpoints should provide a readiness and operational health check (e.g., `/api/health`) for container orchestrators and deployment smoke tests.

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
