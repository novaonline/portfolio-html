---
name: experience-from-transcript
description: Turn raw Google Recorder transcripts, pasted voice notes, rough spoken thoughts, or transcript files into Astro MDX experience posts for Emmanuel's portfolio. Use when Codex is asked to draft, edit, metadata-fill, tag, hide, peer-review, or prepare a portfolio experience from messy transcript source material.
---

# Experience From Transcript

## Workflow

1. Read the local project context before drafting:
   - `src/content/config.ts` for the current experience schema.
   - `src/content/experiences/` for existing post length, tone, and filename patterns.
   - `src/components/TagList.astro` and `src/lib/resume-static.ts` for skill-vs-topic tag behavior.
2. Accept transcript input from pasted chat text or a user-provided local file path. Treat transcripts as source material, not final copy.
3. Do not preserve raw transcripts in git by default. If the user wants transcript files saved, recommend a gitignored location first.
4. Extract the core experience, practical lesson, factual claims, missing context, privacy risks, and likely reader objections.
5. Draft an Astro MDX post in `src/content/experiences/` using a `YYYY-MM-DD-short-slug.mdx` filename unless the user requests a different path.
6. Use only frontmatter fields supported by the current schema. Do not add `draft: true` unless the project has implemented draft support.
7. Default transcript-derived posts to hidden review state:

```yaml
unlisted: true
noindex: true
rss: false
```

8. Never make a post listed, indexable, or RSS-visible without explicit user approval.

## Metadata

- Generate a grounded title from the actual experience, not a generic lesson headline.
- Write a short description that previews the concrete situation or takeaway.
- Use exact resume-backed skill names only when they exist in `allowedSkills`.
- Use broad, reusable ad-hoc topic tags for everything else. Avoid one-off/niche topic phrases that bloat the tag filter; keep specific concepts in the title, description, or body.
- Do not invent `resumeId`, `projectId`, metrics, companies, dates, tools, outcomes, or timelines.
- If the transcript implies a fact but does not establish it, either omit it or flag it in the peer review.

## Voice

- Write in first person by default.
- Keep the post short unless the transcript contains enough concrete detail or reasoning to justify a longer piece.
- Preserve the user's plain-spoken, direct, reflective style.
- Fix grammar, repetition, filler words, transcription artifacts, and distracting typos.
- Avoid generic AI polish: inflated transitions, corporate phrasing, fake certainty, tidy conclusions that the transcript did not earn, or abstract advice detached from the experience.
- Prefer concrete moments, tradeoffs, and "what I learned" over broad claims.

## Peer Review

After drafting, provide peer review in chat by default. Ask whether the user wants review notes embedded as MDX comments only if that would help their workflow.

Include:

- Factual claims to verify.
- Weak reasoning or missing context.
- Places a skeptical reader may disagree.
- Wording that sounds too broad, too certain, or unfair.
- Privacy, client, employer, or reputation risks.
- Direct questions the user should answer before publishing.

Do not treat the first draft as final. Use the user's answers to revise the MDX before changing visibility fields.
