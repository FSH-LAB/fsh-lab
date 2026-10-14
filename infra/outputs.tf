output "service_urls" {
  description = "Cloud Run URL per app."
  value = {
    helgefolelse = module.helgefolelse.service_url
    status       = module.status.service_url
  }
}

output "github_variables" {
  description = "Values for the GitHub environment (managed in infra/github)."
  value = {
    GCP_PROJECT_ID             = google_project.environment.project_id
    GCP_WIF_PROVIDER           = google_iam_workload_identity_pool_provider.github.name
    GCP_DEPLOY_SERVICE_ACCOUNT = google_service_account.deployer.email
  }
}
