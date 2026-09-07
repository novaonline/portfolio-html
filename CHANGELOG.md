# Changelog

## Unreleased

- Restore Experiences wording in navigation, metadata and concept backlinks. Add explicit whole-phrase Markdown annotations with hover, keyboard and tap explanations alongside standard footnotes. Configure the Astro rehype transform without new runtime dependencies.

- Route private previews through the existing shared F5 NGINX Ingress, external-dns and cert-manager TLS. Argo CD manages ClusterIP backends and access policies; remove dedicated portfolio LoadBalancers and host networking. Verify the served artifact over its HTTPS hostname and check Helm routing in CI.
- Introduce private editorial storage, five OKF-style document types, content-addressed imports, source reconciliation, versioned profile interviews, immutable approvals and resumable checkpoints.
- Migrate legacy public articles to Markdown exports and ContextTerm footnotes; retain MDX support and existing article/RSS URLs. Drafts move to the private repository without rewriting history.
- Add Concepts navigation, pages, article links and backlinks. Build sitemap and RSS from the same selected public content. Astro configuration now uses `SITE_URL` and validates export manifests at build start.
- Add private Kubernetes preview charts, a dedicated runner, Argo bootstrap, retained release packages, Firebase OIDC bootstrap and resumable promotion/rollback operations.
- Repair formatting with Astro support, add Vitest coverage and `npm run verify`, remove unused ESLint script, pin Node, and add public verification CI.
