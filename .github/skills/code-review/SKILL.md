---
name: code-review
description: "Review pull requests across the monorepo to find actionable bugs, regressions, security risks, boundary violations, and test coverage gaps across applications, shared packages, and infrastructure."
---

# Code review

Review the pull request diff against the base branch. Read nearby callers, types, and tests when needed to establish whether a change introduces defects or breaks contracts. Follow the repository's `AGENTS.md` guidelines and report only issues introduced by the pull request, not pre-existing problems or speculative stylistic preferences.

## Review Checklist

1. **Correctness, Boundaries & Domain Logic**:
   - Check changed logic and callers for incorrect outputs, off-by-one errors, unhandled edge cases, missing error boundaries, and asynchronous lifecycle leaks (e.g., timers, observers, event listeners).
   - Enforce workspace boundaries: applications under `apps/*` must not import sibling applications directly; shared logic belongs in `packages/*` and must remain generic.
   - For UI changes, verify client-server hydration safety, state initialization, accessibility, and responsive layouts.

2. **Security & Supply Chain**:
   - In CI/CD workflows (`.github/workflows/`), verify least-privilege token permissions, action pinning by full commit SHA, input sanitization against script injection, and verifiable build provenance.
   - In container configurations (`Dockerfile`), check for multi-stage pruning, non-root execution, minimal attack surface, and pinned base digests.
   - In Infrastructure (`infra/`), verify resource protections, environment separation (`dev` vs `production`), and that no secrets or sensitive values are committed.

3. **Testing & Verification**:
   - Verify that new or modified behavior has accompanying automated tests (unit, integration, or E2E) capable of preventing real regressions.
   - Run scoped verification checks against affected workspaces when practical: `pnpm turbo run test lint typecheck --filter=<target>`.
   - Do not claim a check was executed unless it actually ran; do not treat passing tests alone as complete proof of correctness.

4. **Commit Hygiene & Standards**:
   - Ensure commit messages follow Conventional Commits format (`type(scope): description`, such as `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, or `chore:`).
   - Keep subject lines concise (ideally under 50 characters) with an optional body explaining the rationale.

5. **Feedback & Actionability**:
   - Leave concise, actionable review comments anchored to relevant lines in the diff.
   - For each issue, clearly describe the failure scenario, impact, and a concrete suggestion or fix.
   - Prioritize by severity. Do not comment on formatting or style issues handled by Prettier and ESLint. If no actionable issue is found, do not invent one.

Keep the review strictly focused on the diff. Do not edit code as part of a review.
