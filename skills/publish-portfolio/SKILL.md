---
name: publish-portfolio
description: Prepare private portfolio previews and identified releases, inspect publishing state, promote the reviewed static artifact to Firebase, or roll back a retained successful release.
---

Read `docs/publishing.md`, private `publishing.json`, `selection.json`, `state.json`, and any active promotion record. Use the scripts or the single private GitHub workflow; never reproduce deployment logic ad hoc.

Default to private preview while editing. It includes article/concept drafts and excludes sources, profile interviews and local metadata. Access requires explicit LAN/VPN CIDRs with client IP preservation. Noindex alone is not access control.

Approval identifies the exact document SHA-256. Mark the reviewed document ready, snapshot it, present that revision, and record approval only when the user's instruction covers it. Preserve unchanged selections while drafting replacements.

A release pins website/editorial commits, builds once, checks its private preview, and saves static files plus public Markdown. Present its ID, package checksum, selected articles and preview URL. Promotion requires the user's instruction identifying that release. Implementing publishing does not approve a new draft.

Promote retained artifacts with recorded checksums and original artifact run IDs. Never rebuild during promotion or rollback. Rollback requires a retained successful release. Expiration, checksum failures or failed preview checks stop deployment.

Resume partially successful publication with the same operation ID. Inspect receipts first; report whether Firebase or public source export completed. Generated workflows, dry runs and mocked tests are not live deployment evidence. Save next actions in the private checkpoint.
