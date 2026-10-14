export type ServiceStatus =
  | "operational"
  | "degraded_performance"
  | "partial_outage"
  | "major_outage"
  | "maintenance";

export type SystemStatusLevel =
  | "operational"
  | "degraded_performance"
  | "partial_outage"
  | "major_outage"
  | "maintenance";

export type ServiceCategory =
  "internal" | "third_party" | "apps" | "platform" | "infra";

export interface DayUptime {
  date: string; // ISO date YYYY-MM-DD
  status: ServiceStatus;
  uptimePercentage: number;
  incidentCount: number;
  description?: string;
}

export interface ServiceMetricPoint {
  timestamp: string; // ISO string or HH:MM
  latencyMs: number;
}

export type ProbeType = "http_probe" | "platform_managed" | "third_party_api";

export interface ProbeResult {
  id: string;
  name: string;
  status: ServiceStatus;
  latencyMs: number;
  probeType: ProbeType;
  statusCode?: number;
  error?: string;
  timestamp: string;
}

export interface ServiceComponent {
  id: string;
  name: string;
  category: ServiceCategory;
  isThirdParty?: boolean;
  description: string;
  status: ServiceStatus;
  probeType?: ProbeType;
  healthEndpoint?: string; // e.g. "/api/health" or "https://..."
  appUrl?: string; // Public app link
  uptime90d: number; // e.g. 99.98
  currentLatencyMs: number;
  days: DayUptime[];
  metrics24h: {
    avgLatencyMs: number;
    p95LatencyMs: number;
    points: ServiceMetricPoint[];
  };
}

export type IncidentStatus =
  "investigating" | "identified" | "monitoring" | "resolved";

export type IncidentImpact = "none" | "minor" | "major" | "critical";

export interface IncidentUpdate {
  id: string;
  timestamp: string;
  status: IncidentStatus;
  message: string;
}

export interface Incident {
  id: string;
  title: string;
  impact: IncidentImpact;
  status: IncidentStatus;
  affectedServiceIds: string[];
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  updates: IncidentUpdate[];
}

export interface ScheduledMaintenance {
  id: string;
  title: string;
  status: "scheduled" | "in_progress" | "completed";
  affectedServiceIds: string[];
  scheduledStart: string;
  scheduledEnd: string;
  description: string;
}

export interface SystemStatusSummary {
  level: SystemStatusLevel;
  headline: string;
  subheadline: string;
  overallUptime90d: number;
  activeIncidentsCount: number;
  activeMaintenanceCount: number;
  totalServicesCount: number;
  operationalServicesCount: number;
  lastChecked: string;
}
