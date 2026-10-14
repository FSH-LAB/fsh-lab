import { describe, expect, it } from "vitest";
import {
  buildUptimeQuery,
  parseBigQueryRows,
  fetchBigQueryUptimeHistory,
} from "./bigquery";

describe("Architecture B BigQuery client", () => {
  it("builds valid BigQuery SQL query with specified retention days", () => {
    const query = buildUptimeQuery(
      "test-project",
      "uptime_monitoring",
      "helgefolelse.no",
      180,
    );

    expect(query).toContain(
      "`test-project.uptime_monitoring.monitoring_googleapis_com_uptime_check_*`",
    );
    expect(query).toContain("INTERVAL 180 DAY");
    expect(query).toContain("helgefolelse.no");
    expect(query).toContain("GROUP BY date");
  });

  it("clamps retention days safely to avoid invalid intervals", () => {
    const minQuery = buildUptimeQuery("proj", "ds", "host", -10);
    expect(minQuery).toContain("INTERVAL 1 DAY");

    const maxQuery = buildUptimeQuery("proj", "ds", "host", 50000);
    expect(maxQuery).toContain("INTERVAL 3650 DAY");
  });

  it("parses BigQuery JSON rows into DailyUptimeStats correctly", () => {
    const mockRows = [
      {
        f: [
          { v: "2026-10-14" },
          { v: "1440" },
          { v: "1438" },
          { v: "99.86" },
          { v: "34.5" },
        ],
      },
      {
        f: [
          { v: "2026-10-13" },
          { v: "1440" },
          { v: "1440" },
          { v: "100.0" },
          { v: "28.1" },
        ],
      },
    ];

    const stats = parseBigQueryRows(mockRows);
    expect(stats).toHaveLength(2);
    expect(stats[0]).toEqual({
      date: "2026-10-14",
      totalChecks: 1440,
      successfulChecks: 1438,
      uptimePercentage: 99.86,
      avgLatencyMs: 34.5,
    });
    expect(stats[1]?.uptimePercentage).toBe(100.0);
  });

  it("returns null in local environments without GCP metadata service", async () => {
    const result = await fetchBigQueryUptimeHistory("helgefolelse.no", 90);
    expect(result).toBeNull();
  });
});
