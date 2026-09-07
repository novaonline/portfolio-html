---
type: article
title: AI Clients Need Context, Signals, and Choice
description: Why I prefer AI clients that can switch models and work from real
  project context
slug: 2026-03-29-ai-clients-need-context-signals-and-choice
date: 2026-03-29
tags:
  - AI
  - MCP
  - Context
  - Security
  - Codex
status: stable
concepts: []
unlisted: false
noindex: false
rss: true
---
When I think about agentic software development, I do not think the LLM choice stays fixed. I have had good experiences with Codex, and it fits my homelab use cases well. For an organization, especially at this point in AI, it feels irresponsible to lock everything into one model family. I would rather use AI clients[^context-1] that let teams switch models when a different one is better for the work.

The bigger point is context engineering[^context-2]. If the client can reach Jira, docs, APIs, or other internal systems, then it becomes more useful than a generic code generator. The work is not only asking a better prompt; it is making the right context available at the right time.

The part I find interesting is moving past code that only responds to a PRD[^context-3]. A client that can also see production metrics, usage trends, and the growth of a core business entity[^context-4] has a better chance of suggesting code that fits the system's real shape, not just the requirement document.

Once MCP unlocks the ability to give an AI client that much context, SKILL.md[^context-5] and team-level scopes become the controls around it. SKILL.md gives the client durable instructions, and scopes define what each team is allowed to read or change. That combination is good context engineering, but it is also why security has to be involved.

[^context-1]: The apps or interfaces that connect an AI model to code, project context, tools, and external services, such as Codex, Copilot, Cursor, or Claude Code.

[^context-2]: Deliberately assembling the instructions, documents, tool outputs, project history, and other signals an AI model needs to do the task well.

[^context-3]: Product requirements document: a product planning document that explains what should be built, why it matters, and the constraints around it.

[^context-4]: The main domain object that drives load and product behavior, such as accounts, orders, devices, tenants, claims, or subscriptions.

[^context-5]: A reusable instruction file for an AI client, such as Codex, that captures a workflow, project rules, and domain context for future tasks.
