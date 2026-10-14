/**
 * Architecture B: Long-Term Persistent Uptime Telemetry via Google BigQuery
 *
 * Fetches multi-day, multi-month (>90 days) uptime statistics collected by
 * Google Cloud Monitoring Uptime Checks streamed through Cloud Logging into BigQuery.
 */

export interface DailyUptimeStats {
  date: string; // YYYY-MM-DD
  totalChecks: number;
  successfulChecks: number;
  uptimePercentage: number;
  avgLatencyMs: number;
}

/**
 * Builds standard SQL query to aggregate uptime checks by day over a specified retention window.
 */
export function buildUptimeQuery(
  projectId: string,
  datasetId: string,
  serviceHost: string,
  days: number = 90,
): string {
  const safeDays = Math.min(Math.max(1, Math.round(days)), 3650); // up to 10 years
  return `
    SELECT
      FORMAT_DATE('%Y-%m-%d', DATE(timestamp)) as date,
      COUNT(1) as total_checks,
      COUNTIF(httpRequest.status >= 200 AND httpRequest.status < 300) as successful_checks,
      ROUND(COUNTIF(httpRequest.status >= 200 AND httpRequest.status < 300) * 100.0 / NULLIF(COUNT(1), 0), 2) as uptime_percentage,
      ROUND(AVG(CAST(jsonPayload.latency_ms AS FLOAT64)), 1) as avg_latency_ms
    FROM \`${projectId}.${datasetId}.monitoring_googleapis_com_uptime_check_*\`
    WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${safeDays} DAY)
      AND (
        resource.labels.host = '${serviceHost}'
        OR jsonPayload.host = '${serviceHost}'
      )
    GROUP BY date
    ORDER BY date ASC
  `.trim();
}

/**
 * Retrieves GCP OAuth2 access token when running in Google Cloud Run.
 * Falls back to null when running locally without metadata service.
 */
async function getCloudRunAccessToken(): Promise<string | null> {
  try {
    const res = await fetch(
      "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token",
      {
        headers: { "Metadata-Flavor": "Google" },
        signal: AbortSignal.timeout(1000),
      },
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.access_token || null;
  } catch {
    return null;
  }
}

/**
 * Parses BigQuery query response rows into strongly-typed DailyUptimeStats array.
 */
export function parseBigQueryRows(
  rows: Array<{ f: Array<{ v: string | null }> }>,
): DailyUptimeStats[] {
  return rows.map((row) => {
    const values = row.f.map((cell) => cell.v);
    const date = values[0] || new Date().toISOString().split("T")[0]!;
    const totalChecks = Number(values[1] || 0);
    const successfulChecks = Number(values[2] || 0);
    const uptimePercentage = Number(values[3] || 100.0);
    const avgLatencyMs = Number(values[4] || 0);

    return {
      date,
      totalChecks,
      successfulChecks,
      uptimePercentage,
      avgLatencyMs,
    };
  });
}

/**
 * Fetches historical uptime statistics from BigQuery.
 * Returns null if BigQuery is not configured or in local development.
 */
export async function fetchBigQueryUptimeHistory(
  serviceHost: string,
  days: number = 90,
): Promise<DailyUptimeStats[] | null> {
  const projectId =
    process.env.GCP_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
  const datasetId = process.env.BIGQUERY_DATASET || "uptime_monitoring";

  if (!projectId || !serviceHost) {
    return null;
  }

  const token = await getCloudRunAccessToken();
  if (!token) {
    return null;
  }

  try {
    const query = buildUptimeQuery(projectId, datasetId, serviceHost, days);
    const response = await fetch(
      `https://bigquery.googleapis.com/bigquery/v2/projects/${projectId}/queries`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query,
          useLegacySql: false,
          timeoutMs: 5000,
        }),
        signal: AbortSignal.timeout(6000),
      },
    );

    if (!response.ok) {
      return null;
    }

    const json = await response.json();
    if (!json.rows || !Array.isArray(json.rows)) {
      return [];
    }

    return parseBigQueryRows(json.rows);
  } catch {
    return null;
  }
}
