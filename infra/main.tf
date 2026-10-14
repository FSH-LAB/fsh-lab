locals {
  region = "europe-north2"

  services = toset([
    "artifactregistry.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
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
    "roles/run.admin",
    "roles/serviceusage.serviceUsageAdmin",
  ])
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
    expression = "resource.name.startsWith('projects/_/buckets/${google_storage_bucket.state.name}/objects/helgefolelse/${var.environment}/')"
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
    "google.subject"        = "assertion.sub"
    "attribute.repository"  = "assertion.repository"
    "attribute.ref"         = "assertion.ref"
    "attribute.environment" = "assertion.environment"
  }
  attribute_condition = "(assertion.repository == '${var.github_repository}' || assertion.repository == 'FSH-LAB/helgefolelse') && assertion.ref == 'refs/heads/main' && assertion.environment == '${var.environment}'"

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

resource "google_service_account_iam_member" "github_deployer" {
  service_account_id = google_service_account.deployer.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.environment/${var.environment}"
}

# ---------------------------------------------------------------------------
# Apps: one module per deployable app under apps/. See infra/README.md.
# ---------------------------------------------------------------------------

module "helgefolelse" {
  source = "./modules/cloud-run-app"

  app            = "helgefolelse"
  display_name   = "Helgef\u00f8lelse"
  project_id     = google_project.environment.project_id
  region         = local.region
  deployer_email = google_service_account.deployer.email

  depends_on = [google_project_service.required]
}

# Adopts the resources that were declared inline before the module existed.
# Safe to delete once every environment has applied them.
moved {
  from = google_artifact_registry_repository.web
  to   = module.helgefolelse.google_artifact_registry_repository.this
}

moved {
  from = google_service_account.runtime
  to   = module.helgefolelse.google_service_account.runtime
}

moved {
  from = google_cloud_run_v2_service.web
  to   = module.helgefolelse.google_cloud_run_v2_service.this
}

moved {
  from = google_service_account_iam_member.runtime_user
  to   = module.helgefolelse.google_service_account_iam_member.deployer_acts_as_runtime
}
