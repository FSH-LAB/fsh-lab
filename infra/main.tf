locals {
  region = "europe-north2"

  services = toset([
    "artifactregistry.googleapis.com",
    "bigquery.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "logging.googleapis.com",
    "monitoring.googleapis.com",
    "run.googleapis.com",
    "storage.googleapis.com",
    "sts.googleapis.com",
  ])

  # The deploy workflow runs Terraform as this account. It deliberately cannot
  # change project IAM, service accounts or OIDC trust: those need an operator.
  deployer_roles = toset([
    "roles/viewer",
    "roles/iam.securityReviewer",
    "roles/iam.workloadIdentityPoolViewer",
    "roles/artifactregistry.admin",
    "roles/bigquery.admin",
    "roles/logging.configWriter",
    "roles/monitoring.admin",
    "roles/run.admin",
    "roles/serviceusage.serviceUsageAdmin",
  ])

  # Dedicated Infrastructure CI account for gitops terraform runs with delegated role grants.
  infra_roles = toset([
    "roles/viewer",
    "roles/iam.securityReviewer",
    "roles/iam.workloadIdentityPoolViewer",
    "roles/artifactregistry.admin",
    "roles/bigquery.admin",
    "roles/logging.configWriter",
    "roles/monitoring.admin",
    "roles/run.admin",
    "roles/serviceusage.serviceUsageAdmin",
    "roles/iam.serviceAccountCreator",
    "roles/iam.serviceAccountDeleter",
    "roles/iam.serviceAccountUser",
  ])

  # Auto-discover application manifests located at apps/*/infra.json
  app_files = fileset("${path.module}/../apps", "*/infra.json")

  apps = {
    for file in local.app_files :
    dirname(file) => jsondecode(file("${path.module}/../apps/${file}"))
  }

  # Only the infra.yml workflow on main may impersonate the infra applier.
  infra_applier_principal_attribute = "attribute.job_workflow_ref/${var.github_repository}/.github/workflows/infra.yml@refs/heads/main"
}

# ---------------------------------------------------------------------------
# Platform: shared by every app in the environment.
# Several identifiers below still say "helgefolelse" because GCP project IDs,
# service account IDs and the state prefix cannot be renamed in place.
# ---------------------------------------------------------------------------

resource "google_project" "environment" {
  project_id          = var.project_id
  name                = var.project_name
  folder_id           = var.folder_id
  billing_account     = var.billing_account_id
  auto_create_network = false
  deletion_policy     = "PREVENT"

  lifecycle {
    prevent_destroy = true
    # Billing is linked once by an operator; adopted projects keep their creation-time network setting.
    ignore_changes = [billing_account, auto_create_network]
  }
}

resource "google_project_service" "required" {
  for_each = local.services

  project            = google_project.environment.project_id
  service            = each.value
  disable_on_destroy = false
}

resource "google_storage_bucket" "state" {
  project                     = google_project.environment.project_id
  name                        = "${var.project_id}-terraform-state"
  location                    = local.region
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  force_destroy               = false

  versioning {
    enabled = true
  }

  depends_on = [google_project_service.required]

  lifecycle {
    prevent_destroy = true
  }
}

resource "google_service_account" "deployer" {
  project      = google_project.environment.project_id
  account_id   = "helgefolelse-deployer"
  display_name = "Helgefolelse GitHub deployer"

  depends_on = [google_project_service.required]

  lifecycle {
    prevent_destroy = true
  }
}

resource "google_project_iam_member" "deployer" {
  for_each = local.deployer_roles

  project = google_project.environment.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.deployer.email}"
}

resource "google_storage_bucket_iam_member" "deployer_state" {
  bucket = google_storage_bucket.state.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.deployer.email}"

  condition {
    title      = "environment-state-only"
    expression = "resource.name.startsWith('projects/_/buckets/${google_storage_bucket.state.name}/objects/fsh-lab/${var.environment}/') || resource.name.startsWith('projects/_/buckets/${google_storage_bucket.state.name}/objects/helgefolelse/${var.environment}/')"
  }
}

resource "google_service_account" "infra_applier" {
  project      = google_project.environment.project_id
  account_id   = "fsh-lab-infra"
  display_name = "FSH-LAB Terraform Infrastructure Applier"

  depends_on = [google_project_service.required]

  lifecycle {
    prevent_destroy = true
  }
}

resource "google_project_iam_member" "infra_applier" {
  for_each = local.infra_roles

  project = google_project.environment.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.infra_applier.email}"
}

resource "google_project_iam_member" "infra_applier_iam_admin" {
  project = google_project.environment.project_id
  role    = "roles/resourcemanager.projectIamAdmin"
  member  = "serviceAccount:${google_service_account.infra_applier.email}"

  condition {
    title       = "delegated-role-grants-only"
    description = "Allows granting only strictly necessary runtime roles to application service accounts"
    expression  = "api.getAttribute('iam.googleapis.com/modifiedGrantsByRole', []).hasOnly(['roles/run.invoker', 'roles/secretmanager.secretAccessor', 'roles/logging.logWriter', 'roles/monitoring.metricWriter', 'roles/bigquery.jobUser', 'roles/iam.serviceAccountUser'])"
  }
}

resource "google_project_iam_member" "infra_applier_service_account_admin" {
  project = google_project.environment.project_id
  role    = "roles/iam.serviceAccountAdmin"
  member  = "serviceAccount:${google_service_account.infra_applier.email}"

  condition {
    title       = "runtime-service-accounts-only"
    description = "Allows managing IAM policies only for application runtime service accounts (*-runtime)"
    expression  = "resource.type == 'iam.googleapis.com/ServiceAccount' && resource.name.endsWith('-runtime@${google_project.environment.project_id}.iam.gserviceaccount.com')"
  }
}

resource "google_storage_bucket_iam_member" "infra_applier_state" {
  bucket = google_storage_bucket.state.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.infra_applier.email}"

  condition {
    title      = "environment-state-only"
    expression = "resource.name.startsWith('projects/_/buckets/${google_storage_bucket.state.name}/objects/fsh-lab/${var.environment}/') || resource.name.startsWith('projects/_/buckets/${google_storage_bucket.state.name}/objects/helgefolelse/${var.environment}/')"
  }
}

resource "google_iam_workload_identity_pool" "github" {
  project                   = google_project.environment.number
  workload_identity_pool_id = "github-actions"
  display_name              = "GitHub Actions"

  depends_on = [google_project_service.required]

  lifecycle {
    prevent_destroy = true
  }
}

resource "google_iam_workload_identity_pool_provider" "github" {
  project                            = google_project.environment.number
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = "github"
  # GCP caps provider display names at 32 characters.
  display_name = "FSH-LAB ${var.environment == "production" ? "prod" : var.environment} deployments"
  attribute_mapping = {
    "google.subject"             = "assertion.sub"
    "attribute.repository"       = "assertion.repository"
    "attribute.ref"              = "assertion.ref"
    "attribute.environment"      = "assertion.environment"
    "attribute.job_workflow_ref" = "has(assertion.job_workflow_ref) ? assertion.job_workflow_ref : assertion.workflow_ref"
  }
  attribute_condition = "assertion.repository == '${var.github_repository}' && assertion.ref == 'refs/heads/main' && assertion.environment == '${var.environment}'"

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

resource "google_service_account_iam_member" "github_deployer" {
  service_account_id = google_service_account.deployer.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.environment/${var.environment}"
}

resource "google_service_account_iam_member" "github_infra_applier" {
  service_account_id = google_service_account.infra_applier.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/${local.infra_applier_principal_attribute}"
}

# ---------------------------------------------------------------------------
# Apps: auto-discovered modules under apps/*/infra.json. See infra/README.md.
# ---------------------------------------------------------------------------

module "cloud_run_apps" {
  for_each = local.apps
  source   = "./modules/cloud-run-app"

  app           = each.key
  display_name  = each.value.displayName
  cpu           = try(each.value.cpu, "1000m")
  memory        = try(each.value.memory, "512Mi")
  min_instances = try(each.value.minInstances, 0)
  max_instances = try(each.value.maxInstances, 3)
  env_vars = merge(
    try(each.value.env, {}),
    each.key == "status" ? {
      GCP_PROJECT_ID          = google_project.environment.project_id
      BIGQUERY_DATASET        = "uptime_monitoring"
      HELGEFOLELSE_HEALTH_URL = var.environment == "production" ? "https://helgefolelse.no/api/health" : "https://helgefolelse-web-${google_project.environment.number}.${local.region}.run.app/api/health"
      HELGEFOLELSE_URL        = var.environment == "production" ? "https://helgefolelse.no" : "https://helgefolelse-web-${google_project.environment.number}.${local.region}.run.app"
    } : {}
  )
  is_public = try(each.value.public, true)

  project_id     = google_project.environment.project_id
  region         = local.region
  deployer_email = google_service_account.deployer.email

  depends_on = [google_project_service.required]
}

# ---------------------------------------------------------------------------
# Architecture B: Uptime Checks & Long-Term Telemetry in BigQuery (>90 Days)
# ---------------------------------------------------------------------------

module "uptime_monitoring" {
  source = "./modules/uptime-monitoring"

  project_id  = google_project.environment.project_id
  environment = var.environment
  region      = local.region

  monitored_services = {
    for app, m in module.cloud_run_apps : app => {
      display_name = local.apps[app].displayName
      host         = replace(replace(m.service_url, "https://", ""), "/", "")
      path         = try(local.apps[app].healthPath, "/api/health")
      period       = try(local.apps[app].uptimePeriod, "60s")
      timeout      = try(local.apps[app].uptimeTimeout, "10s")
    }
  }

  status_runtime_service_account_email = module.cloud_run_apps["status"].runtime_service_account

  depends_on = [google_project_service.required]
}

# Migrate single modules into the for_each cloud_run_apps module
moved {
  from = module.helgefolelse
  to   = module.cloud_run_apps["helgefolelse"]
}

moved {
  from = module.status
  to   = module.cloud_run_apps["status"]
}

# Adopts the resources that were declared inline before the module existed.
# Safe to delete once every environment has applied them.
moved {
  from = google_artifact_registry_repository.web
  to   = module.cloud_run_apps["helgefolelse"].google_artifact_registry_repository.this
}

moved {
  from = google_service_account.runtime
  to   = module.cloud_run_apps["helgefolelse"].google_service_account.runtime
}

moved {
  from = google_cloud_run_v2_service.web
  to   = module.cloud_run_apps["helgefolelse"].google_cloud_run_v2_service.this
}

moved {
  from = google_service_account_iam_member.runtime_user
  to   = module.cloud_run_apps["helgefolelse"].google_service_account_iam_member.deployer_acts_as_runtime
}
