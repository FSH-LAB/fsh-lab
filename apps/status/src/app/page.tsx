import { StatusDashboard } from "@/components/StatusDashboard";
import { ACTIVE_INCIDENTS, SCHEDULED_MAINTENANCES } from "@/lib/incidents";
import { getAllMonitoredServices } from "@/lib/services";
import { calculateSystemStatus } from "@/lib/status";

export const dynamic = "force-dynamic";

export default function StatusPage() {
  const initialServices = getAllMonitoredServices();
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
