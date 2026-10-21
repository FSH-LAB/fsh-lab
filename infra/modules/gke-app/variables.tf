variable "app" {
  type        = string
  description = "Application name (matches directory under apps/)"

  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{1,20}[a-z0-9]$", var.app))
    error_message = "App name must be 3-22 chars of lowercase letters, digits, or hyphens."
  }
}

variable "display_name" {
  type        = string
  description = "Human-readable application name"
}

variable "project_id" {
  type        = string
  description = "GCP Project ID"
}

variable "region" {
  type        = string
  description = "GCP Region"
}

variable "secrets" {
  type        = set(string)
  default     = []
  description = "Secret names to declare in Secret Manager for this application"
}

variable "deployer_email" {
  type        = string
  description = "Email of the deployer service account"
}
