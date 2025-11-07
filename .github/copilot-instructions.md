# Project conventions

- Astro + Tailwind + MDX. Prefer static HTML; use small islands only for interactivity.
- TypeScript preferred. Keep read-only pages under ~50 kB JS.
- Content: “Experiences” are blog-style posts; “Projects” are portfolio pages.

## Persona source (private)

- Read author/profile/skills from **`resume.json`** (gitignored).
- If absent, use **`resume.example.json`**; allow **`RESUME_JSON`** env var.
- Do **not** invent bio data. If something is missing, add TODOs and suggest updating `resume.example.json`.

## Tags policy (important)

- Treat **skills from `resume.json`** as the _authoritative_ set.
- When suggesting tags:
  - Use resume skills where they fit → these render as **skill** pills.
  - Allow extra ad-hoc tags for post context → these render as **topic** pills.
- Don’t auto-edit `resume.json` to include a new skill unless explicitly requested.

## Authoring templates

**Experience MDX (blog-style)**

```md
---
title: "Concise, scannable post title"
date: 2025-11-05
description: "One-sentence summary for cards and SEO"
tags: ["Kafka", "Backpressure", "Observability"] # mix of skills + topics
resumeId: "" # optional
projectId: "" # optional
siteOnly: true # set true for site-only posts
unlisted: false
noindex: false
rss: true
---

Lead with the outcome. Use short paragraphs, bullets, and code/diagrams when useful.
```

**Project MDX**

```md
---
id: "short-stable-id"
title: "Project name"
summary: "One-line scope and outcome"
tags: ["ClickHouse", "S3"]
links: [{ "label": "ADR", "href": "/experiences/adr-static-first" }]
---

One screen of context. Link related Experiences.
```

## Writing & UX

- Voice: professional, clear, architecture-focused. Homepage concise; Experiences can be longer.
- Use Canadian English and units; timestamps UTC.
- Prefer headings, bullets, and code blocks over long paragraphs.

## Code style

- Use Tailwind classes, not inline styles.
- Keep components small; extract utilities so patterns repeat cleanly.
- Don’t add heavy deps; ask before suggesting runtime libraries.

## What to open while assisting

- `src/content/**` for context, `src/lib/resume*.ts` for skills list + loaders,
- relevant layout/components (e.g., tag list/pill, filters) to reinforce patterns.
