import { getProbeSnapshot } from "@/lib/probe";
import { optionsResponse, restJsonResponse } from "@/lib/rest";
import { getAllMonitoredServices } from "@/lib/services";
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

  return restJsonResponse(
    {
      data: services.map((s) => ({
        id: s.id,
        name: s.name,
        category: s.category,
        description: s.description,
        status: s.status,
        probe_type: s.probeType ?? "http_probe",
        uptime_90d: s.uptime90d,
        current_latency_ms: s.currentLatencyMs,
        app_url: s.appUrl,
        health_endpoint: s.healthEndpoint,
      })),
      meta: {
        total: services.length,
        timestamp: new Date().toISOString(),
      },
    },
    request,
  );
}

export async function HEAD(request: Request) {
  return GET(request);
}

export async function OPTIONS() {
  return optionsResponse(["GET", "HEAD", "OPTIONS"]);
}
