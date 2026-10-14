# FSH Lab Status (`apps/status`)

A system status and uptime monitoring web application for FSH Lab. Provides real-time availability, incident tracking, response latency metrics, and scheduled maintenance notices for FSH Lab core applications (such as [Helgefølelse](../helgefolelse)).

## Key Features

- **Truth in Monitoring**: 100% authentic, real data. No mock incidents, no simulated sine-wave latencies, and no fake history generation.
- **Strictly Internal Focus**: Focuses directly on FSH Lab applications without extraneous third-party noise.
- **Global System Status Hero**: Real-time status indicator with aggregate 90-day uptime, operational component count, and auto-refresh polling (every 30 seconds).
- **Interactive 90-Day Timeline**: Daily uptime history bars accurately reflecting recorded incidents and live probe health.
- **Response Latency Telemetry**: Real measured response time metrics, dynamic average, and P95 latency calculated from live probe samples.
- **Live Health Prober**: Next.js API route (`/api/v1/services/probe`) querying registered `/api/health` endpoints to measure HTTP status and response times dynamically.
- **REST API**: Programmatic status endpoints, service metadata, and health probes. Detailed developer reference in [docs/REST_API.md](docs/REST_API.md) and [openapi.yaml](openapi.yaml).

---

## API Reference

| Method        | Endpoint                      | Description                                                          | Status Codes        |
| ------------- | ----------------------------- | -------------------------------------------------------------------- | ------------------- |
| `GET`, `HEAD` | `/api/v1/status`              | System status summary, indicator, and monitored components           | `200`, `304`        |
| `GET`, `HEAD` | `/api/v1/services`            | Collection resource of all monitored services                        | `200`, `304`        |
| `GET`, `HEAD` | `/api/v1/services/{id}`       | Single service resource by ID with latency & 90-day history          | `200`, `304`, `404` |
| `GET`, `HEAD` | `/api/v1/services/{id}/probe` | Live health probe result for a specific service                      | `200`, `304`, `404` |
| `GET`, `HEAD` | `/api/v1/services/probe`      | Live health probe snapshot across all services                       | `200`, `304`        |
| `GET`, `HEAD` | `/api/v1/incidents`           | Collection of active and past incidents (`?status=active\|resolved`) | `200`, `304`        |
| `GET`, `HEAD` | `/api/v1/incidents/{id}`      | Single incident post-mortem and update history                       | `200`, `304`, `404` |
| `GET`, `HEAD` | `/api/health`                 | Platform readiness and liveness health check                         | `200`               |

---

## Developer Guide: How to Add a Future App

When adding a new application under `apps/<new-app>`:

### 1. Standard Health Endpoint Contract

Every FSH Lab application must implement an HTTP health endpoint at `/api/health` returning JSON:

```json
{
  "status": "ok",
  "ready": true,
  "commit": "optional_git_sha",
  "uptime": 12345
}
```

HTTP status 200 is classified as operational, 4xx as degraded performance, and 5xx / connection errors as outage.

### 2. Register the App in `apps/status/src/lib/services.ts`

Add an entry to `MONITORED_SERVICES_CONFIG`:

```typescript
{
  id: "your-app-id",
  name: "Your App Display Name",
  category: "internal",
  appUrl: process.env.NEXT_PUBLIC_YOUR_APP_URL,
  healthEndpoint: process.env.YOUR_APP_HEALTH_URL,
  probeType: "http_probe",
  targetUptime: 99.99,
  baseLatencyMs: 0,
  varianceMs: 0,
  defaultStatus: "operational",
}
```

### 3. Automatic Integration

Once registered:

- **Live Synthetic Prober**: Automatically measures HTTP latency and status codes every 30 seconds.
- **Rolling Telemetry**: Real response latencies, P95, and average latency metrics are dynamically tracked.
- **REST API & Syndication**: Automatically populated across `/api/v1/status`, `/api/v1/services`, and `/api/v1/feed`.

---

## Development & Testing

- **Run locally**: `pnpm --filter=status dev` (runs on `http://localhost:3001`)
- **Run unit & REST tests**: `pnpm --filter=status test`
- **Run typecheck**: `pnpm --filter=status typecheck`
- **Build production image**: Follows the monorepo Dockerfile standard (`apps/status/Dockerfile`) with standalone Next.js server.
