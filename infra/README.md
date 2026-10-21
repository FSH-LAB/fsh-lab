# Infrastructure

The reusable Infrastructure workflow (`infra.yml`) applies the Terraform configuration for each environment (`dev`, then `production`). `ci.yml` calls it on push to `main` when `infra/`, an `apps/*/infra.json`, or an `apps/*/k8s/**` manifest changes, before app delivery; it can also be dispatched manually per environment. Application deployment workflows update GKE workloads via Kustomize without running Terraform. A separate root manages GitHub environments and deployment variables.

All environments use `europe-north2`. The region is fixed in Terraform to match the deployment workflow, VPC network, and GKE Autopilot cluster.

| Root            | Manages                                                                                                  | State                                                               |
| --------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `infra/`        | GCP project, APIs, state bucket, Artifact Registry, VPC, GKE Autopilot, service accounts, IAM and OIDC   | `gs://<project>-terraform-state/helgefolelse/<env>`                 |
| `infra/github/` | GitHub environments, reviewers, branch policy and deployment variables                                   | `gs://generated-mote-510411-v8-terraform-state/helgefolelse/github` |

Terraform owns infrastructure (VPC, GKE Autopilot cluster, IAM, Workload Identity); the deployment workflow (`cd.yml` via `.github/actions/gke-rollout`) owns container releases, Kustomize overlays, and rollout verification. Core infrastructure resources have deletion protection enabled.

The state prefix currently remains `helgefolelse/<env>` to protect existing state from recreation. Both `helgefolelse/<env>/` and `fsh-lab/<env>/` are permitted by bucket IAM conditions to enable zero-downtime operator migration.

## When Does Terraform Apply Need to Run?

In the FSH-LAB GitOps model, infrastructure changes and application releases are intentionally decoupled:

### 1. Automated Execution via CI/CD (`.github/workflows/infra.yml`)
Runs automatically on push to `main` when changes touch:
- Any file in `infra/**` (VPC, subnets, GKE cluster, IAM roles, or uptime monitoring)
- Any application manifest `apps/*/infra.json` (auto-discovering a new app, changing secrets, or resizing resources)

The automated pipeline executes `terraform plan` -> applies `dev` -> awaits manual sign-off on the `production-approval` gate -> applies `production`.

> [!NOTE]
> Routine application releases (modifying code in `apps/<app>/src/**` or Kubernetes overlays in `apps/<app>/k8s/**`) **DO NOT run Terraform**. They are delivered directly to GKE via `.github/workflows/cd.yml` using `kubectl` and Kustomize.

### 2. Manual Operator Execution (Local `terraform apply`)
A human operator with project administrator privileges (`gcloud auth application-default login`) only needs to run `terraform apply` directly in these 4 scenarios:

1. **Initial Project / Environment Bootstrap:** Setting up a fresh GCP project before CI has an identity (`./scripts/bootstrap-infra.sh <env>`).
2. **Privilege & Trust Boundary Changes:** Modifying Workload Identity Federation provider conditions, project IAM admin bindings, or state bucket IAM rules (CI intentionally lacks permission to escalate its own project IAM privileges).
3. **GitHub Root Updates (`infra/github/`):** Updating GitHub environments, reviewers, or deployment variables with `GITHUB_TOKEN=$(gh auth token)`. CI cannot modify its own branch protection rules.
4. **State Migrations & Disaster Recovery:** Running `terraform state mv`, backend state prefix migrations (`helgefolelse/<env>` to `fsh-lab/<env>`), or resource imports (`terraform import`).

---

## Infrastructure Identity Bootstrap (`fsh-lab-infra`)

The CI workflow `infra.yml` uses the dedicated `fsh-lab-infra` service account (`GCP_INFRA_SERVICE_ACCOUNT`). To bootstrap this identity in a fresh or uninitialized environment:

```sh
./scripts/bootstrap-infra.sh dev         # For dev
./scripts/bootstrap-infra.sh production  # For production
```

This script enables prerequisite GCP APIs, ensures the GCS state bucket exists, and applies `infra/` using operator credentials so that Terraform natively provisions the VPC, GKE cluster, Workload Identity pool, and IAM roles without bash duplication.

## State Migration Runbook (Migrating to `fsh-lab/<env>`)

To migrate existing environment state from `helgefolelse/<env>` to `fsh-lab/<env>`:

1. Verify that no deployments or infrastructure runs are in progress.
2. Initialize and migrate state locally with operator credentials:
   ```sh
   terraform -chdir=infra init -migrate-state \
     -backend-config="bucket=$PROJECT_ID-terraform-state" \
     -backend-config="prefix=fsh-lab/$ENV"
   ```
3. Run `terraform -chdir=infra plan -var-file="environments/$ENV.tfvars"` and verify **0 to add, 0 to change, 0 to destroy**.
4. Once verified for both `dev` and `production`, update the `-backend-config="prefix=fsh-lab/<env>"` in `.github/workflows/infra.yml`.

## Application Manifest Discovery (`infra/modules/gke-app`)

Applications in the monorepo are dynamically discovered from their local manifests (`apps/*/infra.json`) using Terraform's `fileset()` function:

- Provisions a dedicated Artifact Registry repository (`projects/<project>/locations/<region>/repositories/<app>`)
- Creates an isolated GKE runtime service account (`<app>-runtime@...`)
- Configures GKE Workload Identity binding (`roles/iam.workloadIdentityUser`) for the Kubernetes ServiceAccount `<app>-sa` in namespace `<app>`
- Provisions declared secrets in Google Secret Manager and grants accessor permissions to `<app>-runtime`

Kubernetes manifests are organized per app under `apps/<app>/k8s/` with declarative Kustomize `base` and environment `overlays` (`dev`, `production`). Deployments are orchestrated via `.github/actions/gke-rollout`.

To add a new application to the environment, create `apps/<name>/infra.json` and `apps/<name>/k8s/` specifying application metadata and Kubernetes manifests. No changes to `.tf` files are required.

To roll out this permission boundary, pause deployments and apply the GCP root with operator credentials in each environment. The plan must add the conditional bucket grant. It removes the deployer's project-wide `roles/storage.admin` grant only if that grant was already tracked in this state; additive IAM resources do not remove unmanaged grants. CI cannot apply this IAM change itself.

After applying, remove any remaining unconditional legacy membership and verify that no project-level `storage.admin` membership remains for the deployer. Run this for each environment, with `PROJECT` set as in the manual GCP commands below:

```sh
MEMBER="serviceAccount:helgefolelse-deployer@$PROJECT.iam.gserviceaccount.com"
policy="$(gcloud projects get-iam-policy "$PROJECT" --format=json)"
if printf '%s' "$policy" | jq -e --arg member "$MEMBER" 'any(.bindings[]; .role == "roles/storage.admin" and (.condition == null) and any(.members[]; . == $member))' >/dev/null; then
  gcloud projects remove-iam-policy-binding "$PROJECT" \
    --member="$MEMBER" --role=roles/storage.admin --condition=None
fi
gcloud projects get-iam-policy "$PROJECT" --format=json |
  jq -e --arg member "$MEMBER" '[.bindings[] | select(.role == "roles/storage.admin") | .members[] | select(. == $member)] | length == 0'
```

The verification must return `true`. If it fails, inspect and remove any conditional legacy grants using their exact conditions. Also review inherited, group-based, and bucket-level permissions for other grants allowing writes outside the environment prefix. Do not resume CD until those checks pass; the project-level check alone cannot establish effective access.

`auto_create_network = false` only affects projects created directly by Terraform. Imported projects retain their creation-time value; changing it can force replacement, so it is ignored. Audit existing default networks and firewall rules separately rather than replacing projects.

## Manual GCP changes

Use this for changes the CI identity cannot apply. Authenticate with `gcloud auth application-default login`, choose an environment, and review the saved plan before applying. Do not run it while that environment is deploying.

```sh
ENV=dev # or production
PROJECT=$(sed -n 's/^project_id *= *"\(.*\)"/\1/p' "infra/environments/$ENV.tfvars")
export TF_DATA_DIR="$PWD/infra/.terraform/$ENV"

terraform -chdir=infra init -reconfigure \
  -backend-config="bucket=$PROJECT-terraform-state" \
  -backend-config="prefix=helgefolelse/$ENV"
terraform -chdir=infra plan \
  -var-file="environments/$ENV.tfvars" -out="$ENV.tfplan"
terraform -chdir=infra apply "$ENV.tfplan"
```

## Adopt an existing environment

Before enabling automated deploys, the environment's GCS state must track the existing project and application resources. Never let CI initialize an empty state for a project that already contains these resources. Run from the repository root with operator credentials. If local state already tracks the environment, use `-migrate-state` instead of `-reconfigure` and verify the remote state before continuing.

```sh
ENV=dev # or production
PROJECT=quick-pointer-510215-s6 # set the matching project ID
NUMBER=475851250732 # set the matching GCP project number
export TF_DATA_DIR="$PWD/infra/.terraform/gcp-$ENV"
terraform -chdir=infra init -reconfigure \
  -backend-config="bucket=$PROJECT-terraform-state" \
  -backend-config="prefix=helgefolelse/$ENV"

import_if_missing() {
  address="$1"
  id="$2"
  if ! terraform -chdir=infra state show "$address" >/dev/null 2>&1; then
    terraform -chdir=infra import -var-file="environments/$ENV.tfvars" "$address" "$id"
  fi
}

import_if_missing google_project.environment "$PROJECT"
for api in artifactregistry.googleapis.com cloudresourcemanager.googleapis.com iam.googleapis.com iamcredentials.googleapis.com run.googleapis.com storage.googleapis.com sts.googleapis.com; do
  if gcloud services list --enabled --project="$PROJECT" --format='value(config.name)' | grep -Fxq "$api"; then
    import_if_missing "google_project_service.required[\"$api\"]" "$PROJECT/$api"
  fi
done
import_if_missing google_storage_bucket.state "$PROJECT-terraform-state"
import_if_missing google_artifact_registry_repository.web "projects/$PROJECT/locations/europe-north2/repositories/helgefolelse"
import_if_missing google_service_account.deployer "projects/$PROJECT/serviceAccounts/helgefolelse-deployer@$PROJECT.iam.gserviceaccount.com"
import_if_missing google_service_account.runtime "projects/$PROJECT/serviceAccounts/helgefolelse-runtime@$PROJECT.iam.gserviceaccount.com"
import_if_missing google_cloud_run_v2_service.web "projects/$PROJECT/locations/europe-north2/services/helgefolelse-web"

POOL="projects/$NUMBER/locations/global/workloadIdentityPools/github-actions"
DEPLOYER="projects/$PROJECT/serviceAccounts/helgefolelse-deployer@$PROJECT.iam.gserviceaccount.com"
RUNTIME="projects/$PROJECT/serviceAccounts/helgefolelse-runtime@$PROJECT.iam.gserviceaccount.com"
import_if_missing google_iam_workload_identity_pool.github "$POOL"
import_if_missing google_iam_workload_identity_pool_provider.github "$POOL/providers/github"
import_if_missing google_service_account_iam_member.runtime_user \
  "$RUNTIME roles/iam.serviceAccountUser serviceAccount:helgefolelse-deployer@$PROJECT.iam.gserviceaccount.com"
import_if_missing google_service_account_iam_member.github_deployer \
  "$DEPLOYER roles/iam.workloadIdentityUser principalSet://iam.googleapis.com/$POOL/attribute.environment/$ENV"

terraform -chdir=infra state list
terraform -chdir=infra plan -var-file="environments/$ENV.tfvars" -out="$ENV.tfplan"
```

Review the plan. Existing core resources must not be created or replaced; expected changes may include missing enabled APIs and the deployer's project roles. Apply the saved plan only after review. Repeat for each environment, then allow CI to deploy. If an existing local state is migrated, preserve its backup until `terraform state list` confirms the GCS state is complete.

## Fresh project bootstrap

The GCS backend must exist before Terraform can initialize. For a fresh project in one of the supported environment slots, create the project and state bucket once, then import them so Terraform can manage them:

```sh
ENV=dev # or production
PROJECT=your-project-id # also set this in infra/environments/$ENV.tfvars
PROJECT_NAME="Helgefolelse $ENV"
FOLDER_ID=your-folder-id
BILLING_ACCOUNT_ID=XXXXXX-XXXXXX-XXXXXX
REGION=europe-north2

gcloud projects create "$PROJECT" --name="$PROJECT_NAME" --folder="$FOLDER_ID"
gcloud billing projects link "$PROJECT" --billing-account="$BILLING_ACCOUNT_ID"
gcloud services enable compute.googleapis.com --project="$PROJECT"
```

Before adding workloads to this fresh project, inspect its networks. If a `default` network exists, remove its firewall rules and then the network; if either deletion fails because of dependencies, stop and investigate rather than proceeding:

```sh
gcloud compute networks list --project="$PROJECT"
gcloud compute firewall-rules list --project="$PROJECT" --filter='network:default'
```

For a fresh project with a default network, run:

```sh
for rule in $(gcloud compute firewall-rules list --project="$PROJECT" --filter="network=https://www.googleapis.com/compute/v1/projects/$PROJECT/global/networks/default" --format='value(name)'); do
  gcloud compute firewall-rules delete "$rule" --project="$PROJECT"
done
gcloud compute networks delete default --project="$PROJECT"
```

Verify the default network is absent before continuing (skip deletion if it was never created):

```sh
gcloud compute networks list --project="$PROJECT"
gcloud services enable storage.googleapis.com --project="$PROJECT"
gcloud storage buckets create "gs://$PROJECT-terraform-state" \
  --project="$PROJECT" --location="$REGION" \
  --uniform-bucket-level-access --public-access-prevention

export TF_DATA_DIR="$PWD/infra/.terraform/bootstrap-$ENV"
terraform -chdir=infra init \
  -backend-config="bucket=$PROJECT-terraform-state" \
  -backend-config="prefix=helgefolelse/$ENV"
terraform -chdir=infra import -var-file="environments/$ENV.tfvars" \
  google_project.environment "$PROJECT"
terraform -chdir=infra import -var-file="environments/$ENV.tfvars" \
  'google_project_service.required["storage.googleapis.com"]' "$PROJECT/storage.googleapis.com"
terraform -chdir=infra import -var-file="environments/$ENV.tfvars" \
  google_storage_bucket.state "$PROJECT-terraform-state"
terraform -chdir=infra plan -var-file="environments/$ENV.tfvars" -out="$ENV.tfplan"
terraform -chdir=infra apply "$ENV.tfplan"
```

Review the plan before applying. Then update that environment's project ID and number in `infra/github/main.tf` and apply the GitHub root. Existing environments should use their existing GCS state; do not bootstrap them as fresh projects.

## GitHub settings

CI cannot modify its own approval rules. To update GitHub environments or variables, use an administrator token and review the plan:

```sh
export TF_DATA_DIR="$PWD/infra/.terraform/github"
export GITHUB_TOKEN="$(gh auth token)"
terraform -chdir=infra/github init
terraform -chdir=infra/github plan
terraform -chdir=infra/github apply
```
