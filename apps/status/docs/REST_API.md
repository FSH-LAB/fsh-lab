# FSH Lab Status RESTful API Specification

> **Audience**: Developers, platform operators, and automated monitoring integrations.  
> **OpenAPI Contract**: [`apps/status/openapi.yaml`](../openapi.yaml) (OpenAPI 3.1.0)

---

## 1. Environments & Base URLs

| Environment           | Base URL                     |
| --------------------- | ---------------------------- |
| **Production**        | `https://status.fsh-lab.dev` |
| **Local Development** | `http://localhost:3001`      |

---

## 2. Endpoints Reference

### 2.1. Global System Status (`/api/v1/status`)

Returns an executive summary of current ecosystem health, status indicators, and component counts.

- **Methods**: `GET`, `HEAD`, `OPTIONS`
- **Headers**:
  - `Accept: application/json`
  - `If-None-Match: W/"<etag>"` _(Optional)_

#### Example Request

```bash
curl -i -H "Accept: application/json" https://status.fsh-lab.dev/api/v1/status
```

#### Example Response (`200 OK`)

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8
ETag: W/"142a78e1b"
Cache-Control: public, max-age=15, stale-while-revalidate=30
Access-Control-Allow-Origin: *

{
  "data": {
    "status": "All Systems Operational",
    "indicator": "none",
    "overallUptime90d": 100.0,
    "activeIncidentsCount": 0,
    "activeMaintenanceCount": 0,
    "totalServicesCount": 2,
    "operationalServicesCount": 2,
    "lastChecked": "2026-10-14T14:30:00.000Z"
  }
}
```

---

### 2.2. Monitored Services Collection (`/api/v1/services`)

Returns the collection of all monitored services, including real 24-hour latency percentiles and 90-day history.

- **Methods**: `GET`, `HEAD`, `OPTIONS`

#### Example Request

```bash
curl -i https://status.fsh-lab.dev/api/v1/services
```

#### Example Response (`200 OK`)

```json
{
  "data": [
    {
      "id": "helgefolelse",
      "name": "Helgefølelse",
      "category": "internal",
      "status": "operational",
      "uptime90d": 100.0,
      "currentLatencyMs": 32,
      "appUrl": "https://helgefolelse.no",
      "metrics24h": {
        "avgLatencyMs": 34,
        "p95LatencyMs": 52,
        "points": [{ "timestamp": "14:00", "latencyMs": 32 }]
      }
    },
    {
      "id": "status",
      "name": "Status Dashboard",
      "category": "internal",
      "status": "operational",
      "uptime90d": 100.0,
      "currentLatencyMs": 18,
      "appUrl": "https://status.fsh-lab.dev"
    }
  ]
}
```

---

### 2.3. Single Service Resource (`/api/v1/services/{id}`)

Retrieves details for a specific service by ID (`helgefolelse`, `status`).

- **Methods**: `GET`, `HEAD`, `OPTIONS`
- **Query Parameters**:
  - `days` (`integer`, optional, default `90`): Retention history window to query from persistent BigQuery telemetry (e.g. `90`, `180`, `365`).

#### Example Request

```bash
# Query default 90-day window
curl -i https://status.fsh-lab.dev/api/v1/services/helgefolelse

# Query 1-year (365 days) persistent BigQuery uptime telemetry
curl -i "https://status.fsh-lab.dev/api/v1/services/helgefolelse?days=365"
```

#### Example Error Response (`404 Not Found`)

If the service ID does not exist, an RFC 7807 Problem Details object is returned:

```http
HTTP/1.1 404 Not Found
Content-Type: application/problem+json; charset=utf-8
Access-Control-Allow-Origin: *

{
  "type": "https://status.fsh-lab.dev/problems/not-found",
  "title": "Not Found",
  "status": 404,
  "detail": "Service with ID 'invalid-service' does not exist.",
  "instance": "/api/v1/services/invalid-service"
}
```

---

### 2.4. Live Health Prober (`/api/v1/services/probe`)

Triggers active synthetic probes against all registered `/api/health` endpoints and returns measured round-trip latencies.

- **Methods**: `GET`, `HEAD`, `OPTIONS`

#### Example Request

```bash
curl -i https://status.fsh-lab.dev/api/v1/services/probe
```

#### Example Response (`200 OK`)

```json
{
  "status": "ok",
  "probedAt": "2026-10-14T14:31:00.000Z",
  "results": {
    "helgefolelse": {
      "id": "helgefolelse",
      "name": "Helgefølelse",
      "status": "operational",
      "latencyMs": 29,
      "statusCode": 200,
      "probeType": "http_probe",
      "timestamp": "2026-10-14T14:31:00.000Z"
    },
    "status": {
      "id": "status",
      "name": "Status Dashboard",
      "status": "operational",
      "latencyMs": 14,
      "statusCode": 200,
      "probeType": "http_probe",
      "timestamp": "2026-10-14T14:31:00.000Z"
    }
  }
}
```

#### Degraded Probe Response (`503 Service Unavailable`)

If any probed service fails or times out:

```http
HTTP/1.1 503 Service Unavailable
Content-Type: application/problem+json; charset=utf-8

{
  "type": "https://status.fsh-lab.dev/problems/probe-failure",
  "title": "Service Unavailable",
  "status": 503,
  "detail": "One or more probed services failed health check or timed out.",
  "instance": "/api/v1/services/probe"
}
```

---

### 2.5. Incidents Collection (`/api/v1/incidents`)

Returns all recorded incidents, with optional query filtering by status (`?status=active|resolved`).

- **Methods**: `GET`, `HEAD`, `OPTIONS`
- **Query Parameters**:
  - `status` (`string`, optional): Filter by `active` or `resolved`.

#### Example Request

```bash
curl -i "https://status.fsh-lab.dev/api/v1/incidents?status=active"
```

#### Example Response (`200 OK`)

```json
{
  "data": []
}
```

---

## 3. Conditional Request & Caching Flow

Clients can reduce bandwidth by caching responses and providing the entity tag:

```bash
# 1. Initial request (server returns 200 with ETag)
curl -i https://status.fsh-lab.dev/api/v1/status
# Returns: ETag: W/"89df3a1b"

# 2. Subsequent request (client provides ETag)
curl -i -H 'If-None-Match: W/"89df3a1b"' https://status.fsh-lab.dev/api/v1/status
# Returns: HTTP/1.1 304 Not Modified (zero body bytes transferred)
```
