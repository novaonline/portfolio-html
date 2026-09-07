# Publishing operations

The private editorial repository runs one manually dispatched `publish.yml` workflow on its dedicated `portfolio-editorial` runner. Public website CI uses GitHub-hosted runners. No draft/source credentials are available to public pull requests.

## Bootstrap

1. Clone the private repository; locally `.editorial/` is the default. Copy `editorial-template/` files for a fresh installation. Configure `publishing.json` using its example: repository names, Firebase project ID, runner label, registry, namespace, preview hostnames, explicit LAN/VPN CIDRs, and the existing ingress class, certificate issuer and controller selectors. The workflow's runner label must match configuration.
2. Commit private articles, profiles and selections. Run `node scripts/editorial/bootstrap-cluster.mjs <root>` to inspect the generated namespace, dedicated ARC runner and Argo applications. Add `--apply` after checking configuration. This creates a read-only GitHub deploy key for Argo and stores its secret in Kubernetes; local key files stay ignored. Existing homelab ARC, Argo, F5 NGINX Ingress, external-dns, cert-manager and registry are prerequisites.
3. Sign in to Firebase and Google Cloud in the local terminal. `scripts/editorial/bootstrap-google.sh PROJECT_ID REPOSITORY_ID OWNER_ID` creates the dedicated project and Hosting IAM/OIDC configuration. Use the immutable GitHub repository/owner IDs from `gh api repos/novaonline/portfolio-editorial`. The project ID must be globally available; copy the script's provider/service-account output to `publishing.json`. No billing upgrade or custom domain is required by this workflow.
4. The cluster bootstrap also creates a **write deploy key limited to portfolio-html** and stores it as private-repository `WEBSITE_EXPORT_SSH_KEY`. Public export uses SSH with host-key verification. The broad local GitHub CLI token is used only during administrative bootstrap and is never stored in Actions. Rotate this deploy key by removing its repository key and private secret, replacing the ignored local key files, then rerunning bootstrap. OIDC grants only the configured private repository's `main` publishing workflow access to the dedicated Hosting service account.
5. Commit configuration and workflow. The template defaults to the dedicated runner label. Changes to the public tooling require a new pinned website commit. Copy updated workflow/AGENTS/skills from the website when upgrading the editorial installation.

The bootstrap script requires `gcloud`, Firebase CLI, `gh`, `kubectl`, `ssh-keygen` and authorized accounts. Site builds require Node/npm; private previews require Docker. Helm charts are reconciled by Argo. Secrets never belong in either repository.

## Preview access

Previews serve **only static article/concept pages**. No source documents, profile interviews, transcript files, release metadata or local paths are in the web root. `allowedCidrs` is mandatory; an empty list, public network, or catch-all CIDR fails validation and Helm rendering.

The route follows the other homelab applications: external-dns publishes the Ingress address, the shared **F5 NGINX Ingress** terminates TLS, and a **ClusterIP** service reaches the static server on container port 8080. There is no dedicated portfolio LoadBalancer, NodePort or host networking. Argo CD reconciles the committed Helm chart; Actions builds and pushes the image and commits its immutable digest.

Configure `ingress.className`, `ingress.clusterIssuer`, `ingress.controllerNamespace` and `ingress.controllerLabels` to match the installed controller. This deployment uses class `nginx`, issuer `equagraine-cloudflare-issuer`, and the `nginx-ingress` namespace. The controller must support `k8s.nginx.org/v1` Policy resources and the `nginx.org/policies` annotation (F5 controller 5.4 or later). These are F5 annotations, not community ingress-nginx annotations. Certificate issuance and DNS reconciliation use the existing controllers.

An NGINX access policy permits `allowedCidrs` and the dedicated `runnerIp/32`. A Kubernetes NetworkPolicy admits backend connections only from the configured ingress controller pods and the dedicated editorial runner; unrelated pods cannot bypass ingress by contacting the service. The server sends `X-Robots-Tag: noindex, nofollow` and `Cache-Control: no-store`. Updates use normal pod networking and a rolling deployment. Container-local HTTP health probes avoid admitting translated node addresses into the backend policy.

**Source NAT:** the current shared ingress route can replace LAN client addresses with Kube-OVN gateway addresses. An IP allowlist cannot recover client identity after this translation. Keep `ingress.natCidrs` empty by default. Exact private gateway `/32` exceptions are supported only when the operator confirms that the shared ingress is reachable exclusively from the LAN/VPN and sets `ingress.privateNetworkConfirmed: true`. In that configuration the upstream network boundary supplies privacy for translated traffic; the ingress allowlist cannot distinguish clients sharing a gateway. Do not admit gateways when internet forwarding or tunnels can reach the ingress. Do not alter the shared controller's global networking to fix this application's route.

Actions verifies every static file through the configured **HTTPS hostname**, covering DNS, TLS, ingress routing and content identity. Bootstrap reserves the dedicated runner address through Kube-OVN's `ip_pool` annotation and enables port security. Reserve an unused address when bootstrapping elsewhere. When changing an existing runner's address, wait for active jobs to finish, scale it to zero, wait for its pod to disappear, then apply bootstrap. Do not scale this one-address runner above one replica.

Before using real drafts, verify the allowed route, certificate, indexing headers and backend NetworkPolicy. Test a disallowed source and spoofed `X-Forwarded-For` where original client addresses are preserved. For translated routes, record the confirmed upstream access boundary and the observed gateway addresses. A successful LAN request alone does not prove internet denial. `npm run test:helm` renders the chart and checks ingress, TLS, external-dns, backend isolation and rejection of unconfirmed NAT exceptions.

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

Network references: [F5 NGINX policies](https://docs.nginx.com/nginx-ingress-controller/configuration/policy-resource/policy-specification/), [Kube-OVN and MetalLB source addresses](https://kubeovn.github.io/docs/v1.15.x/en/advance/with-metallb/), [Kube-OVN reserved workload addresses](https://kubeovn.github.io/docs/v1.15.x/en/guide/static-ip-mac/).

## Google sign-in on this workstation

Google CLI 583.0.0 is staged in ignored `.editorial/media/google-cli/google-cloud-sdk/`; its archive checksum matches Google's installation documentation. From the website directory, complete these interactive commands in your own terminal (keep authorization codes out of chat):

```sh
export PATH="$PWD/.editorial/media/google-cli/google-cloud-sdk/bin:$PATH"
gcloud auth login
./node_modules/.bin/firebase login
```

After signing in, run the documented Google bootstrap and save the allocated project ID, provider and service account in private `publishing.json`. No Firebase project or public release has been created by the unauthenticated bootstrap.
