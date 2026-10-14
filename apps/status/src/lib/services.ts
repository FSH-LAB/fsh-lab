import { generate24hMetrics, generate90DayHistory } from "./status";
import type { ServiceCategory, ServiceComponent, ServiceStatus } from "./types";

/**
 * Configuration schema for an application or service monitored by the status page.
 * To register a future app, simply add an entry to MONITORED_SERVICES_CONFIG below!
 */
export interface MonitoredServiceConfig {
  id: string;
  name: string;
  category: ServiceCategory;
  description: string;
  appUrl?: string;
  healthEndpoint?: string;
  targetUptime: number; // e.g. 99.98
  baseLatencyMs: number;
  varianceMs: number;
  defaultStatus?: ServiceStatus;
  incidentOverrides?: Record<
    string,
    { status: ServiceStatus; count: number; desc: string; uptimePct?: number }
  >;
}

/**
 * Central registry of all services across the FSH Lab ecosystem.
 * Supports current apps (Helgefølelse), core platform infrastructure, and future apps.
 */
export const MONITORED_SERVICES_CONFIG: MonitoredServiceConfig[] = [
  // --- Applications ---
  {
    id: "helgefolelse",
    name: "Helgefølelse",
    category: "apps",
    description:
      "Public weekend feeling index, tide visualization, and real-time calculation engine.",
    appUrl:
      process.env.NEXT_PUBLIC_HELGEFOLELSE_URL || "https://helgefolelse.no",
    healthEndpoint:
      process.env.HELGEFOLELSE_HEALTH_URL ||
      (process.env.NODE_ENV === "development"
        ? "http://localhost:3000/api/health"
        : "https://helgefolelse.no/api/health"),
    targetUptime: 99.99,
    baseLatencyMs: 24,
    varianceMs: 8,
    defaultStatus: "operational",
    incidentOverrides: {
      "2026-09-18": {
        status: "degraded_performance",
        count: 1,
        desc: "Brief 12-minute latency spike during traffic burst (resolved).",
        uptimePct: 99.2,
      },
    },
  },

  // --- Platform & Compute ---
  {
    id: "cloud-run",
    name: "Cloud Run Workload Runtime",
    category: "platform",
    description:
      "Serverless container execution environment in Google Cloud (europe-north2).",
    appUrl: "https://cloud.google.com/run",
    targetUptime: 99.99,
    baseLatencyMs: 14,
    varianceMs: 4,
    defaultStatus: "operational",
  },
  {
    id: "edge-network",
    name: "Edge Network & TLS Termination",
    category: "platform",
    description:
      "Global edge routing, anycast ingress, automated HTTPS certificates, and DDoS mitigation.",
    targetUptime: 99.995,
    baseLatencyMs: 11,
    varianceMs: 3,
    defaultStatus: "operational",
  },

  // --- Infrastructure & Delivery ---
  {
    id: "artifact-registry",
    name: "Artifact & Container Registry",
    category: "infra",
    description:
      "Immutable OCI image storage, vulnerability scanning, and provenance attestation verification.",
    targetUptime: 99.98,
    baseLatencyMs: 38,
    varianceMs: 12,
    defaultStatus: "operational",
  },
  {
    id: "github-cicd",
    name: "Deployment Pipelines & Workload Identity",
    category: "infra",
    description:
      "Automated CI verification, GitHub Actions deployment pipelines, and GCP OIDC federation.",
    appUrl: "https://github.com",
    targetUptime: 99.97,
    baseLatencyMs: 45,
    varianceMs: 15,
    defaultStatus: "operational",
    incidentOverrides: {
      "2026-08-27": {
        status: "degraded_performance",
        count: 1,
        desc: "Upstream OIDC latency during Workload Identity token federation (resolved).",
        uptimePct: 99.6,
      },
    },
  },
];

/**
 * Builds the runtime ServiceComponent data structure with full 90-day history and 24h metrics.
 */
export function buildMonitoredService(
  config: MonitoredServiceConfig,
  overrides?: Partial<ServiceComponent>,
  now: Date = new Date(),
): ServiceComponent {
  const currentStatus =
    overrides?.status ?? config.defaultStatus ?? "operational";

  const days = generate90DayHistory(
    config.id,
    config.targetUptime,
    config.incidentOverrides,
    now,
    currentStatus,
  );

  const metrics24h = generate24hMetrics(
    config.baseLatencyMs,
    config.varianceMs,
    now,
  );

  // Compute 90d uptime
  const uptimeSum = days.reduce((sum, d) => sum + d.uptimePercentage, 0);
  const uptime90d = Number((uptimeSum / days.length).toFixed(3));

  return {
    id: config.id,
    name: config.name,
    category: config.category,
    description: config.description,
    status: overrides?.status ?? config.defaultStatus ?? "operational",
    appUrl: config.appUrl,
    healthEndpoint: config.healthEndpoint,
    uptime90d,
    currentLatencyMs: overrides?.currentLatencyMs ?? config.baseLatencyMs,
    days,
    metrics24h,
    ...overrides,
  };
}

/**
 * Returns all monitored services initialized with their current status and history.
 */
export function getAllMonitoredServices(
  overrides?: Record<string, Partial<ServiceComponent>>,
  now: Date = new Date(),
): ServiceComponent[] {
  return MONITORED_SERVICES_CONFIG.map((config) =>
    buildMonitoredService(config, overrides?.[config.id], now),
  );
}

/**
 * Constructs an application configuration for monitoring.
 */
export function createMonitoredAppConfig(
  app: Omit<MonitoredServiceConfig, "category">,
): MonitoredServiceConfig {
  return {
    ...app,
    category: "apps",
  };
}

/**
 * Registers an application configuration in the runtime monitored registry.
 */
export function registerService(config: MonitoredServiceConfig): void {
  const existingIdx = MONITORED_SERVICES_CONFIG.findIndex(
    (s) => s.id === config.id,
  );
  if (existingIdx >= 0) {
    MONITORED_SERVICES_CONFIG[existingIdx] = config;
  } else {
    MONITORED_SERVICES_CONFIG.push(config);
  }
}
