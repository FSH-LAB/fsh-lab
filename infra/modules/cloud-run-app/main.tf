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
  invoker_iam_disabled = var.is_public

  template {
    service_account = google_service_account.runtime.email

    scaling {
      min_instance_count = var.min_instances
      max_instance_count = var.max_instances
    }

    containers {
      image = "us-docker.pkg.dev/cloudrun/container/hello"

      resources {
        limits = {
          cpu    = var.cpu
          memory = var.memory
        }
      }

      ports {
        container_port = 8080
      }

      dynamic "env" {
        for_each = var.env_vars
        content {
          name  = env.key
          value = env.value
        }
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
