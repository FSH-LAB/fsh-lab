import type { Incident, ScheduledMaintenance } from "./types";

/**
 * Currently active incidents. Leave empty when all systems are operational.
 */
export const ACTIVE_INCIDENTS: Incident[] = [];

/**
 * Scheduled maintenances.
 */
export const SCHEDULED_MAINTENANCES: ScheduledMaintenance[] = [
  {
    id: "maint-2026-11-04",
    title: "GCP Europe-North2 Regional Cloud Run Kernel Upgrade",
    status: "scheduled",
    affectedServiceIds: ["cloud-run"],
    scheduledStart: "2026-11-04T02:00:00.000Z",
    scheduledEnd: "2026-11-04T03:00:00.000Z",
    description:
      "Routine hypervisor patching across Google Cloud europe-north2. Cloud Run instances will migrate without downtime.",
  },
];

/**
 * Historical incident log covering past 90 days.
 */
export const PAST_INCIDENTS: Incident[] = [
  {
    id: "inc-2026-09-18",
    title: "Brief Latency Elevation on Helgefølelse Ingress",
    impact: "minor",
    status: "resolved",
    affectedServiceIds: ["helgefolelse", "edge-network"],
    createdAt: "2026-09-18T14:12:00.000Z",
    updatedAt: "2026-09-18T14:26:00.000Z",
    resolvedAt: "2026-09-18T14:26:00.000Z",
    updates: [
      {
        id: "up-3",
        timestamp: "2026-09-18T14:26:00.000Z",
        status: "resolved",
        message:
          "Traffic routing has normalized. Response times have dropped back below 25ms. Service is fully restored.",
      },
      {
        id: "up-2",
        timestamp: "2026-09-18T14:19:00.000Z",
        status: "monitoring",
        message:
          "Cloud Run autoscaling added worker capacity and regional edge points adjusted connection pools. Latency is recovering.",
      },
      {
        id: "up-1",
        timestamp: "2026-09-18T14:12:00.000Z",
        status: "investigating",
        message:
          "We are investigating elevated response times (P95 > 450ms) on Helgefølelse web requests during sudden Friday traffic surge.",
      },
    ],
  },
  {
    id: "inc-2026-08-27",
    title: "Upstream Provider API Transient Latency",
    impact: "minor",
    status: "resolved",
    affectedServiceIds: ["github-cicd"],
    createdAt: "2026-08-27T09:30:00.000Z",
    updatedAt: "2026-08-27T10:05:00.000Z",
    resolvedAt: "2026-08-27T10:05:00.000Z",
    updates: [
      {
        id: "up-2",
        timestamp: "2026-08-27T10:05:00.000Z",
        status: "resolved",
        message:
          "Upstream OIDC token verification latency has returned to nominal levels. All queued deployment workflows completed.",
      },
      {
        id: "up-1",
        timestamp: "2026-08-27T09:30:00.000Z",
        status: "investigating",
        message:
          "Intermittent timeouts detected when federating Workload Identity credentials during GitHub Actions runs.",
      },
    ],
  },
];
