import {
  ACTIVE_INCIDENTS,
  PAST_INCIDENTS,
  SCHEDULED_MAINTENANCES,
} from "@/lib/incidents";
import { getProbeSnapshot } from "@/lib/probe";
import { getAllMonitoredServices } from "@/lib/services";
import { calculateSystemStatus } from "@/lib/status";
import type { ServiceComponent, SystemStatusLevel } from "@/lib/types";

/**
 * Maps internal system status level to standard Statuspage indicator vocabulary:
 * "none", "minor", "major", "critical", or "maintenance".
 */
export function mapLevelToStandardIndicator(
  level: SystemStatusLevel,
): "none" | "minor" | "major" | "critical" | "maintenance" {
  switch (level) {
    case "operational":
      return "none";
    case "degraded_performance":
      return "minor";
    case "partial_outage":
      return "major";
    case "major_outage":
      return "critical";
    case "maintenance":
      return "maintenance";
  }
}

export async function GET() {
  // Read live/cached probe results so status.json reflects active outages
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

  const payload = {
    page: {
      id: "fsh-lab-status",
      name: "FSH Lab System Status",
      url: "https://status.fsh-lab.dev",
      time_zone: "Europe/Oslo",
      updated_at: summary.lastChecked,
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
      probe_type: s.probeType ?? "platform_managed",
      uptime_90d: s.uptime90d,
      current_latency_ms: s.currentLatencyMs,
    })),
    incidents: [...ACTIVE_INCIDENTS, ...PAST_INCIDENTS],
    scheduled_maintenances: SCHEDULED_MAINTENANCES,
  };

  return Response.json(payload, {
    headers: {
      "Cache-Control": "public, s-maxage=10, stale-while-revalidate=30",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
