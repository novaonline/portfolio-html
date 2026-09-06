---
name: develop-writing-profile
description: Develop Emmanuel's portfolio writing profile through a resumable interview with one question at a time, preserving answers, versioned snapshots, diffs and reasons for changes.
---

Read `docs/editorial.md`, private `state.json`, `profiles/current.md`, and the most recent profile answer. Start from the saved provisional profile, preserving which preferences are confirmed versus inferred.

Before each question show the version, brief current summary, and uncertainty being addressed. Begin with purpose and audience, then cover voice, structure, evidence, vocabulary and visuals. Ask one question at a time. Resume a pending question; never invent an answer or advance because time passed.

Persist a question with `npm run editorial -- profile-question --question '…' --uncertainty '…'`. Save the user's answer verbatim in a private temporary file and prepare a proposed Markdown profile. Explain its effect: major for changed purpose, audience or fundamental voice; minor for a new compatible preference; patch for clarification. Confirming an inferred preference can be a patch if it does not change behaviour.

Apply with `profile-answer --answer-file <private-file> --proposed-file <private-file> --bump <major|minor|patch> --explanation '…'`. This preserves the answer, immutable snapshot, diff and explanation before updating current state. Never rewrite history to make a later answer appear earlier.

A response may add uncertainty; represent that honestly. Ask before converting article-specific feedback into a lasting preference. Record article review separately. The profile guides drafting and never replaces source evidence.
