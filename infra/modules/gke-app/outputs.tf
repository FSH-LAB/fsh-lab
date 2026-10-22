output "runtime_service_account" {
  description = "Email of the GKE application runtime service account"
  value       = google_service_account.runtime.email
}

output "artifact_registry_repository" {
  description = "Artifact Registry repository name"
  value       = google_artifact_registry_repository.this.name
}
