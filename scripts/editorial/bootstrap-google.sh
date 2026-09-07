#!/usr/bin/env bash
# Run after interactive gcloud login. No service-account key is created.
set -euo pipefail
project_id="${1:?Usage: bootstrap-google.sh PROJECT_ID REPOSITORY_ID OWNER_ID}"
repository_id="${2:?GitHub immutable repository ID required}"
owner_id="${3:?GitHub immutable owner ID required}"
[[ "$project_id" =~ ^[a-z][a-z0-9-]{4,28}[a-z0-9]$ ]]
[[ "$repository_id" =~ ^[0-9]+$ && "$owner_id" =~ ^[0-9]+$ ]]
if ! gcloud projects describe "$project_id" >/dev/null 2>&1; then
  gcloud projects create "$project_id" --name='Emmanuel Portfolio'
fi
gcloud services enable firebase.googleapis.com firebasehosting.googleapis.com iam.googleapis.com iamcredentials.googleapis.com sts.googleapis.com --project "$project_id"
if ! ./node_modules/.bin/firebase projects:list --json | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>process.exit(JSON.parse(s).result.some(p=>p.projectId===process.argv[1])?0:1))' "$project_id"; then
  ./node_modules/.bin/firebase projects:addfirebase "$project_id" --non-interactive
fi
account="portfolio-publisher@$project_id.iam.gserviceaccount.com"
if ! gcloud iam service-accounts describe "$account" --project "$project_id" >/dev/null 2>&1; then
  gcloud iam service-accounts create portfolio-publisher --project "$project_id" --display-name='Portfolio Hosting publisher'
fi
gcloud projects add-iam-policy-binding "$project_id" --member="serviceAccount:$account" --role=roles/firebasehosting.admin --condition=None >/dev/null
gcloud projects add-iam-policy-binding "$project_id" --member="serviceAccount:$account" --role=roles/serviceusage.serviceUsageConsumer --condition=None >/dev/null
if ! gcloud iam workload-identity-pools describe portfolio --location=global --project "$project_id" >/dev/null 2>&1; then
  gcloud iam workload-identity-pools create portfolio --location=global --project "$project_id" --display-name='Portfolio GitHub Actions'
fi
if ! gcloud iam workload-identity-pools providers describe github --workload-identity-pool=portfolio --location=global --project "$project_id" >/dev/null 2>&1; then
  gcloud iam workload-identity-pools providers create-oidc github --workload-identity-pool=portfolio --location=global --project "$project_id" --issuer-uri=https://token.actions.githubusercontent.com --attribute-mapping='google.subject=assertion.sub,attribute.repository_id=assertion.repository_id' --attribute-condition="assertion.repository_id == '$repository_id' && assertion.repository_owner_id == '$owner_id' && assertion.ref == 'refs/heads/main' && assertion.workflow_ref == 'novaonline/portfolio-editorial/.github/workflows/publish.yml@refs/heads/main'"
fi
project_number="$(gcloud projects describe "$project_id" --format='value(projectNumber)')"
gcloud iam service-accounts add-iam-policy-binding "$account" --project "$project_id" --role=roles/iam.workloadIdentityUser --member="principalSet://iam.googleapis.com/projects/$project_number/locations/global/workloadIdentityPools/portfolio/attribute.repository_id/$repository_id" >/dev/null
printf 'workloadIdentityProvider: projects/%s/locations/global/workloadIdentityPools/portfolio/providers/github\nserviceAccount: %s\nsiteUrl: https://%s.web.app\n' "$project_number" "$account" "$project_id"
