#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Bootstrap Infrastructure Identity for FSH-LAB (Approach B)
#
# Runs ONCE per environment (dev, production). Idempotent.
# Sets up fsh-lab-infra, WIF bindings, state bucket access, and scoped IAM roles.
# ==============================================================================

ENV="${1:-dev}"
case "$ENV" in
  dev)             PROJECT_ID="quick-pointer-510215-s6"; PROJECT_NUMBER="475851250732" ;;
  production|prod) ENV="production"; PROJECT_ID="generated-mote-510411-v8"; PROJECT_NUMBER="423756211110" ;;
  *) echo "Usage: $0 [dev|production]" >&2; exit 1 ;;
esac

SA_NAME="fsh-lab-infra"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
POOL="projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-actions"
REPO="FSH-LAB/fsh-lab"
BUCKET="${PROJECT_ID}-terraform-state"

echo "==> Bootstrapping infrastructure identity for '${ENV}' (${PROJECT_ID})..."

# 1. Verify gcloud authentication
if ! gcloud auth print-access-token >/dev/null 2>&1; then
  echo "Error: Not authenticated with gcloud. Run 'gcloud auth application-default login' first." >&2
  exit 1
fi

# 2. Enable core GCP APIs
echo "==> Enabling prerequisite APIs..."
gcloud services enable \
  compute.googleapis.com container.googleapis.com \
  iam.googleapis.com iamcredentials.googleapis.com sts.googleapis.com \
  storage.googleapis.com --project="$PROJECT_ID" --quiet

# 3. Create service account if missing
echo "==> Ensuring service account '${SA_NAME}' exists..."
gcloud iam service-accounts describe "$SA_EMAIL" --project="$PROJECT_ID" >/dev/null 2>&1 || \
  gcloud iam service-accounts create "$SA_NAME" \
    --project="$PROJECT_ID" \
    --display-name="FSH-LAB Terraform Infrastructure Applier" \
    --quiet

# 4. Bind Workload Identity Federation (matches unmerged, merged, and environment claims)
echo "==> Binding Workload Identity claims..."
for claim in \
  "attribute.workflow_ref/${REPO}/.github/workflows/infra.yml@refs/heads/main" \
  "attribute.job_workflow_ref/${REPO}/.github/workflows/infra.yml@refs/heads/main" \
  "attribute.environment/${ENV}"; do
  gcloud iam service-accounts add-iam-policy-binding "$SA_EMAIL" \
    --project="$PROJECT_ID" \
    --role="roles/iam.workloadIdentityUser" \
    --member="principalSet://iam.googleapis.com/${POOL}/${claim}" \
    --quiet >/dev/null
done

# 5. Grant state bucket access (scoped to environment state prefixes)
echo "==> Granting Terraform state bucket access..."
gcloud storage buckets add-iam-policy-binding "gs://${BUCKET}" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/storage.objectAdmin" \
  --condition="title=environment-state-only,expression=resource.name.startsWith('projects/_/buckets/${BUCKET}/objects/fsh-lab/${ENV}/') || resource.name.startsWith('projects/_/buckets/${BUCKET}/objects/helgefolelse/${ENV}/')" \
  --quiet >/dev/null

# 6. Grant standard project infrastructure roles
echo "==> Granting standard project infrastructure roles..."
for role in \
  roles/viewer roles/iam.securityReviewer roles/iam.workloadIdentityPoolViewer \
  roles/artifactregistry.admin roles/bigquery.admin roles/compute.networkAdmin \
  roles/container.admin roles/logging.configWriter roles/monitoring.admin \
  roles/run.admin roles/secretmanager.admin roles/serviceusage.serviceUsageAdmin \
  roles/iam.serviceAccountCreator roles/iam.serviceAccountDeleter roles/iam.serviceAccountUser; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="$role" \
    --condition=None \
    --quiet >/dev/null
done

# 7. Revoke unconditional admin roles (cleanup from any earlier runs)
echo "==> Revoking unconditional admin roles..."
for role in roles/resourcemanager.projectIamAdmin roles/iam.serviceAccountAdmin; do
  gcloud projects remove-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="$role" \
    --condition=None \
    --quiet >/dev/null 2>&1 || true
done

# 8. Grant scoped conditional roles matching infra/main.tf
add_conditional_role() {
  local role="$1" title="$2" desc="$3" expr="$4"
  local tmp
  tmp=$(mktemp)
  printf '{"title":"%s","description":"%s","expression":"%s"}' "$title" "$desc" "$expr" > "$tmp"
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="$role" \
    --condition-from-file="$tmp" \
    --quiet >/dev/null
  rm -f "$tmp"
}

echo "==> Granting scoped projectIamAdmin and serviceAccountAdmin..."
add_conditional_role "roles/resourcemanager.projectIamAdmin" \
  "delegated-role-grants-only" \
  "Allows granting only strictly necessary runtime roles to application service accounts" \
  "api.getAttribute('iam.googleapis.com/modifiedGrantsByRole', []).hasOnly(['roles/run.invoker', 'roles/secretmanager.secretAccessor', 'roles/logging.logWriter', 'roles/monitoring.metricWriter', 'roles/bigquery.jobUser', 'roles/iam.serviceAccountUser', 'roles/iam.workloadIdentityUser'])"

add_conditional_role "roles/iam.serviceAccountAdmin" \
  "runtime-service-accounts-only" \
  "Allows managing IAM policies only for application runtime service accounts (*-runtime)" \
  "resource.type == 'iam.googleapis.com/ServiceAccount' && resource.name.endsWith('-runtime@${PROJECT_ID}.iam.gserviceaccount.com')"

# 9. Configure GitHub Actions environment variable
echo "==> Configuring GitHub Actions environment variable 'GCP_INFRA_SERVICE_ACCOUNT'..."
if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
  gh variable set GCP_INFRA_SERVICE_ACCOUNT --env "$ENV" --body "$SA_EMAIL" --repo "$REPO"
  echo "    Configured in GitHub environment '${ENV}'"
else
  echo "    NOTE: GitHub CLI ('gh') not authenticated. Ensure GCP_INFRA_SERVICE_ACCOUNT is set in GitHub:"
  echo "    terraform -chdir=infra/github apply"
  echo "    (or: gh variable set GCP_INFRA_SERVICE_ACCOUNT --env ${ENV} --body ${SA_EMAIL})"
fi

echo ""
echo "SUCCESS: Infrastructure identity bootstrapped for '${ENV}'!"
echo "You can now run or re-trigger 'infra apply ${ENV}' in GitHub Actions."
