# Changelog

## Unreleased

- Give the greenfield Async Worker and Analytics bounded batches, visible member IDs, queue depth, processing progress and completed-batch counts. Clarify Analytics pause as finishing the current batch before stopping new batches; distinguish it from pausing the scene.

- Adapt the homepage green-field diagram to the Living Systems profile as one overview, with matching component identities in prose. Holding Analytics now demonstrates independent product/business progress and stale observations; release catches up on the same item IDs. Preserve static routes, reduced motion and local controls. Document the general overview/breakdown placement and explanatory-value rules.

- Prefer hp-envy for disposable private previews using the existing ephemeral-workload toleration; retain durable release artifacts outside the pod.

- Hide Concepts from the primary navigation for the first article release.

- Rename the front-gate experience to “Heavy Reads Belong at the Front Gate”.

- Identify the incomplete reading explicitly and distinguish analytics’ temperature-threshold count from the API’s unit conversion.

- Keep the front-gate opening focused on the author’s expectation and accepted tradeoff, leaving its explanation to the scenario.

- Add highlighted explanations for telemetry, cross-database access and the gold layer; present the front-gate scenario as a blockquote.

- Revise the front-gate article around its read/write preference, supported bulk-read API and curated gold-layer exception. Replace route headings with prose introductions and remove redundant visual footers.

- Connect the front-gate article’s opening preference directly to its telemetry context with “because”.

- Show a single larger database batch arriving incomplete at Analytics, with visible unit identification and conversion before completion. Compact local actions and playback controls; retain five smaller API pages for the same illustrative window.

- Group each backfill code snippet and visual under its ownership heading. Remove the database route’s redundant middle node, compact and equalize node heights, and place Pause/Start again within each visual.

- Describe the backfill example as an incomplete reading with a missing unit, and label its action “Resolve unit”; retain its amber visual identity.

- Place database/API route visuals beneath their respective code snippets. Start page requests at Analytics on the left, animate responses returning from the backend, and restore reference-based body springs, heartbeat and arrival halos.

- Shorten the front-gate draft around its hypothesis and one database/API ownership comparison. Add bounded interactive paging with separate retrieval/resolution counts, theme-aware surfaces and static accessible content; retain the code snippets.

- Apply the Living Systems treatment to backfill cells: soft service bodies, causal spring arrivals, continuous visible heartbeat and cell-local Pause/Resume, preserving inline reading blocks and static reduced-motion content.

- Hold animated packets at their destinations as later interactions run. Pause notebook sequences offscreen or in hidden tabs, and resume without resetting their positions.

- Move backfill notebook prose into canonical Markdown with separate visual embeds. Add a shared build-time `shape:` inline notation for boxes, pills and circles, with global styles and no client dependency; register it in Astro's Markdown pipeline.

- Show temperature values in reading tokens and matching inline prose blocks, preserving colour through unit normalization and explaining stable-ID deduplication separately.

- Add focused notebook mini-sequences for historical unit resolution, bulk cursor paging and stable-ID retry matching, with inline missing-unit markers and useful static fallbacks.

- Present the backfill explanation as four mobile-width notebook cells, each pairing prose with an independently replayable geometric animation, instead of one Next/Previous sequence.

- Simplify the backfill sequence to geometric reading tokens, brief external step captions, shape-based normalization and a duplicate-overlap animation. Preserve static descriptions, keyboard controls and reduced-motion support.

- Refine telemetry backfill visuals to a standalone sequence with moving compact page contents, missing-unit emphasis and an explicit idempotent retry outcome.

- Add build-time, authored SVG telemetry map and stepped packet sequence with local visual embeds, accessible static descriptions, optional playback and reduced-motion support. No runtime dependencies added.

- Style article blockquotes as distinct scenario panels with light and dark theme support.

- Restore Experiences wording in navigation, metadata and concept backlinks. Add explicit whole-phrase Markdown annotations with hover, keyboard and tap explanations alongside standard footnotes. Configure the Astro rehype transform without new runtime dependencies.

- Route private previews through the existing shared F5 NGINX Ingress, external-dns and cert-manager TLS. Argo CD manages ClusterIP backends and access policies; remove dedicated portfolio LoadBalancers and host networking. Verify the served artifact over its HTTPS hostname and check Helm routing in CI.
- Introduce private editorial storage, five OKF-style document types, content-addressed imports, source reconciliation, versioned profile interviews, immutable approvals and resumable checkpoints.
- Migrate legacy public articles to Markdown exports and ContextTerm footnotes; retain MDX support and existing article/RSS URLs. Drafts move to the private repository without rewriting history.
- Add Concepts navigation, pages, article links and backlinks. Build sitemap and RSS from the same selected public content. Astro configuration now uses `SITE_URL` and validates export manifests at build start.
- Add private Kubernetes preview charts, a dedicated runner, Argo bootstrap, retained release packages, Firebase OIDC bootstrap and resumable promotion/rollback operations.
- Repair formatting with Astro support, add Vitest coverage and `npm run verify`, remove unused ESLint script, pin Node, and add public verification CI.
