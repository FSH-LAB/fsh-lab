import { MONITORED_SERVICES_CONFIG } from "./services";
import type { ProbeResult, ServiceStatus } from "./types";

interface ProbeCache {
  timestamp: number;
  data: Record<string, ProbeResult>;
}

const CACHE_TTL_MS = 15_000; // 15 seconds cache to prevent outbound traffic amplification
let probeCache: ProbeCache | null = null;
let activeProbePromise: Promise<Record<string, ProbeResult>> | null = null;

// Real rolling telemetry buffer: stores actual observed probe latency measurements
const probeTelemetryStore: Record<
  string,
  Array<{ timestamp: string; latencyMs: number }>
> = {};
const MAX_TELEMETRY_POINTS = 24;

// Rolling daily check history store: tracks checks per day to calculate truthful daily uptime
const dailyChecksStore: Record<
  string,
  Record<
    string,
    {
      totalChecks: number;
      successfulChecks: number;
      outages: number;
      degraded: number;
    }
  >
> = {};

function recordDailyCheck(serviceId: string, result: ProbeResult): void {
  const dateStr = result.timestamp.split("T")[0]!;
  if (!dailyChecksStore[serviceId]) {
    dailyChecksStore[serviceId] = {};
  }
  if (!dailyChecksStore[serviceId]![dateStr]) {
    dailyChecksStore[serviceId]![dateStr] = {
      totalChecks: 0,
      successfulChecks: 0,
      outages: 0,
      degraded: 0,
    };
  }
  const entry = dailyChecksStore[serviceId]![dateStr]!;
  entry.totalChecks += 1;
  if (result.status === "operational") {
    entry.successfulChecks += 1;
  } else if (
    result.status === "major_outage" ||
    result.status === "partial_outage"
  ) {
    entry.outages += 1;
  } else if (result.status === "degraded_performance") {
    entry.degraded += 1;
  }
}

function emitUptimeCheckLog(
  service: (typeof MONITORED_SERVICES_CONFIG)[number],
  result: ProbeResult,
): void {
  try {
    let host = service.id;
    if (service.healthEndpoint) {
      host = new URL(service.healthEndpoint).hostname;
    } else if (service.appUrl) {
      host = new URL(service.appUrl).hostname;
    }
    const isSuccess = result.status === "operational";
    // Producer for Cloud Logging sink -> BigQuery uptime_checks table
    console.log(
      JSON.stringify({
        event: "uptime_check",
        service_id: service.id,
        host,
        status: result.statusCode ?? (isSuccess ? 200 : 503),
        latency_ms: result.latencyMs,
        success: isSuccess,
        timestamp: result.timestamp,
      }),
    );
  } catch {
    // Avoid unhandled errors on malformed URLs
  }
}

export function getDailyChecksStore(): Record<
  string,
  Record<
    string,
    {
      totalChecks: number;
      successfulChecks: number;
      outages: number;
      degraded: number;
    }
  >
> {
  return dailyChecksStore;
}

/**
 * Resets probe cache and telemetry buffer (primarily for unit testing).
 */
export function resetProbeCacheForTesting(): void {
  probeCache = null;
  activeProbePromise = null;
  for (const key of Object.keys(probeTelemetryStore)) {
    delete probeTelemetryStore[key];
  }
  for (const key of Object.keys(dailyChecksStore)) {
    delete dailyChecksStore[key];
  }
}

/**
 * Checks whether an incoming HTTP request has internal authorization to force an un-coalesced probe.
 */
export function isAuthorizedToForce(request: Request): boolean {
  const secret = process.env.INTERNAL_PROBE_SECRET || process.env.CRON_SECRET;
  if (!secret) return false;
  const tokenHeader = request.headers.get("x-probe-token");
  if (tokenHeader === secret) return true;
  const authHeader = request.headers.get("authorization");
  if (authHeader === `Bearer ${secret}`) return true;
  return false;
}

/**
 * Retrieves real rolling telemetry points and calculated latency for a service.
 */
export function getServiceTelemetry(serviceId: string): {
  avgLatencyMs: number;
  p95LatencyMs: number;
  points: Array<{ timestamp: string; latencyMs: number }>;
} {
  const points = probeTelemetryStore[serviceId] ?? [];
  if (points.length === 0) {
    return {
      avgLatencyMs: 0,
      p95LatencyMs: 0,
      points: [],
    };
  }

  const values = points.map((p) => p.latencyMs).sort((a, b) => a - b);
  const sum = values.reduce((acc, v) => acc + v, 0);
  const avgLatencyMs = Math.round(sum / values.length);
  const p95Index = Math.min(
    values.length - 1,
    Math.floor(values.length * 0.95),
  );
  const p95LatencyMs = values[p95Index] ?? avgLatencyMs;

  return {
    avgLatencyMs,
    p95LatencyMs,
    points,
  };
}

/**
 * Executes or retrieves a cached health probe snapshot.
 * Coalesces concurrent in-flight requests and respects CACHE_TTL_MS.
 */
export async function getProbeSnapshot(options?: {
  force?: boolean;
  targetId?: string;
  fetchFn?: typeof fetch;
}): Promise<Record<string, ProbeResult>> {
  const customFetch = options?.fetchFn ?? fetch;
  const now = Date.now();

  // 1. Fresh cache check: return cached data if fresh and not forcing
  if (
    !options?.force &&
    probeCache &&
    now - probeCache.timestamp < CACHE_TTL_MS
  ) {
    if (options?.targetId) {
      if (probeCache.data[options.targetId]) {
        return probeCache.data;
      }
    } else {
      return probeCache.data;
    }
  }

  // 2. Coalescing check: if an active probe is in flight and not forcing, reuse it
  if (activeProbePromise && !options?.force) {
    return activeProbePromise;
  }

  const targets = options?.targetId
    ? MONITORED_SERVICES_CONFIG.filter((s) => s.id === options.targetId)
    : MONITORED_SERVICES_CONFIG;

  const probeExecution = async (): Promise<Record<string, ProbeResult>> => {
    const results: Record<string, ProbeResult> = {};

    await Promise.all(
      targets.map(async (service) => {
        const nowDate = new Date();
        const timestampIso = nowDate.toISOString();
        const timeLabel = `${String(nowDate.getUTCHours()).padStart(2, "0")}:${String(nowDate.getUTCMinutes()).padStart(2, "0")}`;

        const setResult = (res: ProbeResult) => {
          results[service.id] = res;
          recordDailyCheck(service.id, res);
          emitUptimeCheckLog(service, res);
        };

        // 1. Platform / Infrastructure services without dedicated HTTP health check
        if (!service.healthEndpoint) {
          setResult({
            id: service.id,
            name: service.name,
            status: service.defaultStatus ?? "operational",
            latencyMs: 0, // Explicit 0: not measured via HTTP ping
            probeType: "platform_managed",
            timestamp: timestampIso,
          });
          return;
        }

        // 2. Monitored HTTP service or Third-Party Status API
        const start = performance.now();
        try {
          const response = await customFetch(service.healthEndpoint, {
            signal: AbortSignal.timeout(3500),
            headers: {
              "User-Agent": "FSH-Lab-Status-Probe/1.0",
              Accept: "application/json, text/html, */*",
            },
            cache: "no-store",
          });

          const latencyMs = Math.round(performance.now() - start);

          if (response.ok) {
            let isServiceReady = true;
            let reportedStatus: ServiceStatus | null = null;
            let errorDetail: string | undefined;

            // Validate documented health contract fields: { status: "ok", ready: true, ... }
            const contentType = response.headers.get("content-type") || "";
            if (contentType.includes("application/json")) {
              try {
                const body = (await response.json()) as Record<string, unknown>;
                if (body && typeof body === "object") {
                  if (typeof body.ready === "boolean" && !body.ready) {
                    isServiceReady = false;
                    errorDetail =
                      "Service readiness probe indicated ready=false";
                  }
                  if (typeof body.status === "string") {
                    const normalized = body.status.toLowerCase();
                    if (
                      normalized === "ok" ||
                      normalized === "healthy" ||
                      normalized === "up"
                    ) {
                      // Healthy
                    } else if (normalized === "degraded") {
                      reportedStatus = "degraded_performance";
                    } else if (normalized === "maintenance") {
                      reportedStatus = "maintenance";
                    } else {
                      isServiceReady = false;
                      errorDetail = `Service reported unhealthy status: ${body.status}`;
                    }
                  }
                }
              } catch {
                // If body isn't valid JSON, fallback to HTTP 200 ok
              }
            }

            if (!isServiceReady) {
              setResult({
                id: service.id,
                name: service.name,
                status: "major_outage",
                latencyMs,
                probeType: service.probeType ?? "http_probe",
                statusCode: response.status,
                error: errorDetail,
                timestamp: timestampIso,
              });
              return;
            }

            const finalStatus: ServiceStatus =
              reportedStatus ??
              (latencyMs > 800 ? "degraded_performance" : "operational");

            setResult({
              id: service.id,
              name: service.name,
              status: finalStatus,
              latencyMs,
              probeType: service.probeType ?? "http_probe",
              statusCode: response.status,
              timestamp: timestampIso,
            });

            // Store real telemetry point only for active responses
            if (!probeTelemetryStore[service.id]) {
              probeTelemetryStore[service.id] = [];
            }
            probeTelemetryStore[service.id]!.push({
              timestamp: timeLabel,
              latencyMs,
            });
            if (
              probeTelemetryStore[service.id]!.length > MAX_TELEMETRY_POINTS
            ) {
              probeTelemetryStore[service.id]!.shift();
            }
          } else {
            // Non-2xx response: 5xx is an outage, 4xx is degraded
            const status: ServiceStatus =
              response.status >= 500 ? "major_outage" : "degraded_performance";

            setResult({
              id: service.id,
              name: service.name,
              status,
              latencyMs,
              probeType: service.probeType ?? "http_probe",
              statusCode: response.status,
              timestamp: timestampIso,
            });
          }
        } catch (err) {
          // Network failure, DNS error, connection refusal, or timeout.
          const errorMsg =
            err instanceof Error ? err.message : "Connection failed";

          // Unresponsive endpoints (timeouts, connection refusals) are classified as major_outage
          setResult({
            id: service.id,
            name: service.name,
            status: "major_outage",
            latencyMs: 0,
            probeType: service.probeType ?? "http_probe",
            error: errorMsg,
            timestamp: timestampIso,
          });
        }
      }),
    );

    // Update probe cache
    if (!options?.targetId) {
      probeCache = {
        timestamp: Date.now(),
        data: results,
      };
    } else if (probeCache) {
      Object.assign(probeCache.data, results);
    }

    return results;
  };

  if (!options?.targetId) {
    activeProbePromise = probeExecution().finally(() => {
      activeProbePromise = null;
    });
    return activeProbePromise;
  }

  return probeExecution();
}
