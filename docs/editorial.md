# Editorial workflow

The website is a static renderer. Canonical writing lives in private `novaonline/portfolio-editorial`. The default local checkout is `.editorial/`, ignored by this repository. Set `EDITORIAL_ROOT` or pass `--root` for another checkout. Audio stays ignored in `media/`; Recorder is the original audio backup. Text variants, article revisions, profile history and receipts are private Git data.

These commands work in a terminal; Codex is an optional conversational interface. Run `npm ci` with the Node version in `.nvmrc`. Start with `npm run editorial -- status`.

## Ontology

Every document has YAML frontmatter containing `type`, `title`, `description`, and optional broad `tags`. This is a small convention based on [OKF](https://github.com/GoogleCloudPlatform/knowledge-catalog/blob/main/okf/SPEC.md), not a full OKF implementation. Five custom types: `source`, `article`, `concept`, `writing-profile`, `editorial-record`. Markdown carries the explanation; relative paths identify documents. `status: draft | stable | deprecated` describes knowledge lifecycle. `editorialStage: draft | review | ready` describes editorial work.

An article in the private repository:

```yaml
type: article
title: A concrete observation
description: The question this article explores.
slug: a-concrete-observation
date: 2026-09-06
tags: [Architecture]
status: draft
editorialStage: draft
concepts: []
sources: [sources/recording-label.md]
writingProfile:
  version: 0.1.0
  revision: <sha256-of-profile-snapshot>
unlisted: true
noindex: true
rss: false
```

Concepts use the publishing fields without a required publication date. Reference them with `concepts: [concept-slug]` and `[explanation](../concepts/concept-slug.md)`. They can link to one another. Articles retain `/experiences/<slug>/`; concepts use `/concepts/<slug>/`. Filename and slug must agree. Article dates are publication dates; source `recordedAt` stays null when an export cannot establish year/timezone.

Sources hold variants with checksums, resource paths, labels and original locations. New API transcriptions record actual requested model, options and chunk times. Recovered folder names are labels only. Many-to-many article/source associations are supported.

## Import and write

```sh
npm run editorial -- import '/absolute/path/recording.txt' '/absolute/path/recording.m4a'
node scripts/editorial/transcribe.mjs '/absolute/path/recording.m4a'
npm run editorial -- status
```

Import is repeatable and content-addressed. Exact copies share storage; distinct bytes remain separate. Retranscription is optional and needs an authorized OpenAI key. Files over the upload limit are converted to ordered ten-minute MP3 chunks; completed chunks are saved so retries resume. Joins can need editorial review. Originals are unchanged. A text edit is never labelled retranscription.

Draft privately against the current profile, recording its version and hash. Save active documents, pending questions, unresolved claims and next actions with `checkpoint --state-file <private-json>`. Current state is `state.json`; immutable checkpoints and reviews live in `records/`.

## Profile interview

`profiles/current.md` is current; `profiles/history/<version>.md` is immutable. Answers have records, full before/after diffs and version explanations. Ask one question using `profile-question --question '…' --uncertainty '…'`. Apply the actual answer with `profile-answer --answer-file <file> --proposed-file <file> --bump patch --explanation '…'`. Resume pending questions. Major changes purpose/audience/fundamental voice, minor adds compatible preferences, patch clarifies.

## Review and select

Set the reviewed article to `ready` and intended public visibility, then:

```sh
npm run editorial -- snapshot articles/a-concrete-observation.md
npm run editorial -- approve articles/a-concrete-observation.md --revision <reviewed-sha256> --by Emmanuel --reason 'Approved this revision in conversation'
npm run editorial -- select articles/a-concrete-observation.md
```

Approval records a human decision; the command does not obtain one. Never manufacture approval or interview answers. `selection.json` selects immutable approved revisions, so further drafting cannot change publication. Export strips source/profile/review fields and checks known private markers and concept links. Human review remains responsible for whether the prose itself is suitable for public release.

`export --site <isolated-site-checkout>` exports selected revisions; `--preview` exports current article/concept drafts. Preview builds need `SITE_PREVIEW=1`. `content-manifest.json` binds public file bytes; builds reject edits and preview manifests. This is integrity checking, not cryptographic proof of human approval: approval records remain private.

## Article visual embeds

Use a standalone `[visual:telemetry-map]` or `[visual:telemetry-sequence]` paragraph in canonical Markdown for the first telemetry illustrations. Export normally; never edit generated content. These are named, article-specific illustrations, not a scenario DSL. Their build-time HTML/SVG lives in `scripts/markdown/article-visuals.mjs`. Unknown visual names fail the build. The Astro article shell supplies shared theme styles and a small progressively enhanced sequence controller. No Mermaid runtime or React dependency is required for these authored visuals.

The optional map explains ownership and the data journey; the sequence figures explain ordered interactions. All diagrams render a useful static state without JavaScript. Native Replay buttons are keyboard accessible; motion stops when the figure leaves view and reduced-motion users receive static diagrams. Keep routine future diagrams separate from these editorial illustrations; this does not establish SVG as the default for every diagram.

For local draft review, run `npm run editorial -- export --preview`, then `SITE_PREVIEW=1 npm run dev -- --host 127.0.0.1`. If the exporter removes and recreates files and the dev collection loses a route, restart the local server. Never publish a draft merely to refresh a local visual.

After changing a build-time visual renderer, start the dev server with `--force` to clear Astro's cached content markup. Restarting alone may retain the earlier SVG.

The earlier backfill draft used four cells, with headings and explanatory paragraphs in canonical Markdown. Place `[visual:backfill-detail]`, `[visual:backfill-meaning]`, `[visual:backfill-pages]` and `[visual:backfill-retry]` separately after the corresponding paragraphs. The renderer in `scripts/markdown/backfill-notebook.mjs` owns only figures, visual labels and accessible descriptions, not article prose. The older `telemetry-sequence` marker renders the four figures together without prose. Each SVG fits the mobile width, plays once on entry into view and offers independent keyboard-accessible Replay. Static final states work without JavaScript; reduced motion disables animation. Do not reintroduce the Layer 0 map without author review.

### Inline shapes across editorials

Emmanuel explicitly requested reusable shape-based notation across editorials, with prose remaining in Markdown. Use ordinary Markdown link syntax as a build-time notation, not a real navigation link:

```markdown
Follow [86 ?](shape:box/amber/missing). The API resolves
[86°F](shape:box/amber), then returns [30°C](shape:box/amber).

[visual:backfill-meaning]

A [Request](shape:pill/purple) reaches the [?](shape:circle/red) marker.
```

Format: `[plain-text label](shape:SHAPE/COLOUR[/missing])`. Shapes: `box`, `pill`, `circle`. Colours: `blue`, `purple`, `amber`, `red`, `green`, `neutral`. Circles accept one or two characters; use a pill for longer labels. `/missing` adds an unresolved-state outline and screen-reader text; include a visible `?` when appropriate. Keep labels meaningful and explain the relationship in prose instead of relying only on colour. Shape and colour should remain consistent when tracking an object through a visual, but they are not actual data identifiers.

`scripts/markdown/inline-shapes.mjs` converts these links into non-interactive spans during Astro's Markdown/MDX build. Shared CSS applies on all site pages, independently of diagram scripts. No runtime dependencies, inline JSX or article-specific helpers are needed. Ordinary links, inline code and fenced code are untouched. Invalid shape/colour combinations and formatted labels fail the build. In an external Markdown viewer without this extension, labels remain readable but appear as unsupported links; this notation is a portfolio rendering extension, not portable standard Markdown styling.

The notation does not synchronize diagrams automatically. Keep illustration values and Markdown labels consistent during review; diagram labels and accessible descriptions remain authored with the figure.

## Recovery

`migrate --archive <old-transcripts> --downloads <Downloads> --legacy-site <old-site>` imports matching exports and migrates articles once. Originals remain intact. `migration.json`, `records/source-reconciliation/`, and `legacy/` preserve reconciliation and originals. Existing public revisions are grandfathered for the authorized migration only. Historical notes never authorize new publication. Imports are repeatable; migration does not overwrite later edits.

## Maintenance

`npm run verify` checks formatting, Astro types, tests and output. Exported Markdown is excluded from automatic formatting because its bytes are selected revisions. Change canonical content privately and re-export. Tests use synthetic data and mocked deployment/API adapters; they never read private sources or call cloud services. Complete the live checks in [publishing.md](publishing.md) before declaring deployment complete.

## Validation and interrupted interviews

Run `npm run editorial -- validate` before committing canonical content. It checks all five document types, source checksums, profile references, concepts and selected approvals. Audio may be absent on another computer; transcripts must be present.

If a profile update is interrupted, run `npm run editorial -- profile-resume`. The saved mutation journal retains the exact answer, before/after text and version explanation; resuming finishes those same immutable records. Do not answer the question again or edit the profile while that journal exists.

## Reader terminology and inline explanations

The site calls posts **Experiences**, matching the author's preference for observations grounded in practice. The internal `article` type and private `articles/` directory remain stable; `/experiences/` URLs are unchanged.

Use ordinary numbered footnotes for general asides. To make the exact explained phrase visible and offer an inline explanation, pair a Markdown link with its footnote:

```markdown
A [virtual server](#context-2)[^context-2] provides the boundary.

[^context-2]: The explanation of the complete phrase.
```

The link identifier must match the immediately following footnote reference. The Astro rehype plugin binds it to the footnote renderer's actual ID and fails a malformed pairing. The entire phrase is highlighted. Hover, focus or tap shows the explanation; Escape, another tap or clicking outside closes it. The number still navigates to the footer. Without JavaScript, the phrase itself links to the same footnote. Long explanations remain scrollable; the footer retains links and full Markdown formatting. Do not guess phrase boundaries from the word before a numbered reference. Recovered annotations use their original explicit labels.

### Living Systems article adaptation

The current article visual guidance is anchored privately in `records/visual-profile/living-systems-article-1.0.0.md`, alongside preserved references. Keep paragraph/visual cells and shared inline shapes. Soft service bodies, fixed labels and causal arrival reactions adapt the reference to mobile article width. Concise labels and local controls are confirmed preferences; explanations stay in canonical prose. Each cell offers Pause/Resume and Replay. The causal sequence plays once; a small staggered heartbeat continues while visible. Pause, offscreen state and hidden tabs stop motion; reduced motion retains the complete static explanation. A white surface is optional; prefer a surface suited to the page theme and the explanation. This is an authored sequence, not a general simulation engine.

An earlier backfill draft used one `[visual:backfill-comparison]` figure after the hypothesis and scenario. It compares who resolves the incomplete reading on the database and API routes. Local paging controls retrieve an illustrative five-page window; database retrieval and analytics resolution have separate counts. The API route resolves units before returning its pages. Counts belong to the model, independent of motion. The two code snippets and all explanatory paragraphs remain canonical Markdown. Legacy four-cell markers remain available to older drafts.

The latest backfill review places `[visual:backfill-database]` immediately after its SQL snippet and `[visual:backfill-api]` after its C# snippet. Both use the same comparison renderer. Analytics initiates on the left; telemetry is on the right. Requests move right and reading pages return left, resolving the incomplete reading inside the API or at analytics. Pulses use the reference spring, double-heartbeat and halo formulas. Counts advance on timed scenario completion, never from pixel positions. Reset cancels pending pages; reduced motion completes requested operations without travel. This supersedes the earlier combined-figure placement.

For the current route packages, canonical prose introduces each route above the code; the latest article review removes the separate ownership headings and redundant visual footer notes. The named-visual transform groups an immediately preceding code block and its figure in `.route-package`, preserving the code and all prose. Figure captions remain available to screen readers without duplicating the heading. Database has only Analytics and Telemetry nodes; API retains the middle API node. Nodes stretch to equal compact heights within each route, with client controls immediately below the client. Pause/Resume and Start again use compact labelled icon buttons inside the route surface. The illustrative database route fetches one 50,000-reading batch; API fetches five 10,000-reading pages over the same window. Analytics holds an incomplete reading with a blocked state until Resolve identifies Fahrenheit, converts to Celsius and completes the batch. These batch sizes are demo choices, not route performance claims.
