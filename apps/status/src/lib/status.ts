import type {
  DayUptime,
  Incident,
  ScheduledMaintenance,
  ServiceComponent,
  ServiceMetricPoint,
  ServiceStatus,
  SystemStatusLevel,
  SystemStatusSummary,
} from "./types";

/**
 * Generates 90 days of uptime history up to today.
 * Every day without an incident is truthfully 100% operational.
 * Recorded incidents accurately map to their respective days.
 */
export function generate90DayHistory(
  seed: string,
  targetUptime: number = 100,
  incidentDays: Record<
    string,
    { status: ServiceStatus; count: number; desc: string; uptimePct?: number }
  > = {},
  now: Date = new Date(),
  currentStatus: ServiceStatus = "operational",
): DayUptime[] {
  void seed;
  void targetUptime;
  const days: DayUptime[] = [];

  for (let i = 89; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    const dateStr = d.toISOString().split("T")[0]!;

    // For today (index 89, i === 0), derive state from current live observation
    if (i === 0 && currentStatus !== "operational") {
      days.push({
        date: dateStr,
        status: currentStatus,
        uptimePercentage: currentStatus === "major_outage" ? 0 : 85.0,
        incidentCount: 1,
        description:
          currentStatus === "major_outage"
            ? "Service outage observed during live health probing."
            : "Degraded performance observed during live health probing.",
      });
      continue;
    }

    if (incidentDays[dateStr]) {
      const override = incidentDays[dateStr]!;
      days.push({
        date: dateStr,
        status: override.status,
        uptimePercentage: override.uptimePct ?? 98.4,
        incidentCount: override.count,
        description: override.desc,
      });
    } else {
      // Truthful 100% operational day with zero recorded incidents
      days.push({
        date: dateStr,
        status: "operational",
        uptimePercentage: 100.0,
        incidentCount: 0,
      });
    }
  }

  return days;
}

/**
 * Calculates latency analytics (average and P95) from real telemetry metric points.
 */
export function generate24hMetrics(
  baseLatencyMs: number,
  varianceMs = 0,
  now: Date = new Date(),
  providedPoints?: ServiceMetricPoint[],
): {
  avgLatencyMs: number;
  p95LatencyMs: number;
  points: ServiceMetricPoint[];
} {
  void baseLatencyMs;
  void varianceMs;
  void now;
  const points: ServiceMetricPoint[] =
    providedPoints && providedPoints.length > 0 ? providedPoints : [];

  if (points.length === 0) {
    return {
      avgLatencyMs: 0,
      p95LatencyMs: 0,
      points: [],
    };
  }

  const values = points.map((p) => p.latencyMs).sort((a, b) => a - b);
  const total = values.reduce((sum, v) => sum + v, 0);
  const avgLatencyMs = Math.round(total / values.length);
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
 * Calculates aggregate system status summary from components and active incidents.
 */
export function calculateSystemStatus(
  services: ServiceComponent[],
  activeIncidents: Incident[] = [],
  activeMaintenances: ScheduledMaintenance[] = [],
): SystemStatusSummary {
  const activeUnresolvedIncidents = activeIncidents.filter(
    (inc) => inc.status !== "resolved",
  );

  let worstStatus: SystemStatusLevel = "operational";

  // Check services
  const hasMajor = services.some((s) => s.status === "major_outage");
  const hasPartial = services.some((s) => s.status === "partial_outage");
  const hasDegraded = services.some((s) => s.status === "degraded_performance");
  const hasMaintenance =
    services.some((s) => s.status === "maintenance") ||
    activeMaintenances.some((m) => m.status === "in_progress");

  if (hasMajor) {
    worstStatus = "major_outage";
  } else if (hasPartial) {
    worstStatus = "partial_outage";
  } else if (hasDegraded) {
    worstStatus = "degraded_performance";
  } else if (hasMaintenance) {
    worstStatus = "maintenance";
  }

  // Also check active incidents severity
  for (const inc of activeUnresolvedIncidents) {
    if (inc.impact === "critical" && worstStatus !== "major_outage") {
      worstStatus = "major_outage";
    } else if (
      inc.impact === "major" &&
      worstStatus !== "major_outage" &&
      worstStatus !== "partial_outage"
    ) {
      worstStatus = "partial_outage";
    } else if (inc.impact === "minor" && worstStatus === "operational") {
      worstStatus = "degraded_performance";
    }
  }

  // Aggregate 90-day uptime across all components
  const overallUptime90d =
    services.length > 0
      ? Number(
          (
            services.reduce((acc, s) => acc + s.uptime90d, 0) / services.length
          ).toFixed(3),
        )
      : 100.0;

  const operationalServicesCount = services.filter(
    (s) => s.status === "operational",
  ).length;

  const unavailableCount = services.filter(
    (s) => s.status === "major_outage" || s.status === "partial_outage",
  ).length;
  const degradedCount = services.filter(
    (s) => s.status === "degraded_performance",
  ).length;

  let headline = "All Systems Operational";
  let subheadline =
    "All applications and API endpoints are up and responding normally.";

  if (unavailableCount > 0) {
    headline = `${unavailableCount} of ${services.length} services currently unavailable`;
    subheadline =
      "One or more services are unreachable. Probes are actively monitoring for recovery.";
  } else if (
    worstStatus === "major_outage" ||
    worstStatus === "partial_outage"
  ) {
    headline = `1 of ${services.length || 1} services currently unavailable`;
    subheadline = "An active incident is affecting service availability.";
  } else if (degradedCount > 0) {
    headline = `${degradedCount} of ${services.length} services experiencing degraded performance`;
    subheadline =
      "Services are operational but experiencing elevated response times (>800ms).";
  } else if (worstStatus === "maintenance") {
    headline = "Scheduled Maintenance in Progress";
    subheadline = "Planned maintenance is currently underway.";
  }

  return {
    level: worstStatus,
    headline,
    subheadline,
    overallUptime90d,
    activeIncidentsCount: activeUnresolvedIncidents.length,
    activeMaintenanceCount: activeMaintenances.filter(
      (m) => m.status === "in_progress",
    ).length,
    totalServicesCount: services.length,
    operationalServicesCount,
    lastChecked: new Date().toISOString(),
  };
}

export function getStatusBadgeInfo(status: ServiceStatus | SystemStatusLevel): {
  label: string;
  dotColor: string;
  badgeBg: string;
  badgeText: string;
  borderColor: string;
  barColor: string;
} {
  switch (status) {
    case "operational":
      return {
        label: "Up",
        dotColor: "bg-emerald-400",
        badgeBg: "bg-emerald-500/10",
        badgeText: "text-emerald-400",
        borderColor: "border-emerald-500/20",
        barColor: "bg-emerald-500",
      };
    case "degraded_performance":
      return {
        label: "Degraded",
        dotColor: "bg-amber-400",
        badgeBg: "bg-amber-500/10",
        badgeText: "text-amber-400",
        borderColor: "border-amber-500/20",
        barColor: "bg-amber-500",
      };
    case "partial_outage":
    case "major_outage":
      return {
        label: "Down",
        dotColor: "bg-rose-500",
        badgeBg: "bg-rose-500/10",
        badgeText: "text-rose-400",
        borderColor: "border-rose-500/20",
        barColor: "bg-rose-500",
      };
    case "maintenance":
      return {
        label: "Maintenance",
        dotColor: "bg-sky-400",
        badgeBg: "bg-sky-500/10",
        badgeText: "text-sky-400",
        borderColor: "border-sky-500/20",
        barColor: "bg-sky-500",
      };
  }
}

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
