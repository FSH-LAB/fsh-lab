import { describe, expect, it } from "vitest";
import {
  calculateSystemStatus,
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
    expect(summary.headline).toBe("Major System Outage");
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

  it("returns appropriate badge metadata for all status types", () => {
    expect(getStatusBadgeInfo("operational").label).toBe("Operational");
    expect(getStatusBadgeInfo("degraded_performance").label).toBe(
      "Degraded Performance",
    );
    expect(getStatusBadgeInfo("partial_outage").label).toBe("Partial Outage");
    expect(getStatusBadgeInfo("major_outage").label).toBe("Major Outage");
    expect(getStatusBadgeInfo("maintenance").label).toBe("Maintenance");
  });
});
