# Changelog

## Unreleased

- Introduce private editorial storage, five OKF-style document types, content-addressed imports, source reconciliation, versioned profile interviews, immutable approvals and resumable checkpoints.
- Migrate legacy public articles to Markdown exports and ContextTerm footnotes; retain MDX support and existing article/RSS URLs. Drafts move to the private repository without rewriting history.
- Add Concepts navigation, pages, article links and backlinks. Build sitemap and RSS from the same selected public content. Astro configuration now uses `SITE_URL` and validates export manifests at build start.
- Add private Kubernetes preview charts, a dedicated runner, Argo bootstrap, retained release packages, Firebase OIDC bootstrap and resumable promotion/rollback operations.
- Repair formatting with Astro support, add Vitest coverage and `npm run verify`, remove unused ESLint script, pin Node, and add public verification CI.
