import fs from "node:fs";
import path from "node:path";
import {
  commonSchema,
  publishableSchema,
  files,
  parse,
  hash,
  inside,
  readJSON,
  readRevision,
} from "./documents.mjs";
import { validateSelection } from "./workflow.mjs";

// Audio is deliberately optional on fresh clones. Stored transcripts and immutable revisions are not.
export function validatePrivate(root) {
  let documents = 0,
    missingLocalAudio = 0;
  const folders = {
    sources: "source",
    articles: "article",
    concepts: "concept",
    profiles: "writing-profile",
    records: "editorial-record",
  };
  for (const [folder, type] of Object.entries(folders)) {
    for (const file of files(path.join(root, folder)).filter((file) =>
      file.endsWith(".md"),
    )) {
      const { data } = parse(fs.readFileSync(file, "utf8"));
      commonSchema.parse(data);
      if (data.type !== type) throw new Error(`Wrong type in ${folder}`);
      documents++;
      if (["article", "concept"].includes(type)) {
        publishableSchema.parse(data);
        if (path.basename(file) !== `${data.slug}.md`)
          throw new Error("Document filename and slug disagree");
        for (const slug of data.concepts ?? [])
          if (!fs.existsSync(inside(root, `concepts/${slug}.md`)))
            throw new Error(`Broken concept: ${slug}`);
        for (const source of data.sources ?? []) {
          if (
            !/^sources\/[a-z0-9-]+\.md$/.test(source) ||
            !fs.existsSync(inside(root, source))
          )
            throw new Error("Broken private source reference");
        }
        if (data.writingProfile) {
          const { version, revision } = data.writingProfile;
          if (!/^\d+\.\d+\.\d+$/.test(version))
            throw new Error("Invalid writing profile version");
          const profileFile = inside(root, `profiles/history/${version}.md`);
          if (!fs.existsSync(profileFile))
            throw new Error("Missing writing profile snapshot");
          if (revision && hash(fs.readFileSync(profileFile)) !== revision)
            throw new Error("Writing profile checksum mismatch");
        }
      }
      if (type === "source")
        for (const variant of data.variants ?? []) {
          const resource = inside(root, variant.resource);
          if (
            !/^(media|transcripts)\/[a-f0-9]{64}\.[a-z0-9]+$/.test(
              variant.resource,
            )
          )
            throw new Error("Invalid source resource");
          if (variant.kind === "audio" && !fs.existsSync(resource)) {
            missingLocalAudio++;
            continue;
          }
          if (hash(fs.readFileSync(resource)) !== variant.sha256)
            throw new Error("Source resource checksum mismatch");
        }
    }
  }
  for (const file of files(path.join(root, "revisions")))
    readRevision(root, path.basename(file, ".md"));
  validateSelection(root, readJSON(path.join(root, "selection.json"), {}));
  return { documents, missingLocalAudio };
}
