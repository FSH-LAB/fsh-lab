import { StatusDashboard } from "@/components/StatusDashboard";
import { ACTIVE_INCIDENTS, SCHEDULED_MAINTENANCES } from "@/lib/incidents";
import { getProbeSnapshot } from "@/lib/probe";
import { getAllMonitoredServices } from "@/lib/services";
import { calculateSystemStatus } from "@/lib/status";
import type { ServiceComponent } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function StatusPage() {
  const probeResults = await getProbeSnapshot();

  const overrides: Record<string, Partial<ServiceComponent>> = {};
  for (const [id, probe] of Object.entries(probeResults)) {
    overrides[id] = {
      status: probe.status,
      currentLatencyMs: probe.latencyMs,
      probeType: probe.probeType,
    };
  }

  const initialServices = getAllMonitoredServices(overrides);
  const initialSummary = calculateSystemStatus(
    initialServices,
    ACTIVE_INCIDENTS,
    SCHEDULED_MAINTENANCES,
  );

  return (
    <StatusDashboard
      initialServices={initialServices}
      initialSummary={initialSummary}
      activeIncidents={ACTIVE_INCIDENTS}
      scheduledMaintenances={SCHEDULED_MAINTENANCES}
    />
  );
}
