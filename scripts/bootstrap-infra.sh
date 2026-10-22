#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Bootstrap Infrastructure Identity for FSH-LAB (Industry Best Practice)
#
# PURPOSE:
# Solves the initial "chicken-and-egg" bootstrap problem. An operator runs this
# ONCE per GCP environment (dev, production) to create the remote state bucket
# and execute the initial Terraform apply using operator credentials.
#
# Once bootstrapped, Terraform owns all IAM, VPC, GKE, and Workload Identity
# resources, and future changes are handled automatically by GitHub Actions CI.
#
# USAGE:
#   ./scripts/bootstrap-infra.sh dev
#   ./scripts/bootstrap-infra.sh production
# ==============================================================================

ENV="${1:-dev}"
REGION="europe-north1"

case "$ENV" in
  dev)
    PROJECT_ID="quick-pointer-510215-s6"
    ;;
  production|prod)
    ENV="production"
    PROJECT_ID="generated-mote-510411-v8"
    ;;
  *)
    echo "Usage: $0 [dev|production]" >&2
    exit 1
    ;;
esac

BUCKET="${PROJECT_ID}-terraform-state"

echo "==> [1/4] Checking operator credentials and tools..."
if ! gcloud auth print-access-token >/dev/null 2>&1; then
  echo "Error: Not authenticated with gcloud. Run 'gcloud auth application-default login' first." >&2
  exit 1
fi

if ! command -v terraform >/dev/null 2>&1; then
  echo "Error: terraform CLI is not installed or not in PATH." >&2
  exit 1
fi

echo "==> [2/4] Enabling prerequisite bootstrap GCP APIs on '${PROJECT_ID}'..."
gcloud services enable \
  cloudresourcemanager.googleapis.com \
  serviceusage.googleapis.com \
  iam.googleapis.com \
  iamcredentials.googleapis.com \
  sts.googleapis.com \
  storage.googleapis.com \
  compute.googleapis.com \
  container.googleapis.com \
  --project="$PROJECT_ID" --quiet

echo "==> [3/4] Ensuring remote Terraform state bucket exists (gs://${BUCKET})..."
if ! gcloud storage buckets describe "gs://${BUCKET}" >/dev/null 2>&1; then
  echo "    Creating bucket gs://${BUCKET} in ${REGION}..."
  gcloud storage buckets create "gs://${BUCKET}" \
    --project="$PROJECT_ID" \
    --location="$REGION" \
    --uniform-bucket-level-access \
    --public-access-prevention \
    --quiet
  gcloud storage buckets update "gs://${BUCKET}" --versioning --quiet
else
  echo "    Bucket gs://${BUCKET} already exists."
fi

echo "==> [4/4] Executing Terraform apply via operator credentials..."
export TF_IN_AUTOMATION=1
terraform -chdir=infra init -input=false -reconfigure \
  -backend-config="bucket=${BUCKET}" \
  -backend-config="prefix=helgefolelse/${ENV}"

terraform -chdir=infra apply -input=false \
  -var-file="environments/${ENV}.tfvars"

# Optional: Apply GitHub root if GitHub CLI is logged in
if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
  echo "==> Applying infra/github to configure environment variables and deployment gates..."
  export GITHUB_TOKEN="$(gh auth token 2>/dev/null || true)"
  if [[ -n "$GITHUB_TOKEN" ]]; then
    terraform -chdir=infra/github init -input=false -reconfigure || true
    terraform -chdir=infra/github apply -input=false -auto-approve || true
  fi
fi

echo ""
echo "=============================================================================="
echo " SUCCESS: Infrastructure bootstrapped for '${ENV}' (${PROJECT_ID})!"
echo " Terraform has provisioned the VPC, GKE cluster, Workload Identity, and IAM."
echo " Future infrastructure changes can now be pushed directly to 'main' for CI."
echo "=============================================================================="
