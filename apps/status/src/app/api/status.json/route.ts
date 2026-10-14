import {
  ACTIVE_INCIDENTS,
  PAST_INCIDENTS,
  SCHEDULED_MAINTENANCES,
} from "@/lib/incidents";
import { getAllMonitoredServices } from "@/lib/services";
import { calculateSystemStatus } from "@/lib/status";

export function GET() {
  const services = getAllMonitoredServices();
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
      indicator: summary.level === "operational" ? "none" : summary.level,
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
