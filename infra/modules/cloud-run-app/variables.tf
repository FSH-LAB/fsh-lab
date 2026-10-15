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
