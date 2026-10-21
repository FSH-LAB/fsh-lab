#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Bootstrap Infrastructure Identity for FSH-LAB (Approach B)
#
# Runs ONCE per GCP environment (dev, production) to create the CI service
# account and Workload Identity Federation (WIF) binding.
#
# Once bootstrapped, GitHub Actions CI handles 100% of future infrastructure
# changes and app onboarding autonomously.
# ==============================================================================

ENV="${1:-dev}"

case "$ENV" in
  dev)
    PROJECT_ID="quick-pointer-510215-s6"
    PROJECT_NUMBER="475851250732"
    ;;
  production|prod)
    ENV="production"
    PROJECT_ID="generated-mote-510411-v8"
    PROJECT_NUMBER="423756211110"
    ;;
  *)
    echo "Usage: $0 [dev|production]" >&2
    exit 1
    ;;
esac

SA_NAME="fsh-lab-infra"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
POOL="projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-actions"
REPO="FSH-LAB/fsh-lab"
WIF_MEMBER="principalSet://iam.googleapis.com/${POOL}/attribute.workflow_ref/${REPO}/.github/workflows/infra.yml@refs/heads/main"
STATE_BUCKET="${PROJECT_ID}-terraform-state"

echo "==> Bootstrapping infrastructure identity for '${ENV}' (${PROJECT_ID})..."

# 1. Verify gcloud credentials
if ! gcloud auth print-access-token >/dev/null 2>&1; then
  echo "Error: Not authenticated with gcloud. Run 'gcloud auth application-default login' or 'gcloud auth login' first." >&2
  exit 1
fi

# 2. Enable prerequisite services
echo "==> Enabling required GCP APIs..."
gcloud services enable \
  iam.googleapis.com \
  iamcredentials.googleapis.com \
  sts.googleapis.com \
  storage.googleapis.com \
  --project="$PROJECT_ID" --quiet

# 3. Create service account if it doesn't already exist
echo "==> Ensuring service account '${SA_NAME}' exists..."
if ! gcloud iam service-accounts describe "$SA_EMAIL" --project="$PROJECT_ID" >/dev/null 2>&1; then
  gcloud iam service-accounts create "$SA_NAME" \
    --project="$PROJECT_ID" \
    --display-name="FSH-LAB Terraform Infrastructure Applier" \
    --quiet
  echo "    Created ${SA_EMAIL}"
else
  echo "    ${SA_EMAIL} already exists"
fi

# 4. Bind Workload Identity Federation permission
echo "==> Configuring Workload Identity User binding for GitHub Actions..."
gcloud iam service-accounts add-iam-policy-binding "$SA_EMAIL" \
  --project="$PROJECT_ID" \
  --role="roles/iam.workloadIdentityUser" \
  --member="$WIF_MEMBER" \
  --quiet >/dev/null

# 5. Grant state bucket access
echo "==> Granting access to Terraform state bucket 'gs://${STATE_BUCKET}'..."
gcloud storage buckets add-iam-policy-binding "gs://${STATE_BUCKET}" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/storage.objectAdmin" \
  --condition=None \
  --quiet >/dev/null

# 6. Grant project infrastructure administration roles to the service account
echo "==> Granting project infrastructure roles to '${SA_NAME}'..."
ROLES=(
  "roles/viewer"
  "roles/iam.securityReviewer"
  "roles/iam.workloadIdentityPoolViewer"
  "roles/artifactregistry.admin"
  "roles/bigquery.admin"
  "roles/compute.networkAdmin"
  "roles/container.admin"
  "roles/logging.configWriter"
  "roles/monitoring.admin"
  "roles/run.admin"
  "roles/secretmanager.admin"
  "roles/serviceusage.serviceUsageAdmin"
  "roles/iam.serviceAccountCreator"
  "roles/iam.serviceAccountDeleter"
  "roles/iam.serviceAccountUser"
  "roles/resourcemanager.projectIamAdmin"
  "roles/iam.serviceAccountAdmin"
)

for role in "${ROLES[@]}"; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="$role" \
    --condition=None \
    --quiet >/dev/null
done

echo ""
echo "SUCCESS: Infrastructure identity bootstrapped for '${ENV}'!"
echo "You can now run or re-trigger 'infra apply ${ENV}' in GitHub Actions."
