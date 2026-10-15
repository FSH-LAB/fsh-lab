import {
  ACTIVE_INCIDENTS,
  PAST_INCIDENTS,
  SCHEDULED_MAINTENANCES,
} from "@/lib/incidents";
import { getProbeSnapshot } from "@/lib/probe";
import { optionsResponse, restJsonResponse } from "@/lib/rest";
import { getAllMonitoredServices, getServiceEndpoints } from "@/lib/services";
import {
  calculateSystemStatus,
  mapLevelToStandardIndicator,
} from "@/lib/status";
import type { ServiceComponent } from "@/lib/types";

export async function GET(request: Request) {
  const probeResults = await getProbeSnapshot();

  const overrides: Record<string, Partial<ServiceComponent>> = {};
  for (const [id, probe] of Object.entries(probeResults)) {
    overrides[id] = {
      status: probe.status,
      currentLatencyMs: probe.latencyMs,
      probeType: probe.probeType,
    };
  }

  const services = getAllMonitoredServices(overrides);
  const summary = calculateSystemStatus(
    services,
    ACTIVE_INCIDENTS,
    SCHEDULED_MAINTENANCES,
  );

  // Quantize updated_at to the 10s HTTP cache window so ETag is stable across requests
  const cacheBucketIso = new Date(
    Math.floor(Date.now() / 10000) * 10000,
  ).toISOString();

  const payload = {
    page: {
      id: "fsh-lab-status",
      name: "FSH Lab System Status",
      url:
        getServiceEndpoints("status").appUrl ||
        process.env.NEXT_PUBLIC_STATUS_URL ||
        new URL(request.url).origin,
      time_zone: "Europe/Oslo",
      updated_at: cacheBucketIso,
    },
    status: {
      indicator: mapLevelToStandardIndicator(summary.level),
      description: summary.headline,
      level: summary.level,
      overall_uptime_90d: summary.overallUptime90d,
    },
    services: services.map((s) => ({
      id: s.id,
      name: s.name,
      category: s.category,
      description: s.description,
      status: s.status,
      probe_type: s.probeType ?? "http_probe",
      uptime_90d: s.uptime90d,
      current_latency_ms: s.currentLatencyMs,
    })),
    incidents: [...ACTIVE_INCIDENTS, ...PAST_INCIDENTS],
    scheduled_maintenances: SCHEDULED_MAINTENANCES,
  };

  return restJsonResponse(payload, request);
}

export async function HEAD(request: Request) {
  return GET(request);
}

export async function OPTIONS() {
  return optionsResponse(["GET", "HEAD", "OPTIONS"]);
}
