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
 * Deterministically generates 90 days of uptime history up to today.
 * Supports explicit incident overrides for specific dates.
 */
export function generate90DayHistory(
  seed: string,
  targetUptime: number,
  incidentDays: Record<
    string,
    { status: ServiceStatus; count: number; desc: string; uptimePct?: number }
  > = {},
  now: Date = new Date(),
): DayUptime[] {
  const days: DayUptime[] = [];

  for (let i = 89; i >= 0; i--) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    const dateStr = d.toISOString().split("T")[0]!;

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
      // Deterministic slight fluctuation based on day string hash
      let hash = 0;
      const combined = `${seed}-${dateStr}`;
      for (let j = 0; j < combined.length; j++) {
        hash = (hash << 5) - hash + combined.charCodeAt(j);
        hash |= 0;
      }
      const isPerfect = Math.abs(hash % 100) > 3 || targetUptime >= 99.99;
      const uptimePercentage = isPerfect
        ? 100
        : Math.max(99.8, targetUptime - 0.05);

      days.push({
        date: dateStr,
        status: "operational",
        uptimePercentage,
        incidentCount: 0,
      });
    }
  }

  return days;
}

/**
 * Generates 24 hours of latency metric points.
 */
export function generate24hMetrics(
  baseLatencyMs: number,
  varianceMs: number,
  now: Date = new Date(),
): {
  avgLatencyMs: number;
  p95LatencyMs: number;
  points: ServiceMetricPoint[];
} {
  const points: ServiceMetricPoint[] = [];
  let total = 0;
  const values: number[] = [];

  for (let hour = 23; hour >= 0; hour--) {
    const d = new Date(now);
    d.setUTCHours(d.getUTCHours() - hour);
    const timeLabel = `${String(d.getUTCHours()).padStart(2, "0")}:00`;

    // Subtle sinusoidal variance + pseudo-random jitter
    const hourFactor = Math.sin((d.getUTCHours() / 24) * Math.PI * 2);
    const jitter = ((d.getUTCHours() * 17) % 7) - 3;
    const latency = Math.max(
      8,
      Math.round(baseLatencyMs + hourFactor * varianceMs + jitter),
    );

    values.push(latency);
    total += latency;
    points.push({ timestamp: timeLabel, latencyMs: latency });
  }

  values.sort((a, b) => a - b);
  const p95Index = Math.floor(values.length * 0.95);
  const p95LatencyMs = values[p95Index] ?? baseLatencyMs;
  const avgLatencyMs = Math.round(total / points.length);

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
  const hasMaintenance = services.some((s) => s.status === "maintenance");

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

  let headline = "All Systems Operational";
  let subheadline =
    "All applications, platform infrastructure, and API endpoints are functioning normally.";

  switch (worstStatus) {
    case "major_outage":
      headline = "Major System Outage";
      subheadline =
        "One or more core services are currently unavailable. The engineering team is actively investigating.";
      break;
    case "partial_outage":
      headline = "Partial System Outage";
      subheadline =
        "Some systems are experiencing localized service disruptions while other services remain healthy.";
      break;
    case "degraded_performance":
      headline = "Degraded System Performance";
      subheadline =
        "Services are operational but may be experiencing elevated response times or intermittent latency.";
      break;
    case "maintenance":
      headline = "Scheduled Maintenance in Progress";
      subheadline =
        "Planned maintenance is underway. Systems are operating in maintenance mode.";
      break;
    default:
      break;
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
        label: "Operational",
        dotColor: "bg-emerald-400",
        badgeBg: "bg-emerald-500/10",
        badgeText: "text-emerald-400",
        borderColor: "border-emerald-500/20",
        barColor: "bg-emerald-500",
      };
    case "degraded_performance":
      return {
        label: "Degraded Performance",
        dotColor: "bg-amber-400",
        badgeBg: "bg-amber-500/10",
        badgeText: "text-amber-400",
        borderColor: "border-amber-500/20",
        barColor: "bg-amber-500",
      };
    case "partial_outage":
      return {
        label: "Partial Outage",
        dotColor: "bg-orange-400",
        badgeBg: "bg-orange-500/10",
        badgeText: "text-orange-400",
        borderColor: "border-orange-500/20",
        barColor: "bg-orange-500",
      };
    case "major_outage":
      return {
        label: "Major Outage",
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
