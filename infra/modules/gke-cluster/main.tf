# GKE Autopilot Cluster: Google manages nodes, security hardening, and OS upgrades.
# Per-Pod billing with native Workload Identity and Gateway API enabled by default.

resource "google_container_cluster" "primary" {
  project  = var.project_id
  name     = "fsh-lab-${var.environment}"
  location = var.region

  enable_autopilot = true
  node_locations   = var.node_locations

  network    = var.network_id
  subnetwork = var.subnetwork_id

  ip_allocation_policy {
    cluster_secondary_range_name  = "pods"
    services_secondary_range_name = "services"
  }

  private_cluster_config {
    enable_private_nodes    = true
    enable_private_endpoint = false
    master_ipv4_cidr_block  = var.master_ipv4_cidr_block
  }

  release_channel {
    channel = "REGULAR"
  }

  deletion_protection = false

  timeouts {
    create = "45m"
    update = "45m"
    delete = "45m"
  }

  lifecycle {
    prevent_destroy = true
  }
}
