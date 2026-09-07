import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  files,
  hash,
  parse,
  assertPublicText,
  readJSON,
  slugSchema,
} from "./documents.mjs";

export function validatePublic(site, allowPreview = false) {
  const manifest = readJSON(path.join(site, "content-manifest.json"));
  if (!manifest || !["public", "preview"].includes(manifest.mode))
    throw new Error("Missing content manifest; export approved content first");
  if (manifest.mode === "preview" && !allowPreview)
    throw new Error("Draft preview content is forbidden in a public build");
  const content = ["experiences", "concepts"]
    .flatMap((kind) => files(path.join(site, "src/content", kind)))
    .map((file) => path.relative(site, file));
  if (
    JSON.stringify(content.sort()) !==
    JSON.stringify(Object.keys(manifest.documents).sort())
  )
    throw new Error("Content files differ from the selected export");
  const conceptSlugs = new Set();
  const docs = [];
  const allowed = new Set([
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
  ]);
  for (const relative of content) {
    const text = fs.readFileSync(path.join(site, relative), "utf8");
    if (hash(text) !== manifest.documents[relative])
      throw new Error(`Export changed: ${relative}`);
    const { data } = parse(text);
    if (Object.keys(data).some((key) => !allowed.has(key)))
      throw new Error("Private or unknown metadata in export");
    if (
      !data.title ||
      !data.description ||
      !["article", "concept"].includes(data.type)
    )
      throw new Error("Invalid public document");
    slugSchema.parse(data.slug);
    assertPublicText(text);
    if (manifest.mode === "public" && data.unlisted)
      throw new Error("Private draft in public export");
    if (data.type === "concept") conceptSlugs.add(data.slug);
    docs.push(data);
  }
  for (const doc of docs)
    for (const slug of doc.concepts ?? [])
      if (!conceptSlugs.has(slug))
        throw new Error(`Broken concept reference: ${slug}`);
  return { documents: docs.length, mode: manifest.mode };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  try {
    console.log(
      validatePublic(process.cwd(), process.env.SITE_PREVIEW === "1"),
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
