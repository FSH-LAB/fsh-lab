output "service_urls" {
  description = "Cloud Run URL per app."
  value = {
    for app, m in module.cloud_run_apps : app => m.service_url
  }
}

output "github_variables" {
  description = "Values for the GitHub environment (managed in infra/github)."
  value = {
    GCP_PROJECT_ID             = google_project.environment.project_id
    GCP_WIF_PROVIDER           = google_iam_workload_identity_pool_provider.github.name
    GCP_DEPLOY_SERVICE_ACCOUNT = google_service_account.deployer.email
    GCP_INFRA_SERVICE_ACCOUNT  = google_service_account.infra_applier.email
  }
}

output "uptime_monitoring" {
  description = "Architecture B BigQuery dataset and uptime check configurations."
  value = {
    dataset_id       = module.uptime_monitoring.dataset_id
    uptime_check_ids = module.uptime_monitoring.uptime_check_ids
  }
}
