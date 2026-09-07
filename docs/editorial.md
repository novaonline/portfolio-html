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
