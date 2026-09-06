# Publishing operations

The private editorial repository runs one manually dispatched `publish.yml` workflow on its dedicated `portfolio-editorial` runner. Public website CI uses GitHub-hosted runners. No draft/source credentials are available to public pull requests.

## Bootstrap

1. Clone the private repository; locally `.editorial/` is the default. Copy `editorial-template/` files for a fresh installation. Configure `publishing.json` using its example: repository names, Firebase project ID, runner label, registry, namespace, preview hostnames, and explicit LAN/VPN CIDRs. The workflow's runner label must match configuration.
2. Commit private articles, profiles and selections. Run `node scripts/editorial/bootstrap-cluster.mjs <root>` to inspect the generated namespace, dedicated ARC runner and Argo applications. Add `--apply` after checking configuration. This creates a read-only GitHub deploy key for Argo and stores its secret in Kubernetes; local key files stay ignored. Existing homelab ARC, Argo, MetalLB and registry are prerequisites.
3. Sign in to Firebase and Google Cloud in the local terminal. `scripts/editorial/bootstrap-google.sh PROJECT_ID REPOSITORY_ID OWNER_ID` creates the dedicated project and Hosting IAM/OIDC configuration. Use the immutable GitHub repository/owner IDs from `gh api repos/novaonline/portfolio-editorial`. The project ID must be globally available; copy the script's provider/service-account output to `publishing.json`. No billing upgrade or custom domain is required by this workflow.
4. Configure private-repository `WEBSITE_EXPORT_TOKEN`: a fine-grained GitHub token limited to **Contents: read/write on portfolio-html only**. Do not copy the broad local GitHub CLI token. OIDC grants only the configured private repository's `main` publishing workflow access to the dedicated Hosting service account.
5. Commit configuration and workflow. The template defaults to the dedicated runner label. Changes to the public tooling require a new pinned website commit. Copy updated workflow/AGENTS/skills from the website when upgrading the editorial installation.

The bootstrap script requires `gcloud`, Firebase CLI, `gh`, `kubectl`, `ssh-keygen` and authorized accounts. Site builds require Node/npm; private previews require Docker. Helm charts are reconciled by Argo. Secrets never belong in either repository.

## Preview access

Previews serve **only static article/concept pages**. No source documents, profile interviews, transcript files, release metadata or local paths are in the web root. `allowedCidrs` is mandatory; an empty list, public network, or catch-all CIDR fails validation and Helm rendering.

Each preview uses a dedicated LoadBalancer service with `externalTrafficPolicy: Local` and `loadBalancerSourceRanges`. The static NGINX container independently permits only configured client networks and sends `X-Robots-Tag: noindex, nofollow` and `Cache-Control: no-store`. It does not trust forwarded IP headers. This avoids the shared ingress service's client-IP masking. The services use private MetalLB addresses; hostnames resolve through the homelab's external-DNS controller. Initially previews use HTTP on the trusted LAN/VPN.

Before using real drafts, check successful access from an allowed address and denied access from a disallowed network, including a spoofed `X-Forwarded-For`. Verify no public ingress points to the service. A local success alone does not establish outside-network denial. Do not widen CIDRs to make an incorrectly routed request work.

## Build and review

Commit editorial changes and pin the website's **full commit SHA**. Dispatch `preview` for working drafts or `release` for selected approved revisions. Supply a stable release ID. The workflow checks out the pinned code and exports content into an isolated archive, installs the lockfile, validates and builds once. A release requires the allocated Firebase URL; a draft preview uses its local hostname.

```sh
node scripts/editorial/publish.mjs preview --root .editorial --code . --code-revision <40-character-sha> --release-id draft-001
node scripts/editorial/publish.mjs deploy-preview --root .editorial --release-id draft-001
node scripts/editorial/publish.mjs check-preview --root .editorial --release-id draft-001
```

Replace `preview` with `release` to prepare public selections. These commands are also used by GitHub Actions. Preview deployment pins an image by registry digest and commits the Helm values for Argo. The check compares every served file to the saved artifact and checks indexing protection. GitHub stores the package privately for 30 days. The run summary gives its ID, package SHA-256, content selection and code/editorial commits. Use a new ID for a new build; do not rebuild an expired artifact under an old reviewed identity.

`receipt.json` binds the static tree, public source tree, code revision, editorial revision, selection, canonical URL and expiry into `packageSha256`. `preview-check.json` records a successful comparison with the private release preview. Public source frontmatter is explicitly allowlisted. The package excludes raw sources and interviews; private Git remains the source of approval records.

## Promote and roll back

Review the release preview and identify that release in the publication instruction. Dispatch `promote` with its release ID, original artifact run ID, package checksum, and the same reviewed tooling commit. The workflow retrieves the retained package, validates it, authenticates through OIDC, and gives Firebase the saved static files. **Promotion never rebuilds.** Firebase finalizes uploaded files before switching its live channel. The matching Markdown snapshot is then committed to the public website repository.

Rollback uses the same workflow with `rollback`, a retained previously successful release and its checksum/run ID. It restores that release's static files and public Markdown snapshot. Expired or missing artifacts require a newly built/reviewed release.

GitHub serializes the entire workflow; local commands also acquire a promotion lock. Step results and the live release are persisted privately. If Firebase succeeds and the Git export fails, the live site has changed: the receipt states that partial result and retry resumes the export without deploying again. Resume the same workflow run/operation ID before starting a different operation. A completed operation cannot replay after it has been superseded. Git and Firebase are separate systems, so publication is a resumable sequence rather than a cross-system transaction.

## Recovery and validation

- `npm run verify` tests imports, profile persistence, selected revisions, private-field filtering, release tampering, expiration, failed checks, retries and rollback rules using synthetic fixtures and mocked adapters.
- A live end-to-end demonstration additionally requires real profile answers, article/release approval, allowed/disallowed-network checks, Firebase sign-in, OIDC and repository export credentials. Never describe mocked tests as live publication.
- Compare all legacy published bodies and URLs after migration. Confirm private draft routes are absent from public build, RSS and sitemap. Test mobile navigation, tag filters, theme switching, concepts/backlinks and footnote links in a browser.
- Preserve the original Recorder backups and the private Git remote. Retained static artifacts expire after 30 days; Git history alone is insufficient for exact-byte rollback.
- If a process dies leaving `.promotion-lock`, inspect `records/active-promotion.json`, Firebase and the export receipt before removing only the stale lock and resuming that operation.

Current provider references: [Firebase Hosting](https://firebase.google.com/docs/hosting/quickstart), [Google GitHub OIDC authentication](https://github.com/google-github-actions/auth), [OpenAI file transcription](https://developers.openai.com/api/docs/guides/speech-to-text).
