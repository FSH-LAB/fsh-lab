# FSH Lab Status (`apps/status`)

A system status and uptime monitoring web application for FSH Lab. Provides real-time availability, incident tracking, response latency metrics, and scheduled maintenance notices for current applications (such as [Helgefølelse](../helgefolelse)) and future apps.

## Key Features

- **Global System Status Hero**: Real-time status indicator with aggregate 90-day uptime, operational component count, and auto-refresh polling (every 30 seconds).
- **Interactive 90-Day Timeline**: 90-day daily uptime history bars with interactive tooltips showing incident counts and uptime percentages.
- **24-Hour Latency Analytics**: Hourly response time sparklines, average and P95 latency metrics for each monitored component.
- **Live Health Prober**: Next.js API route (`/api/probe`) querying registered `/api/health` endpoints to measure HTTP status and response times dynamically.
- **Open Standards & Integration**:
  - `GET /api/status.json`: Atlassian/OpenAI-compatible machine-readable status payload.
  - `GET /api/feed.xml`: Atom/RSS feed for incident subscription via Slack, Discord, or feed readers.
  - `GET /api/health`: Platform readiness health check returning commit SHA and runtime uptime.
- **Incident & Maintenance Log**: Chronological incident timeline with progression states (`investigating` &rarr; `identified` &rarr; `monitoring` &rarr; `resolved`).

## How to Add Future Apps

The status application is designed to be extensible. When adding a new application under `apps/<new-app>`:

1. **Ensure the app provides `/api/health`**:
   Return JSON with `{ status: "ok", ready: true, commit, uptime }`.

2. **Register the app in `apps/status/src/lib/services.ts`**:
   Add an entry to `MONITORED_SERVICES_CONFIG`:

   ```ts
   {
     id: "new-app",
     name: "New Application Name",
     category: "apps",
     description: "Overview of what this service does.",
     appUrl: "https://new-app.fsh-lab.dev",
     healthEndpoint: "https://new-app.fsh-lab.dev/api/health",
     targetUptime: 99.99,
     baseLatencyMs: 25,
     varianceMs: 8,
     defaultStatus: "operational",
   }
   ```

3. The status dashboard, `/api/status.json`, probe engine, and 90-day history will automatically include the new app.

## Development & Testing

- **Run locally**: `pnpm --filter=status dev` (runs on `http://localhost:3001`)
- **Run unit tests**: `pnpm --filter=status test`
- **Run typecheck**: `pnpm --filter=status typecheck`
- **Run smoke test**: `pnpm --filter=status test:smoke`
- **Build production image**: Follows the monorepo Dockerfile standard (`apps/status/Dockerfile`) with standalone Next.js server.
