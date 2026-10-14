import { MONITORED_SERVICES_CONFIG } from "./services";
import type { ProbeResult, ServiceStatus } from "./types";

interface ProbeCache {
  timestamp: number;
  data: Record<string, ProbeResult>;
}

const CACHE_TTL_MS = 15_000; // 15 seconds cache to prevent outbound traffic amplification
let probeCache: ProbeCache | null = null;
let activeProbePromise: Promise<Record<string, ProbeResult>> | null = null;

/**
 * Resets probe cache (primarily for unit testing).
 */
export function resetProbeCacheForTesting(): void {
  probeCache = null;
  activeProbePromise = null;
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

  // If we have a fresh cache and not forcing, return cached results
  if (
    !options?.force &&
    !options?.targetId &&
    probeCache &&
    now - probeCache.timestamp < CACHE_TTL_MS
  ) {
    return probeCache.data;
  }

  // If a full probe is already in flight and not targeted/forced, reuse its promise
  if (activeProbePromise && !options?.force && !options?.targetId) {
    return activeProbePromise;
  }

  const targets = options?.targetId
    ? MONITORED_SERVICES_CONFIG.filter((s) => s.id === options.targetId)
    : MONITORED_SERVICES_CONFIG;

  const probeExecution = async (): Promise<Record<string, ProbeResult>> => {
    const results: Record<string, ProbeResult> = {};

    await Promise.all(
      targets.map(async (service) => {
        const timestampIso = new Date().toISOString();

        // 1. Platform / Infrastructure services without dedicated HTTP health check
        if (!service.healthEndpoint) {
          results[service.id] = {
            id: service.id,
            name: service.name,
            status: service.defaultStatus ?? "operational",
            latencyMs: 0, // Explicit 0: not measured via HTTP ping
            probeType: "platform_managed",
            timestamp: timestampIso,
          };
          return;
        }

        // 2. Monitored HTTP service (probe endpoint)
        const start = performance.now();
        try {
          const response = await customFetch(service.healthEndpoint, {
            signal: AbortSignal.timeout(3500),
            headers: {
              "User-Agent": "FSH-Lab-Status-Probe/1.0",
            },
            cache: "no-store",
          });

          const latencyMs = Math.round(performance.now() - start);

          if (response.ok) {
            results[service.id] = {
              id: service.id,
              name: service.name,
              status: latencyMs > 800 ? "degraded_performance" : "operational",
              latencyMs,
              probeType: "http_probe",
              statusCode: response.status,
              timestamp: timestampIso,
            };
          } else {
            // Non-2xx response: 5xx is an outage, 4xx is degraded
            const status: ServiceStatus =
              response.status >= 500 ? "major_outage" : "degraded_performance";

            results[service.id] = {
              id: service.id,
              name: service.name,
              status,
              latencyMs,
              probeType: "http_probe",
              statusCode: response.status,
              timestamp: timestampIso,
            };
          }
        } catch (err) {
          // Network failure, DNS error, connection refusal, or timeout.
          // In production: must report as major_outage.
          // In development: report major_outage or degraded with clear error indicator.
          const errorMsg =
            err instanceof Error ? err.message : "Connection failed";
          const isTimeout =
            err instanceof Error &&
            (err.name === "TimeoutError" ||
              err.message.toLowerCase().includes("timeout"));

          results[service.id] = {
            id: service.id,
            name: service.name,
            status: isTimeout ? "degraded_performance" : "major_outage",
            latencyMs: 0,
            probeType: "http_probe",
            error: errorMsg,
            timestamp: timestampIso,
          };
        }
      }),
    );

    // Only cache if full scan was performed
    if (!options?.targetId) {
      probeCache = {
        timestamp: Date.now(),
        data: results,
      };
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
