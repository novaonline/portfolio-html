import fs from "node:fs";
import path from "node:path";
import { diffLines } from "./profile.mjs";
import {
  files,
  parse,
  write,
  writeJSON,
  readJSON,
  hash,
  snapshot,
  readRevision,
  record,
  publicDocument,
  publishableSchema,
  inside,
} from "./documents.mjs";

export function approve(root, document, { by, reason, expectedRevision }) {
  if (!by || !reason || !expectedRevision)
    throw new Error(
      "Approval needs reviewer, reason and the reviewed SHA-256 revision",
    );
  const selected = snapshot(root, document);
  if (selected.revision !== expectedRevision)
    throw new Error("Document changed since review");
  const { data } = parse(readRevision(root, selected.revision));
  publishableSchema.parse(data);
  if (data.editorialStage !== "ready")
    throw new Error("Document must be ready before approval");
  record(root, "approval", {
    ...selected,
    by,
    reason,
    at: new Date().toISOString(),
  });
  return selected;
}
export function approved(root, revision) {
  return (
    files(path.join(root, "records", "approval")).some(
      (file) => parse(fs.readFileSync(file, "utf8")).data.revision === revision,
    ) ||
    files(path.join(root, "records", "migration-public")).some(
      (file) => parse(fs.readFileSync(file, "utf8")).data.revision === revision,
    )
  );
}
export function select(root, documents) {
  const selected = readJSON(path.join(root, "selection.json"), {});
  for (const document of documents) {
    const entry = snapshot(root, document);
    if (!approved(root, entry.revision))
      throw new Error(`Unapproved revision: ${document}`);
    selected[document] = entry.revision;
  }
  validateSelection(root, selected);
  writeJSON(path.join(root, "selection.json"), selected);
  return selected;
}
export function validateSelection(root, selected, preview = false) {
  const docs = Object.entries(selected).map(([document, revision]) => {
    if (!/^(articles|concepts)\/[a-z0-9-]+\.md$/.test(document))
      throw new Error("Invalid selected document");
    if (!preview && !approved(root, revision))
      throw new Error(`Unapproved revision: ${document}`);
    const text = readRevision(root, revision),
      { data } = parse(text);
    publishableSchema.parse(data);
    if (
      document !==
      `${data.type === "article" ? "articles" : "concepts"}/${data.slug}.md`
    )
      throw new Error("Document path and slug disagree");
    return {
      document,
      revision,
      data,
      text,
      output: publicDocument(text, preview),
    };
  });
  const concepts = new Set(
    docs.filter((d) => d.data.type === "concept").map((d) => d.data.slug),
  );
  const routes = new Set(
    docs.map(
      (d) =>
        `/${d.data.type === "article" ? "experiences" : "concepts"}/${d.data.slug}/`,
    ),
  );
  for (const doc of docs) {
    for (const concept of doc.data.concepts ?? [])
      if (!concepts.has(concept))
        throw new Error(`Broken concept reference: ${concept}`);
    for (const match of doc.output.matchAll(
      /\]\((\/(?:concepts|experiences)\/[^)#\s]+)(?:#[^)]*)?\)/g,
    ))
      if (!routes.has(match[1]))
        throw new Error(`Broken content link: ${match[1]}`);
    if (/\]\([^)]*\.md(?:#.*)?\)/.test(doc.output))
      throw new Error("Unresolved Markdown document link");
  }
  return docs;
}
export function exportContent(root, site, { preview = false, selection } = {}) {
  let selected = selection ?? readJSON(path.join(root, "selection.json"), {});
  if (preview)
    selected = Object.fromEntries(
      ["articles", "concepts"].flatMap((kind) =>
        files(path.join(root, kind))
          .filter((file) => file.endsWith(".md"))
          .map((file) => {
            const { document, revision } = snapshot(
              root,
              path.relative(root, file),
            );
            return [document, revision];
          }),
      ),
    );
  const docs = validateSelection(root, selected, preview);
  if (!docs.length) throw new Error("Refusing an empty export");
  // Validate everything before replacing the isolated checkout content.
  for (const kind of ["experiences", "concepts"]) {
    const dir = inside(site, `src/content/${kind}`);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
  }
  const manifest = {
    version: 1,
    mode: preview ? "preview" : "public",
    documents: {},
  };
  for (const doc of docs) {
    const file = `src/content/${doc.data.type === "article" ? "experiences" : "concepts"}/${doc.data.slug}.md`;
    write(inside(site, file), doc.output);
    manifest.documents[file] = hash(doc.output);
  }
  writeJSON(inside(site, "content-manifest.json"), manifest);
  return { selected, manifest };
}
export function checkpoint(root, state) {
  const prior = readJSON(path.join(root, "state.json"), {});
  const next = { ...prior, ...state };
  record(root, "checkpoint", { at: new Date().toISOString(), state: next });
  writeJSON(path.join(root, "state.json"), next);
  return next;
}

export function init(root) {
  for (const dir of [
    "sources",
    "articles",
    "concepts",
    "profiles/history",
    "records",
    "revisions",
    "transcripts",
    "media",
    "releases",
  ])
    fs.mkdirSync(path.join(root, dir), { recursive: true });
  if (!fs.existsSync(path.join(root, ".gitignore")))
    write(
      path.join(root, ".gitignore"),
      "media/\nreleases/\n.env*\nnode_modules/\n*.tmp\n",
    );
  if (!fs.existsSync(path.join(root, "state.json")))
    checkpoint(root, {
      activeDocuments: [],
      unresolvedClaims: [],
      pendingQuestion: null,
      nextActions: ["Refine the provisional writing profile."],
    });
}

export function changeSummary(before, after) {
  return diffLines(before, after);
}
