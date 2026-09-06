import fs from "node:fs";
import path from "node:path";
import {
  parse,
  serialize,
  writeJSON,
  readJSON,
  immutable,
  hash,
  snapshot,
  record,
  contextFootnotes,
} from "./documents.mjs";
import { init, exportContent } from "./workflow.mjs";
import { importRecovery } from "./import.mjs";

const associations = {
  "2026-02-05-read-heavy-front-gate": ["feb-5-at-06-13-read-heavy-systems"],
  "2026-02-05-transparency-and-proofreading": [
    "feb-5-at-06-18-transparency-thought",
  ],
  "2026-02-19-every-organization-has-a-baseline": ["apr-3-at-09-03"],
  "2026-03-12-technical-debt-is-subjective": ["feb-19-at-10-33"],
  "2026-03-22-architecture-is-risk-management": ["mar-12-at-06-02"],
  "2026-03-22-design-communicates-in-layers": ["mar-1-at-08-49"],
  "2026-03-22-evolution-over-revolution": [
    "mar-22-at-09-02",
    "mar-22-at-09-03",
  ],
  "2026-03-22-transitive-reasoning-for-alignment": ["mar-22-at-09-30"],
  "2026-03-25-flexible-billing-plan-models": ["mar-25-at-09-42"],
  "2026-03-29-ai-clients-need-context-signals-and-choice": ["mar-29-at-08-47"],
  "2026-03-29-mcp-needs-auth-and-governance": ["mar-29-at-08-52"],
  "2026-04-03-abstraction-stops-being-helpful": ["apr-3-at-08-59"],
  "2026-04-03-public-models-should-be-governed": ["apr-3-at-08-59"],
  "2026-04-03-organizations-have-a-baseline": ["apr-3-at-09-03"],
  "2026-04-30-ai-automation-follows-the-layer-you-know": ["apr-30-at-10-56"],
};
const profileBody = `This is a provisional interpretation of the existing articles, recovered transcripts, and the prior experience-from-transcript voice rules. It has not yet been confirmed through the interview.

- Purpose (inferred): share observations about architecture, data, organizations, and AI through a personal public notebook.
- Audience (uncertain): technical peers who understand software delivery; confirm how much background a reader should need.
- Voice (inferred): first person, direct, reflective, concrete. Preserve uncertainty and distinguish thought experiments from experience.
- Structure (inferred): start with the observation, explain the tradeoff, stop when the idea is communicated. Keep articles short unless evidence needs more room.
- Evidence (established rule): do not invent dates, employers, metrics, outcomes, or provenance. Mark claims needing clarification privately.
- Vocabulary (inferred): explain specialist terms with short footnotes. Avoid inflated transitions, corporate phrasing, and forced conclusions.
- Visuals (user stated): eventually favour interactive explanation; use short articles for now with accessible text alternatives.

Evidence: compare the April 30 automation recording/article (concrete browser/API contrast), March 29 context and MCP recordings/articles (technical terms and uncertainty), and the February 5 originals/articles. Draft examples are evidence of a working style, not approval.

Interview coverage remaining: purpose and audience, voice, structure, evidence, vocabulary, visuals. Ask one question at a time and distinguish confirmed preferences from these inferences.
`;
export function migrate(root, site, archive, downloads, legacySite = site) {
  init(root);
  importRecovery(root, archive, downloads);
  const migrationFile = path.join(root, "migration.json");
  if (fs.existsSync(migrationFile)) return readJSON(migrationFile);
  const selection = {},
    reconciliation = [];
  for (const name of fs
    .readdirSync(path.join(legacySite, "src/content/experiences"))
    .filter((name) => /\.mdx?$/.test(name))
    .sort()) {
    const original = fs.readFileSync(
      path.join(legacySite, "src/content/experiences", name),
      "utf8",
    );
    const { data, body } = parse(original),
      slug = name.replace(/\.mdx?$/, "");
    const isPublic = data.unlisted === false;
    const sourceIds = associations[slug] ?? [];
    const sources = sourceIds.map((id) => `sources/${id}.md`);
    for (const source of sources)
      if (!fs.existsSync(path.join(root, source)))
        throw new Error(`Missing migration source: ${source}`);
    const article = serialize(
      {
        ...data,
        type: "article",
        slug,
        description: data.description ?? data.title,
        concepts: [],
        sources,
        writingProfile: {
          version: "0.1.0",
          basis:
            "Provisional profile seeded during migration; original drafting version unknown.",
        },
        editorialStage: isPublic ? "ready" : "draft",
        status: isPublic ? "stable" : "draft",
      },
      contextFootnotes(body),
    );
    const document = `articles/${slug}.md`;
    immutable(path.join(root, document), article);
    immutable(path.join(root, `legacy/${name}`), original);
    const selected = snapshot(root, document);
    if (isPublic) {
      record(root, "migration-public", {
        ...selected,
        basis:
          "Preserve currently listed article under the explicitly requested migration.",
        originalSha256: hash(original),
        originalVisibility: {
          unlisted: data.unlisted,
          noindex: data.noindex,
          rss: data.rss,
        },
      });
      selection[document] = selected.revision;
    }
    reconciliation.push({
      document,
      sources,
      association: sourceIds.length ? "content-reviewed" : "unresolved",
      reviewedBy: "Codex migration",
      note: "Publication date preserved independently. Recording year unknown.",
      consolidation: slug.includes("baseline")
        ? "Compare both baseline drafts with the April 3 09:03 source; no merge authorized."
        : null,
    });
  }
  record(root, "source-reconciliation", {
    associations: reconciliation,
    authority: "Content-based provenance review; no new publication approval.",
  });
  const profile = serialize(
    {
      type: "writing-profile",
      title: "Emmanuel’s writing profile",
      description: "Provisional voice and purpose inferred from existing work.",
      version: "0.1.0",
      status: "draft",
      provisional: true,
      tags: [],
    },
    profileBody,
  );
  immutable(path.join(root, "profiles/history/0.1.0.md"), profile);
  immutable(path.join(root, "profiles/current.md"), profile);
  record(root, "profile-seed", {
    version: "0.1.0",
    basis:
      "Existing articles, recovered transcripts, prior voice rules, and explicit workflow preferences.",
    confirmed: false,
  });
  immutable(
    path.join(root, "concepts/architecture-as-workflow.md"),
    serialize(
      {
        type: "concept",
        title: "Architecture as workflow",
        description:
          "An evolving idea for explaining architecture through movement and decisions.",
        slug: "architecture-as-workflow",
        editorialStage: "draft",
        status: "draft",
        tags: ["Architecture"],
        concepts: [],
        sources: ["sources/aug-18-at-10-06.md"],
        unlisted: true,
        noindex: true,
        rss: false,
      },
      `I often understand architecture by following what triggers work, what happens next, and how information moves between components. This is an initial concept draft grounded in the August 18 recording; it needs review before publication.

## Visual-engine brief (deferred)

Represent triggers, actions and branches as nodes with connections. Animate data or packets moving along those connections so readers can follow cause and effect. Let a reader inspect the steps and decisions, and connect diagrams to short explanations. Home Assistant workflows and Kubernetes components are source examples, not a requirement to reuse their interface.

Provide an equivalent ordered text explanation, keyboard controls, a pause control, reduced-motion support, and labels that communicate without colour alone. Start with a single illustrative workflow before attempting a general visual engine.
`,
    ),
  );
  writeJSON(path.join(root, "selection.json"), selection);
  const report = {
    articles: reconciliation.length,
    publicArticles: Object.keys(selection).length,
    drafts: reconciliation.length - Object.keys(selection).length,
    associations: reconciliation,
  };
  writeJSON(migrationFile, report);
  exportContent(root, site);
  return report;
}
