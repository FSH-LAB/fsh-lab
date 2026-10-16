mock_provider "google" {
  mock_resource "google_iam_workload_identity_pool" {
    defaults = {
      name = "projects/123456789/locations/global/workloadIdentityPools/github-actions"
    }
  }
}


variables {
  environment  = "dev"
  project_id   = "test-project"
  project_name = "Test"
}

run "protects_core_resources" {
  command = plan

  assert {
    condition     = google_project.environment.deletion_policy == "PREVENT" && !google_project.environment.auto_create_network
    error_message = "Projects must be deletion-protected and request no default network on Terraform creation; imports require a separate network audit."
  }

  assert {
    condition     = google_storage_bucket.state.name == "test-project-terraform-state" && google_storage_bucket.state.public_access_prevention == "enforced" && google_storage_bucket.state.versioning[0].enabled && !google_storage_bucket.state.force_destroy
    error_message = "The state bucket must be private and versioned."
  }

  assert {
    condition     = lower(google_storage_bucket.state.location) == lower(local.region)
    error_message = "The state bucket must use the configured region."
  }
}

run "app_module_protects_service" {
  command = plan

  module {
    source = "./modules/cloud-run-app"
  }

  variables {
    app            = "example-app"
    display_name   = "Example"
    region         = "europe-north2"
    deployer_email = "deployer@test-project.iam.gserviceaccount.com"
  }

  assert {
    condition     = google_artifact_registry_repository.this.repository_id == "example-app" && google_cloud_run_v2_service.this.name == "example-app-web" && google_service_account.runtime.account_id == "example-app-runtime"
    error_message = "App resources must follow the <app>, <app>-web and <app>-runtime naming the deploy workflow relies on."
  }

  assert {
    condition     = google_artifact_registry_repository.this.location == "europe-north2" && google_cloud_run_v2_service.this.location == "europe-north2"
    error_message = "The registry and Cloud Run service must use the configured region."
  }

  assert {
    condition     = google_cloud_run_v2_service.this.deletion_protection && google_cloud_run_v2_service.this.invoker_iam_disabled && google_cloud_run_v2_service.this.template[0].containers[0].ports[0].container_port == 8080
    error_message = "Cloud Run must stay public, deletion-protected and serve on port 8080."
  }

  assert {
    condition     = google_artifact_registry_repository.this.cleanup_policy_dry_run
    error_message = "Registry cleanup must not delete images until explicitly enabled."
  }
}

run "app_module_rejects_long_names" {
  command = plan

  module {
    source = "./modules/cloud-run-app"
  }

  variables {
    app            = "a-name-that-is-far-too-long"
    display_name   = "Too long"
    region         = "europe-north2"
    deployer_email = "deployer@test-project.iam.gserviceaccount.com"
  }

  expect_failures = [var.app]
}

run "deployer_cannot_escalate" {
  command = plan

  assert {
    condition     = length(setintersection(local.deployer_roles, ["roles/owner", "roles/editor", "roles/resourcemanager.projectIamAdmin", "roles/iam.serviceAccountAdmin", "roles/iam.workloadIdentityPoolAdmin", "roles/storage.admin"])) == 0
    error_message = "CI must not be able to change its own IAM or OIDC trust."
  }

  assert {
    condition     = google_storage_bucket_iam_member.deployer_state.role == "roles/storage.objectAdmin" && can(regex("fsh-lab/dev", google_storage_bucket_iam_member.deployer_state.condition[0].expression))
    error_message = "CI state writes must be restricted to its environment prefix, excluding the operator-owned GitHub state."
  }
}

run "discovers_applications" {
  command = plan

  assert {
    condition     = contains(keys(local.apps), "helgefolelse") && contains(keys(local.apps), "status")
    error_message = "Terraform must discover all applications declaring an infra.json manifest."
  }

  assert {
    condition     = contains(keys(module.cloud_run_apps), "helgefolelse") && contains(keys(module.cloud_run_apps), "status")
    error_message = "Cloud Run app modules must be instantiated for each discovered application."
  }
}

run "trust_is_scoped_to_environment" {
  command = plan

  variables {
    environment = "production"
  }

  assert {
    condition     = google_iam_workload_identity_pool_provider.github.attribute_condition == "assertion.repository == 'FSH-LAB/fsh-lab' && assertion.ref == 'refs/heads/main' && assertion.environment == 'production'"
    error_message = "OIDC trust must require the repository, main and the matching environment."
  }
}

run "rejects_unknown_environment" {
  command = plan

  variables {
    environment = "preview"
  }

  expect_failures = [var.environment]
}

run "uptime_monitoring_provisions_checks_and_dataset" {
  command = plan

  assert {
    condition     = module.uptime_monitoring.dataset_id == "uptime_monitoring" && module.uptime_monitoring.table_id == "uptime_checks"
    error_message = "Uptime monitoring must provision the BigQuery dataset and uptime_checks table."
  }
}

run "infra_identity_is_strictly_scoped" {
  command = plan

  assert {
    condition     = local.infra_applier_principal_attribute == "attribute.workflow_ref/FSH-LAB/fsh-lab/.github/workflows/infra.yml@refs/heads/main"
    error_message = "Infra identity trust must be restricted to verified infra.yml workflow claims."
  }

  assert {
    condition     = google_iam_workload_identity_pool_provider.github.attribute_mapping["attribute.workflow_ref"] == "'job_workflow_ref' in assertion ? assertion.job_workflow_ref : assertion.workflow_ref"
    error_message = "Workflow identity must use the called workflow for reusable calls and the running workflow for manual dispatch."
  }

  assert {
    condition     = google_project_iam_member.infra_applier_service_account_admin.role == "roles/iam.serviceAccountAdmin" && can(regex("-runtime@", google_project_iam_member.infra_applier_service_account_admin.condition[0].expression))
    error_message = "Infra service account admin role must be strictly scoped to application runtime service accounts."
  }
}
