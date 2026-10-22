# ---------------------------------------------------------------------------
# BigQuery Dataset for Long-Term Uptime & Telemetry Storage (> 90 Days)
# ---------------------------------------------------------------------------

resource "google_bigquery_dataset" "uptime_monitoring" {
  project     = var.project_id
  dataset_id  = "uptime_monitoring"
  location    = var.region
  description = "Persistent uptime check telemetry, logs, and health history (> 90 days retention)"

  labels = {
    environment = var.environment
    managed_by  = "terraform"
  }

  lifecycle {
    ignore_changes = [location]
  }
}

# ---------------------------------------------------------------------------
# Google Cloud Monitoring Uptime Checks
# ---------------------------------------------------------------------------

resource "google_monitoring_uptime_check_config" "checks" {
  for_each = var.monitored_services

  project      = var.project_id
  display_name = "${var.environment}-${each.key}-uptime-check"
  timeout      = each.value.timeout
  period       = each.value.period

  http_check {
    path           = each.value.path
    port           = 443
    use_ssl        = true
    validate_ssl   = true
    request_method = "GET"
    accepted_response_status_codes {
      status_class = "STATUS_CLASS_2XX"
    }
  }

  monitored_resource {
    type = "uptime_url"
    labels = {
      project_id = var.project_id
      host       = each.value.host
    }
  }

  content_matchers {
    content = "\"status\":\"ok\""
    matcher = "CONTAINS_STRING"
  }
}

# ---------------------------------------------------------------------------
# BigQuery Table with Explicit Schema for Uptime Checks
# ---------------------------------------------------------------------------

resource "google_bigquery_table" "uptime_checks" {
  project     = var.project_id
  dataset_id  = google_bigquery_dataset.uptime_monitoring.dataset_id
  table_id    = "uptime_checks"
  description = "Recorded health probe check outcomes and latencies"

  time_partitioning {
    type  = "DAY"
    field = "timestamp"
  }

  schema = jsonencode([
    { name = "timestamp", type = "TIMESTAMP", mode = "REQUIRED" },
    { name = "event", type = "STRING", mode = "NULLABLE" },
    { name = "service_id", type = "STRING", mode = "REQUIRED" },
    { name = "host", type = "STRING", mode = "REQUIRED" },
    { name = "status", type = "INTEGER", mode = "REQUIRED" },
    { name = "latency_ms", type = "FLOAT", mode = "NULLABLE" },
    { name = "success", type = "BOOLEAN", mode = "REQUIRED" }
  ])

  lifecycle {
    prevent_destroy = true
  }
}

# ---------------------------------------------------------------------------
# Cloud Logging Sink: Routes Uptime Logs into BigQuery
# ---------------------------------------------------------------------------

resource "google_logging_project_sink" "uptime_to_bigquery" {
  project                = var.project_id
  name                   = "${var.environment}-uptime-to-bigquery"
  destination            = "bigquery.googleapis.com/projects/${var.project_id}/datasets/${google_bigquery_dataset.uptime_monitoring.dataset_id}"
  filter                 = "jsonPayload.event=\"uptime_check\" OR (resource.type=\"cloud_run_revision\" AND httpRequest.requestUrl=~\"/api/health\")"
  unique_writer_identity = true

  bigquery_options {
    use_partitioned_tables = true
  }
}

# Grants writer identity permission to insert rows into BigQuery
resource "google_bigquery_dataset_access" "logging_sink_writer" {
  project       = var.project_id
  dataset_id    = google_bigquery_dataset.uptime_monitoring.dataset_id
  role          = "WRITER"
  user_by_email = replace(google_logging_project_sink.uptime_to_bigquery.writer_identity, "serviceAccount:", "")
}

# Grants the status app runtime service account read access to query historical uptime
resource "google_bigquery_dataset_access" "status_runtime_reader" {
  project       = var.project_id
  dataset_id    = google_bigquery_dataset.uptime_monitoring.dataset_id
  role          = "READER"
  user_by_email = var.status_runtime_service_account_email
}

resource "google_project_iam_member" "status_runtime_bq_job_user" {
  project = var.project_id
  role    = "roles/bigquery.jobUser"
  member  = "serviceAccount:${var.status_runtime_service_account_email}"
}

