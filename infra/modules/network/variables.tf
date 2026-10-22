variable "project_id" {
  type        = string
  description = "GCP Project ID"
}

variable "region" {
  type        = string
  description = "GCP Region"
}

variable "environment" {
  type        = string
  description = "Deployment environment (dev or production)"
}

variable "subnet_cidr" {
  type        = string
  description = "Primary CIDR block for GKE nodes"
  default     = "10.0.0.0/20"
}

variable "pods_cidr" {
  type        = string
  description = "Secondary CIDR block for Kubernetes Pods"
  default     = "10.4.0.0/14"
}

variable "services_cidr" {
  type        = string
  description = "Secondary CIDR block for Kubernetes Services"
  default     = "10.8.0.0/20"
}
