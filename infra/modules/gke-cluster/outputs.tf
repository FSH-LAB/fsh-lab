output "cluster_name" {
  description = "The name of the GKE cluster"
  value       = google_container_cluster.primary.name
}

output "cluster_id" {
  description = "The ID of the GKE cluster"
  value       = google_container_cluster.primary.id
}

output "cluster_endpoint" {
  description = "The IP address of the cluster control plane"
  value       = google_container_cluster.primary.endpoint
}
