# Emmanuel’s portfolio and knowledge notebook

A static Astro website with articles, evolving concepts and résumé integration. Canonical writing, recordings and editorial history live in the separate **private** `novaonline/portfolio-editorial` repository. This public repository contains the renderer, deterministic tooling, skills, and approved Markdown exports.

```sh
nvm use
npm ci
npm run verify
npm run dev
```

| Command                       | Purpose                                               |
| ----------------------------- | ----------------------------------------------------- |
| `npm run verify`              | Format, Astro types, tests and production build       |
| `npm run test:browser`        | Mobile/desktop navigation, tags, theme and footnotes  |
| `npm run fmt`                 | Format code and documentation                         |
| `npm run editorial -- status` | Resume the private editorial workflow                 |
| `npm run build`               | Validate selected public content and generate `dist/` |
| `npm run preview`             | Serve the generated build locally                     |

[Editorial workflow](docs/editorial.md) documents the ontology, import, writing profile and review commands. [Publishing](docs/publishing.md) covers Kubernetes previews, exact artifact promotion, rollback, bootstrap and operational checks. These commands work without an AI assistant. [AGENTS.md](AGENTS.md) identifies authoritative files for agents; `.agents/skills/` exposes the three conversational workflows.

`resume.json` is ignored. The loader accepts raw `RESUME_JSON`, then local `resume.json`, then `resume.example.json`. Never commit the private résumé. Runtime dependencies remain Astro only; test, formatting and publishing tools are development dependencies.

Public articles retain `/experiences/<slug>/` and `/experiences/rss.xml`; concepts use `/concepts/<slug>/`. Canonical site URL comes from `SITE_URL`, normally the allocated Firebase `https://<project-id>.web.app`. Local builds use `http://localhost:4321`. `SITE_PREVIEW=1` is required for draft exports and disables indexing and feeds.

Do not edit generated content under `src/content/experiences/` or `src/content/concepts/` directly. Its manifest binds the approved bytes. Edit private canonical Markdown, review the revision, then export. MDX rendering remains available for future interactions.

Dependabot proposes dependency updates. Review major framework migrations separately; do not use `npm audit fix --force` to combine them with content work. `package-lock.json` pins the build dependency graph. CI uses GitHub-hosted runners for public code; private sources and deployments use the dedicated editorial runner.
