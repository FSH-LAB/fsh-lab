# Dedicated Artifact Registry repository, runtime identity, and GKE Workload Identity binding per app.

resource "google_artifact_registry_repository" "this" {
  project       = var.project_id
  location      = var.region
  repository_id = var.app
  format        = "DOCKER"
  description   = "Docker images for the ${var.display_name} app on GKE."

  cleanup_policy_dry_run = true

  docker_config {
    immutable_tags = false
  }

  cleanup_policies {
    id     = "delete-web-after-30d"
    action = "DELETE"

    condition {
      tag_state             = "ANY"
      older_than            = "2592000s"
      package_name_prefixes = ["web"]
    }
  }

  cleanup_policies {
    id     = "keep-web-latest-5"
    action = "KEEP"

    most_recent_versions {
      keep_count            = 5
      package_name_prefixes = ["web"]
    }
  }

  lifecycle {
    prevent_destroy = true
  }
}

resource "google_service_account" "runtime" {
  project      = var.project_id
  account_id   = "${var.app}-runtime"
  display_name = "${title(var.app)} GKE runtime identity"

  lifecycle {
    prevent_destroy = true
  }
}

# GKE Workload Identity binding: allows Kubernetes ServiceAccount <app>-sa in namespace <app>
# to impersonate GCP Service Account <app>-runtime without any static keys.
resource "google_service_account_iam_member" "workload_identity_user" {
  service_account_id = google_service_account.runtime.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "serviceAccount:${var.project_id}.svc.id.goog[${var.app}/${var.app}-sa]"
}

resource "google_secret_manager_secret" "this" {
  for_each = var.secrets

  project   = var.project_id
  secret_id = "${var.app}-${replace(lower(each.value), "_", "-")}"

  replication {
    auto {}
  }

  lifecycle {
    prevent_destroy = true
  }
}

resource "google_secret_manager_secret_iam_member" "runtime_accessor" {
  for_each = var.secrets

  project   = var.project_id
  secret_id = google_secret_manager_secret.this[each.key].secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.runtime.email}"
}
