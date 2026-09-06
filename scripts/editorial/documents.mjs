import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import YAML from "yaml";
import { z } from "zod";

export const hash = (bytes) =>
  crypto.createHash("sha256").update(bytes).digest("hex");
export const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const commonSchema = z
  .object({
    type: z.enum([
      "source",
      "article",
      "concept",
      "writing-profile",
      "editorial-record",
    ]),
    title: z.string().min(1),
    description: z.string().min(1),
    tags: z.array(z.string()).default([]),
    status: z.enum(["draft", "stable", "deprecated"]).optional(),
  })
  .passthrough();
export const publishableSchema = commonSchema
  .extend({
    type: z.enum(["article", "concept"]),
    slug: slugSchema,
    editorialStage: z.enum(["draft", "review", "ready"]),
    concepts: z.array(slugSchema).default([]),
    unlisted: z.boolean().default(false),
    noindex: z.boolean().default(false),
    rss: z.boolean().default(true),
  })
  .superRefine((data, ctx) => {
    if (
      data.type === "article" &&
      (!/^\d{4}-\d{2}-\d{2}(T.*Z)?$/.test(data.date ?? "") ||
        Number.isNaN(Date.parse(data.date)))
    )
      ctx.addIssue({
        code: "custom",
        message: "Articles require an ISO publication date",
      });
  });
export function parse(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/);
  if (!match) throw new Error("Expected YAML frontmatter");
  return { data: YAML.parse(match[1]), body: match[2] };
}
export const serialize = (data, body = "") =>
  `---\n${YAML.stringify(data)}---\n${body}`;
export function write(file, contents) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, contents, { mode: 0o600 });
  fs.renameSync(tmp, file);
}
export const writeJSON = (file, value) =>
  write(file, JSON.stringify(value, null, 2) + "\n");
export const readJSON = (file, fallback) =>
  fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : fallback;
export function immutable(file, contents) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  try {
    fs.writeFileSync(file, contents, { flag: "wx", mode: 0o600 });
  } catch (error) {
    if (
      error.code !== "EEXIST" ||
      !fs.readFileSync(file).equals(Buffer.from(contents))
    )
      throw error;
  }
}
export function inside(root, relative) {
  const resolved = path.resolve(root, relative);
  if (!resolved.startsWith(path.resolve(root) + path.sep))
    throw new Error("Path escapes repository");
  // Reject symlinks in any existing path component, including intermediate directories.
  let current = path.resolve(root);
  for (const part of path.relative(current, resolved).split(path.sep)) {
    current = path.join(current, part);
    if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink())
      throw new Error("Symlink not allowed");
  }
  return resolved;
}
export function files(root) {
  if (!fs.existsSync(root)) return [];
  return fs
    .readdirSync(root, { withFileTypes: true })
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    .flatMap((entry) => {
      if (entry.isSymbolicLink())
        throw new Error(`Symlink not allowed: ${entry.name}`);
      const file = path.join(root, entry.name);
      return entry.isDirectory() ? files(file) : [file];
    });
}
export function snapshot(root, relative) {
  const text = fs.readFileSync(inside(root, relative), "utf8");
  const revision = hash(text);
  immutable(inside(root, `revisions/${revision}.md`), text);
  return { document: relative, revision };
}
export function readRevision(root, revision) {
  if (!/^[a-f0-9]{64}$/.test(revision)) throw new Error("Invalid revision");
  const text = fs.readFileSync(
    inside(root, `revisions/${revision}.md`),
    "utf8",
  );
  if (hash(text) !== revision) throw new Error("Revision checksum mismatch");
  return text;
}
export function record(root, kind, data, body = "") {
  const contents = serialize(
    { type: "editorial-record", title: kind, description: kind, ...data },
    body,
  );
  const id = hash(contents);
  immutable(inside(root, `records/${kind}/${id}.md`), contents);
  return id;
}
export function contextFootnotes(body) {
  const notes = [];
  body = body
    .replace(/^import ContextTerm[^\n]*\n/gm, "")
    .replace(
      /<ContextTerm\s+term="([^"]*)"\s+note="([^"]*)"\s*\/>/g,
      (_, term, note) => {
        notes.push(`[^context-${notes.length + 1}]: ${note}`);
        return `${term}[^context-${notes.length}]`;
      },
    );
  if (body.includes("<ContextTerm"))
    throw new Error("Unconverted ContextTerm annotation");
  return (
    body.trim() + "\n" + (notes.length ? "\n" + notes.join("\n\n") + "\n" : "")
  );
}

const publicKeys = [
  "type",
  "title",
  "description",
  "slug",
  "date",
  "tags",
  "status",
  "concepts",
  "resumeId",
  "projectId",
  "siteOnly",
  "unlisted",
  "noindex",
  "rss",
];
export function publicDocument(text, preview = false) {
  const { data: raw, body } = parse(text);
  const data = publishableSchema.parse(raw);
  const safe = Object.fromEntries(
    publicKeys
      .filter((key) => data[key] !== undefined)
      .map((key) => [key, data[key]]),
  );
  if (preview)
    Object.assign(safe, { noindex: true, rss: false, unlisted: false });
  let rendered = body.replace(
    /\]\((?:\.\.\/)?(concepts|articles)\/([a-z0-9-]+)\.md\)/g,
    (_, kind, slug) =>
      `](/${kind === "articles" ? "experiences" : kind}/${slug}/)`,
  );
  assertPublicText(rendered);
  return serialize(safe, rendered);
}
export function assertPublicText(text) {
  if (
    /(?:\/home\/|\/Users\/|file:\/\/|\.transcripts\/|\.editorial\/|\[Speaker \d+\]|(?:\.\.\/)?(?:sources|transcripts|profiles|records|media|revisions)\/|OPENAI_API_KEY|sk-proj-)/i.test(
      text,
    )
  )
    throw new Error(
      "Private source, transcript marker, credential marker or local path in public content",
    );
}
