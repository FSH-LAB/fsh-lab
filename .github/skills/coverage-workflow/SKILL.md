---
name: coverage-workflow
description: "Use when adding, changing, or debugging test coverage, coverage reports, or CI coverage integration in this pnpm monorepo."
---

# Coverage workflow

Use this workflow for coverage reporting and CI changes. Start by auditing what already exists; do not recreate existing coverage configuration.

## Current repository setup

- Root `pnpm test:coverage` runs Vitest with coverage.
- Root `vitest.config.mts` defines the workspace projects and shared V8 coverage configuration.
- Coverage reporters are text and Cobertura; CI uploads `coverage/cobertura-coverage.xml`.
- `.github/workflows/ci.yml` runs coverage in the `verify` job.
- Apps have their own Vitest projects but no separate `test:coverage` scripts.

Treat these as a snapshot: inspect the current files before relying on them.

## Procedure

1. Identify the requested scope: a new workspace, a single app/package, repo-wide reporting, or a CI/reporting change.
2. Inspect the root and relevant workspace Vitest configs, package scripts, `pnpm-workspace.yaml`, `turbo.json`, and CI workflow before editing.
3. State what is already covered and what gap the request addresses. Preserve the shared root setup where possible; avoid duplicate per-app configuration.
4. Define success before implementation: which projects are included, where reports are written, how CI consumes them, and whether a coverage threshold should fail CI. Do not invent a threshold or make coverage gating stricter unless requested.
5. Make the smallest change that closes the identified gap. Keep coverage reporting separate from unrelated build, lint, and deployment behavior.
6. Verify the root coverage command and confirm the expected report path. Run workflow linting when CI YAML changes. Report commands actually run and any remaining scope or threshold decision.

## Diagnosis before changes

For missing or unexpected coverage, reproduce the behavior and trace it through the Vitest project configuration, included/excluded source patterns, generated report, and CI upload step before editing. Distinguish a collection problem from an upload or display problem.
