variable "project_id" {
  type        = string
  description = "GCP Project ID."
}

variable "environment" {
  type        = string
  description = "Deployment environment (dev, production)."
}

variable "region" {
  type        = string
  description = "GCP Region for BigQuery dataset."
  default     = "europe-north2"
}

variable "monitored_services" {
  type = map(object({
    display_name = string
    host         = string
    path         = optional(string, "/api/health")
    period       = optional(string, "60s")
    timeout      = optional(string, "10s")
  }))
  description = "Map of services to monitor with Cloud Monitoring Uptime Checks."
}

variable "status_runtime_service_account_email" {
  type        = string
  description = "Email of the status service account allowed to query BigQuery."
  default     = ""
}

