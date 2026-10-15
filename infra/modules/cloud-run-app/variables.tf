variable "app" {
  description = "Application name; matches the apps/<app> directory. Resources are named <app>, <app>-web and <app>-runtime."
  type        = string

  validation {
    # Service accounts allow 30 characters, so "<app>-runtime" caps the name at 22.
    condition     = can(regex("^[a-z][a-z0-9-]{1,20}[a-z0-9]$", var.app))
    error_message = "App names must be 3-22 lowercase letters, digits or hyphens."
  }
}

variable "display_name" {
  description = "Human-readable application name used in descriptions."
  type        = string
}

variable "project_id" {
  type = string
}

variable "region" {
  type = string
}

variable "deployer_email" {
  description = "Service account the deploy workflow uses; it must be able to act as the runtime account."
  type        = string
}

variable "cpu" {
  description = "CPU limit for the container (e.g. 1000m, 2000m)."
  type        = string
  default     = "1000m"
}

variable "memory" {
  description = "Memory limit for the container (e.g. 512Mi, 1Gi)."
  type        = string
  default     = "512Mi"
}

variable "min_instances" {
  description = "Minimum number of container instances."
  type        = number
  default     = 0
}

variable "max_instances" {
  description = "Maximum number of container instances."
  type        = number
  default     = 3
}

variable "env_vars" {
  description = "Environment variables for the container."
  type        = map(string)
  default     = {}
}

variable "is_public" {
  description = "Whether the Cloud Run service allows unauthenticated public access."
  type        = bool
  default     = true
}
