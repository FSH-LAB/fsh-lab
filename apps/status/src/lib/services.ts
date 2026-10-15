import { getDailyChecksStore, getServiceTelemetry } from "./probe";
import { generate90DayHistory } from "./status";
import type {
  ProbeType,
  ServiceCategory,
  ServiceComponent,
  ServiceStatus,
} from "./types";

/**
 * Configuration schema for an application or service monitored by the status page.
 */
export interface MonitoredServiceConfig {
  id: string;
  name: string;
  category: ServiceCategory;
  isThirdParty?: boolean;
  description: string;
  appUrl?: string;
  healthEndpoint?: string;
  probeType?: ProbeType;
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
 * Configurable endpoints for monitored applications.
 *
 * Dynamically resolved from environment variables:
 * - HELGEFOLELSE: NEXT_PUBLIC_HELGEFOLELSE_URL / HELGEFOLELSE_URL, HELGEFOLELSE_HEALTH_URL
 * - STATUS: NEXT_PUBLIC_STATUS_URL / STATUS_URL, STATUS_HEALTH_URL
 */
export interface ServiceEndpointConfig {
  appUrl?: string;
  healthEndpoint?: string;
}

export function getServiceEndpoints(serviceId: string): ServiceEndpointConfig {
  switch (serviceId) {
    case "helgefolelse": {
      const appUrl =
        process.env.NEXT_PUBLIC_HELGEFOLELSE_URL ||
        process.env.HELGEFOLELSE_URL ||
        undefined;
      const healthEndpoint =
        process.env.HELGEFOLELSE_HEALTH_URL ||
        (appUrl ? `${appUrl.replace(/\/$/, "")}/api/health` : undefined);
      return { appUrl, healthEndpoint };
    }
    case "status": {
      const appUrl =
        process.env.NEXT_PUBLIC_STATUS_URL ||
        process.env.STATUS_URL ||
        undefined;
      const healthEndpoint =
        process.env.STATUS_HEALTH_URL ||
        (appUrl ? `${appUrl.replace(/\/$/, "")}/api/health` : undefined);
      return { appUrl, healthEndpoint };
    }
    default:
      return {};
  }
}

export const SERVICE_ENDPOINTS: Record<string, ServiceEndpointConfig> =
  new Proxy({} as Record<string, ServiceEndpointConfig>, {
    get(_target, prop: string) {
      return getServiceEndpoints(prop);
    },
  });

const customRegisteredServices: MonitoredServiceConfig[] = [];

/**
 * Returns dynamic configuration for all monitored applications.
 * Dynamically resolves endpoints from environment variables on every call.
 */
export function getMonitoredServicesConfig(): MonitoredServiceConfig[] {
  const base: MonitoredServiceConfig[] = [
    {
      id: "helgefolelse",
      name: "Helgefølelse",
      category: "internal",
      isThirdParty: false,
      description:
        "Public weekend feeling index, tide visualization, and real-time calculation engine.",
      ...getServiceEndpoints("helgefolelse"),
      probeType: "http_probe",
      targetUptime: 99.99,
      baseLatencyMs: 0,
      varianceMs: 0,
      defaultStatus: "operational",
    },
  ];

  for (const custom of customRegisteredServices) {
    const idx = base.findIndex((s) => s.id === custom.id);
    if (idx >= 0) {
      base[idx] = custom;
    } else {
      base.push(custom);
    }
  }

  return base;
}

/**
 * Dynamic registry of all monitored services across the FSH Lab ecosystem.
 * Directly backed by environment variables without hardcoded endpoints.
 */
export const MONITORED_SERVICES_CONFIG: MonitoredServiceConfig[] = new Proxy(
  [] as MonitoredServiceConfig[],
  {
    get(_target, prop) {
      const current = getMonitoredServicesConfig();
      if (prop === "length") return current.length;
      if (prop === Symbol.iterator)
        return current[Symbol.iterator].bind(current);
      if (typeof prop === "string" && !isNaN(Number(prop)))
        return current[Number(prop)];
      const val = (current as unknown as Record<string, unknown>)[
        prop as string
      ];
      return typeof val === "function" ? val.bind(current) : val;
    },
  },
);

/**
 * Builds the runtime ServiceComponent data structure with real history and telemetry.
 */
export function buildMonitoredService(
  config: MonitoredServiceConfig,
  overrides?: Partial<ServiceComponent>,
  now: Date = new Date(),
): ServiceComponent {
  const currentStatus =
    overrides?.status ?? config.defaultStatus ?? "operational";
  const currentLatency =
    overrides?.currentLatencyMs ?? config.baseLatencyMs ?? 0;

  const storedDailyChecks = getDailyChecksStore()[config.id];

  const days = generate90DayHistory(
    config.id,
    config.targetUptime,
    config.incidentOverrides,
    now,
    currentStatus,
    undefined,
    storedDailyChecks,
  );

  // Retrieve real observed telemetry points
  const realTelemetry = getServiceTelemetry(config.id);

  // Compute 90d uptime over measured days only
  const measuredDays = days.filter((d) => d.uptimePercentage !== null);
  const uptimeSum = measuredDays.reduce(
    (sum, d) => sum + (d.uptimePercentage ?? 0),
    0,
  );
  const uptime90d =
    measuredDays.length > 0
      ? Number((uptimeSum / measuredDays.length).toFixed(3))
      : 100.0;

  return {
    id: config.id,
    name: config.name,
    category: config.category,
    isThirdParty: config.isThirdParty ?? false,
    description: config.description,
    status: currentStatus,
    probeType: config.probeType ?? "http_probe",
    appUrl: config.appUrl,
    healthEndpoint:
      config.healthEndpoint ||
      (config.appUrl
        ? `${config.appUrl.replace(/\/$/, "")}/api/health`
        : undefined),
    uptime90d,
    currentLatencyMs: currentLatency,
    days,
    metrics24h: realTelemetry,
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
  app: Omit<MonitoredServiceConfig, "category" | "isThirdParty">,
): MonitoredServiceConfig {
  return {
    ...app,
    category: "internal",
    isThirdParty: false,
  };
}

/**
 * Registers an application configuration in the runtime monitored registry.
 */
export function registerService(config: MonitoredServiceConfig): void {
  const existingIdx = customRegisteredServices.findIndex(
    (s) => s.id === config.id,
  );
  if (existingIdx >= 0) {
    customRegisteredServices[existingIdx] = config;
  } else {
    customRegisteredServices.push(config);
  }
}
