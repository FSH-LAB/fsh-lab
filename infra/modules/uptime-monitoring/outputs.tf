output "dataset_id" {
  description = "BigQuery dataset ID containing uptime monitoring records."
  value       = google_bigquery_dataset.uptime_monitoring.dataset_id
}

output "uptime_check_ids" {
  description = "Map of uptime check IDs per monitored service."
  value       = { for k, v in google_monitoring_uptime_check_config.checks : k => v.uptime_check_id }
}

