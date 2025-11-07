# AGENTS.md

## Project

Astro portfolio (Astro + MDX + Tailwind). Static site; PRs must keep SSG fast.

## Defaults for the agent

- Package manager: npm (use `npm ci` in CI / cloud).
- Units: Metric (Canadian). Timezone: UTC.
- Keep deps small; ask before adding runtime deps.
- Prefer Prettier; ESLint optional.

## How to build / check / test

- Install: `npm ci`
- Dev (local only): `npm run dev`
- Build: `npm run build`
- Preview: `npm run preview`
- Format check: `npm run fmt:check`
- Lint (if present): `npm run lint`
- Type check: `npm run check`
- Tests (if present): `npm test`

## PR expectations

- Run check + test + format check before opening a PR.
- For content changes, update RSS/sitemap if needed.
- Don’t break Tailwind/MDX config; note config changes in CHANGELOG.

## Persona & content source (private)

- Use root-level **`resume.json`** (gitignored) as the canonical, compact profile.
- If missing (CI/cloud), use **`resume.example.json`**; allow **`RESUME_JSON`** env var (raw JSON).
- Never commit `resume.json`. Propose schema/content edits against `resume.example.json`.

Read, at minimum:
`basics`, `sections.summary.content`, `sections.experience.items[]`, `sections.projects.items[]`, `sections.skills.items[]`, `sections.profiles.items[]`.

## Content model & conventions

- **Experiences** (site): short blog posts (some longer). MDX in `src/content/experiences/`.
  - Front-matter:
    - `title` (string), `date` (ISO or natural), `description?` (string)
    - `tags` (string[]) — may include any tag
    - `resumeId?` (string) — optional back-link to a role in `resume.json`
    - `projectId?` (string) — optional link to a site project page
    - `siteOnly` (bool, default false), `unlisted` (bool, default false), `noindex` (bool, default false), `rss` (bool, default true)
  - Posts **do not** need to appear in the PDF timeline.
- **Projects** (site): portfolio pages in `src/content/projects/`; Experiences can reference via `projectId`.
- **Skills** (authoritative): 1:1 from `resume.json`. Expose a list (e.g., `allowedSkills`) and **style skill tags differently** from ad-hoc topic tags. Don’t silently add new skills to `resume.json`.

## Styling rule for tags

- If a tag ∈ `allowedSkills` → style as **skill** (resume-backed).
- Else → style as **topic** (ad-hoc).
- Keep filters working for both groups.

## SEO & privacy

- Populate hero/SEO from `basics`; include Person JSON-LD.
- Respect `noindex` with `<meta name="robots" content="noindex, nofollow">`.
- Don’t hard-code personal data—read from the loader.

## Notes for Codex

- Prefer creating/editing MDX under `src/content/**`.
- If tests exist, run them and include failing lines in the PR discussion.
- When data is missing/outdated, propose updating **`resume.example.json`** (never commit private `resume.json`).

## Common tasks the agent may perform

- **Add a new experience:** create MDX with front-matter above; use skill tags from `allowedSkills` and any extra topic tags as needed; link `projectId`/`resumeId` only when relevant; update RSS.
- **Add a project page:** create MDX with `id`, `title`, `summary`, `tags`, optional `links`; back-link related experiences.
- **Wire tag styling:** ensure components render skill vs topic pills distinctly (no JS heavy framework).
