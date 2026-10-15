import { describe, expect, it } from "vitest";
import {
  calculateSystemStatus,
  generate24hMetrics,
  generate90DayHistory,
  getStatusBadgeInfo,
} from "./status";
import type { Incident, ServiceComponent } from "./types";

describe("status logic", () => {
  it("generates exactly 90 days of uptime history", () => {
    const fixedDate = new Date("2026-10-14T10:00:00.000Z");
    const history = generate90DayHistory("test", 99.99, {}, fixedDate);

    expect(history).toHaveLength(90);
    expect(history[89]?.date).toBe("2026-10-14");
    expect(history[0]?.date).toBe("2026-07-17");
  });

  it("applies incident overrides to history", () => {
    const fixedDate = new Date("2026-10-14T10:00:00.000Z");
    const history = generate90DayHistory(
      "test",
      99.99,
      {
        "2026-10-10": {
          status: "degraded_performance",
          count: 1,
          desc: "Partial degradation",
          uptimePct: 95.5,
        },
      },
      fixedDate,
    );

    const targetDay = history.find((d) => d.date === "2026-10-10");
    expect(targetDay).toBeDefined();
    expect(targetDay?.status).toBe("degraded_performance");
    expect(targetDay?.uptimePercentage).toBe(95.5);
    expect(targetDay?.incidentCount).toBe(1);
  });

  it("derives today's uptime entry from active outage observations", () => {
    const fixedDate = new Date("2026-10-14T10:00:00.000Z");
    const history = generate90DayHistory(
      "test",
      99.99,
      {},
      fixedDate,
      "major_outage",
    );

    const today = history[history.length - 1];
    expect(today?.date).toBe("2026-10-14");
    expect(today?.status).toBe("major_outage");
    expect(today?.uptimePercentage).toBe(0);
    expect(today?.incidentCount).toBe(1);
  });

  it("calculates all systems operational when clean", () => {
    const mockServices: ServiceComponent[] = [
      {
        id: "app1",
        name: "App 1",
        category: "apps",
        description: "Test app",
        status: "operational",
        uptime90d: 99.99,
        currentLatencyMs: 20,
        days: [],
        metrics24h: { avgLatencyMs: 20, p95LatencyMs: 25, points: [] },
      },
    ];

    const summary = calculateSystemStatus(mockServices, []);
    expect(summary.level).toBe("operational");
    expect(summary.headline).toBe("All Systems Operational");
    expect(summary.activeIncidentsCount).toBe(0);
    expect(summary.totalServicesCount).toBe(1);
    expect(summary.operationalServicesCount).toBe(1);
  });

  it("escalates system status when a service has an outage", () => {
    const mockServices: ServiceComponent[] = [
      {
        id: "app1",
        name: "App 1",
        category: "apps",
        description: "Test app",
        status: "major_outage",
        uptime90d: 98.0,
        currentLatencyMs: 0,
        days: [],
        metrics24h: { avgLatencyMs: 0, p95LatencyMs: 0, points: [] },
      },
    ];

    const summary = calculateSystemStatus(mockServices, []);
    expect(summary.level).toBe("major_outage");
    expect(summary.headline).toBe("1 of 1 services currently unavailable");
  });

  it("escalates system status when an active critical incident exists", () => {
    const mockServices: ServiceComponent[] = [
      {
        id: "app1",
        name: "App 1",
        category: "apps",
        description: "Test app",
        status: "operational",
        uptime90d: 100,
        currentLatencyMs: 15,
        days: [],
        metrics24h: { avgLatencyMs: 15, p95LatencyMs: 18, points: [] },
      },
    ];

    const activeIncidents: Incident[] = [
      {
        id: "inc-1",
        title: "DNS Outage",
        impact: "critical",
        status: "investigating",
        affectedServiceIds: ["app1"],
        createdAt: "2026-10-14T10:00:00.000Z",
        updatedAt: "2026-10-14T10:00:00.000Z",
        updates: [],
      },
    ];

    const summary = calculateSystemStatus(mockServices, activeIncidents);
    expect(summary.level).toBe("major_outage");
    expect(summary.activeIncidentsCount).toBe(1);
  });

  it("escalates system status to maintenance when active maintenance is in progress", () => {
    const mockServices: ServiceComponent[] = [
      {
        id: "app1",
        name: "App 1",
        category: "apps",
        description: "Test app",
        status: "operational",
        uptime90d: 100,
        currentLatencyMs: 15,
        days: [],
        metrics24h: { avgLatencyMs: 15, p95LatencyMs: 18, points: [] },
      },
    ];

    const maintenances = [
      {
        id: "m-1",
        title: "Kernel upgrade",
        status: "in_progress" as const,
        affectedServiceIds: ["app1"],
        scheduledStart: "2026-10-14T10:00:00Z",
        scheduledEnd: "2026-10-14T11:00:00Z",
        description: "Patching kernel",
      },
    ];

    const summary = calculateSystemStatus(mockServices, [], maintenances);
    expect(summary.level).toBe("maintenance");
    expect(summary.headline).toBe("Scheduled Maintenance in Progress");
    expect(summary.activeMaintenanceCount).toBe(1);
  });

  it("represents unmeasured past days as unknown and measures today truthfully", () => {
    const fixedDate = new Date("2026-10-14T10:00:00.000Z");
    const history = generate90DayHistory("test-service", 100, {}, fixedDate);

    // Past 89 days without observations are represented as unknown
    for (let i = 0; i < 89; i++) {
      expect(history[i]?.status).toBe("unknown");
      expect(history[i]?.uptimePercentage).toBeNull();
      expect(history[i]?.incidentCount).toBe(0);
    }

    // Today is measured from live observation / checks
    const today = history[89];
    expect(today?.date).toBe("2026-10-14");
    expect(today?.status).toBe("operational");
    expect(today?.uptimePercentage).toBe(100);
  });

  it("calculates daily availability from stored check results and retains outages after recovery", () => {
    const fixedDate = new Date("2026-10-14T10:00:00.000Z");
    const storedChecks = {
      "2026-10-14": {
        totalChecks: 10,
        successfulChecks: 9,
        outages: 1,
        degraded: 0,
      },
    };

    // Even if currentStatus has recovered to "operational", today retains the outage
    const history = generate90DayHistory(
      "test-service",
      100,
      {},
      fixedDate,
      "operational",
      null,
      storedChecks,
    );

    const today = history[89];
    expect(today?.status).toBe("partial_outage");
    expect(today?.uptimePercentage).toBe(90);
    expect(today?.incidentCount).toBe(1);
  });

  it("displays degraded performance headline when an active minor incident exists with operational services", () => {
    const mockServices: ServiceComponent[] = [
      {
        id: "app1",
        name: "App 1",
        category: "apps",
        description: "Test app",
        status: "operational",
        uptime90d: 100,
        currentLatencyMs: 20,
        days: [],
        metrics24h: { avgLatencyMs: 20, p95LatencyMs: 25, points: [] },
      },
    ];

    const activeIncidents: Incident[] = [
      {
        id: "inc-minor",
        title: "Latency degradation on partner API",
        impact: "minor",
        status: "investigating",
        affectedServiceIds: ["app1"],
        createdAt: "2026-10-14T10:00:00.000Z",
        updatedAt: "2026-10-14T10:00:00.000Z",
        updates: [],
      },
    ];

    const summary = calculateSystemStatus(mockServices, activeIncidents);
    expect(summary.level).toBe("degraded_performance");
    expect(summary.headline).toBe("Degraded Performance Reported");
    expect(summary.activeIncidentsCount).toBe(1);
  });

  it("calculates latency metrics from real telemetry points correctly", () => {
    const points = [
      { timestamp: "10:00", latencyMs: 20 },
      { timestamp: "11:00", latencyMs: 30 },
      { timestamp: "12:00", latencyMs: 25 },
      { timestamp: "13:00", latencyMs: 45 },
    ];

    const metrics = generate24hMetrics(20, 0, new Date(), points);
    expect(metrics.avgLatencyMs).toBe(30);
    expect(metrics.p95LatencyMs).toBe(45);
    expect(metrics.points).toHaveLength(4);
  });

  it("returns zero metrics and empty points when no telemetry exists", () => {
    const metrics = generate24hMetrics(20);
    expect(metrics.avgLatencyMs).toBe(0);
    expect(metrics.p95LatencyMs).toBe(0);
    expect(metrics.points).toHaveLength(0);
  });

  it("returns appropriate badge metadata for all status types", () => {
    expect(getStatusBadgeInfo("operational").label).toBe("Up");
    expect(getStatusBadgeInfo("degraded_performance").label).toBe("Degraded");
    expect(getStatusBadgeInfo("partial_outage").label).toBe("Down");
    expect(getStatusBadgeInfo("major_outage").label).toBe("Down");
    expect(getStatusBadgeInfo("maintenance").label).toBe("Maintenance");
  });
});
