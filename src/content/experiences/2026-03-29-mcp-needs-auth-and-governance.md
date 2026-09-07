---
type: article
title: MCP Needs Auth and Governance
description: Why MCP only works if authorization is part of the design
slug: 2026-03-29-mcp-needs-auth-and-governance
date: 2026-03-29
tags:
  - AI
  - MCP
  - Security
  - Authorization
status: stable
concepts: []
unlisted: false
noindex: false
rss: true
---
Chances are your security team is going to push back on MCP[^context-1] integration unless they have some level of visibility and control over which MCP servers are being integrated. That is why the MCP conversation only makes sense to me if authorization and governance are part of it.

Some cases will be service-account based, and some will need OAuth or user-level context. That is where the hard questions show up: how does a virtual server[^context-2] authenticate? How do we whitelist approved servers, and how does this integrate with the SSO or identity provider the organization already uses?

Until that part is clear, MCP feels like a trust exercise. Once the auth story is there, the use cases build naturally.

[^context-1]: Model Context Protocol: a way for AI tools to connect to external tools, data, and services.

[^context-2]: IBM ContextForge's term for a managed MCP gateway endpoint.
