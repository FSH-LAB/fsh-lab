variable "project_id" {
  type        = string
  description = "GCP Project ID"
}

variable "region" {
  type        = string
  description = "GCP Region for regional GKE cluster"
}

variable "environment" {
  type        = string
  description = "Environment name (dev or production)"
}

variable "network_id" {
  type        = string
  description = "VPC Network ID"
}

variable "subnetwork_id" {
  type        = string
  description = "Subnetwork ID"
}

variable "master_ipv4_cidr_block" {
  type        = string
  description = "CIDR block for GKE control plane"
  default     = "172.16.0.0/28"
}

variable "node_locations" {
  type        = list(string)
  description = "Zones to restrict worker nodes to (or null to use all available regional zones)"
  default     = null
}
