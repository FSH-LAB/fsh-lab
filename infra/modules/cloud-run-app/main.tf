# One public Cloud Run service per app, plus its image registry and runtime identity.
# Releases (image, GIT_SHA, revisions, traffic) are owned by the deploy workflow.

resource "google_artifact_registry_repository" "this" {
  project       = var.project_id
  location      = var.region
  repository_id = var.app
  format        = "DOCKER"
  description   = "Docker images for the ${var.display_name} web app."

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
  display_name = "${title(var.app)} Cloud Run runtime"

  lifecycle {
    prevent_destroy = true
  }
}

resource "google_cloud_run_v2_service" "this" {
  project              = var.project_id
  name                 = "${var.app}-web"
  location             = var.region
  deletion_protection  = true
  ingress              = "INGRESS_TRAFFIC_ALL"
  invoker_iam_disabled = true

  template {
    service_account = google_service_account.runtime.email

    containers {
      image = "us-docker.pkg.dev/cloudrun/container/hello"

      ports {
        container_port = 8080
      }
    }
  }

  lifecycle {
    prevent_destroy = true
    ignore_changes = [
      template[0].containers[0].image,
      template[0].containers[0].env,
      template[0].containers[0].name,
      template[0].revision,
      traffic,
      client,
      client_version,
    ]
  }
}

resource "google_service_account_iam_member" "deployer_acts_as_runtime" {
  service_account_id = google_service_account.runtime.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${var.deployer_email}"
}
