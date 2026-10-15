import { fetchBigQueryUptimeHistory } from "@/lib/bigquery";
import { getProbeSnapshot } from "@/lib/probe";
import { optionsResponse, problemResponse, restJsonResponse } from "@/lib/rest";
import { getAllMonitoredServices } from "@/lib/services";

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> },
) {
  const { id } = await props.params;
  const probeResults = await getProbeSnapshot();
  const probe = probeResults[id];

  const services = getAllMonitoredServices(
    probe
      ? {
          [id]: {
            status: probe.status,
            currentLatencyMs: probe.latencyMs,
            probeType: probe.probeType,
          },
        }
      : undefined,
  );

  const service = services.find((s) => s.id === id);

  if (!service) {
    return problemResponse(
      404,
      "Service Not Found",
      `The requested service with identifier '${id}' does not exist in the monitored catalog.`,
      new URL(request.url).pathname,
    );
  }

  const url = new URL(request.url);
  const requestedDays = url.searchParams.get("days")
    ? parseInt(url.searchParams.get("days")!, 10)
    : 90;

  let persistentStats = null;
  if (service.appUrl) {
    try {
      const host = new URL(service.appUrl).hostname;
      persistentStats = await fetchBigQueryUptimeHistory(host, requestedDays);
    } catch {
      // Fallback if invalid URL
    }
  }

  return restJsonResponse(
    {
      data: {
        id: service.id,
        name: service.name,
        category: service.category,
        description: service.description,
        status: service.status,
        probe_type: service.probeType ?? "http_probe",
        uptime_90d: service.uptime90d,
        uptime_history_days: requestedDays,
        persistent_stats: persistentStats,
        current_latency_ms: service.currentLatencyMs,
        app_url: service.appUrl,
        health_endpoint: service.healthEndpoint,
        metrics: service.metrics24h,
        days: service.days,
      },
    },
    request,
  );
}

export async function HEAD(
  request: Request,
  props: { params: Promise<{ id: string }> },
) {
  return GET(request, props);
}

export async function OPTIONS() {
  return optionsResponse(["GET", "HEAD", "OPTIONS"]);
}
