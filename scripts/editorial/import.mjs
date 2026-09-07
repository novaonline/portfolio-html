import fs from "node:fs";
import path from "node:path";
import {
  hash,
  files,
  parse,
  serialize,
  write,
  writeJSON,
  readJSON,
  immutable,
  record,
} from "./documents.mjs";

export function importFiles(root, inputs, { label = "original" } = {}) {
  const inventoryFile = path.join(root, "inventory.json");
  const inventory = readJSON(inventoryFile, { version: 1, files: {} });
  const imported = new Set();
  for (const input of inputs) {
    const absolute = path.resolve(input);
    const list = fs.statSync(absolute).isDirectory()
      ? files(absolute)
      : [absolute];
    for (const file of list.filter((file) =>
      /\.(txt|m4a|mp3|wav|mp4|webm)$/i.test(file),
    )) {
      const bytes = fs.readFileSync(file),
        digest = hash(bytes);
      const ext = path.extname(file).toLowerCase();
      const audio = ext !== ".txt";
      const stem = path.basename(file, path.extname(file));
      const sourceId = stem
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      const variantLabel = file.includes("/openai/")
        ? "recovered-openai-folder"
        : file.includes("/whisper-small/")
          ? "recovered-whisper-small-folder"
          : label;
      const asset = `${audio ? "media" : "transcripts"}/${digest}${ext}`;
      immutable(path.join(root, asset), bytes);
      const item = inventory.files[digest] ?? {
        sha256: digest,
        asset,
        kind: audio ? "audio" : "transcript",
        locations: [],
        labels: [],
      };
      if (!item.locations.includes(file)) item.locations.push(file);
      if (!item.labels.includes(variantLabel)) item.labels.push(variantLabel);
      item.locations.sort();
      item.labels.sort();
      inventory.files[digest] = item;
      const sourceFile = path.join(root, "sources", `${sourceId}.md`);
      const previous = fs.existsSync(sourceFile)
        ? parse(fs.readFileSync(sourceFile, "utf8"))
        : null;
      const data = previous?.data ?? {
        type: "source",
        title: stem,
        description: "Recovered recording and transcript provenance.",
        tags: [],
        recordingLabel: stem,
        recordedAt: null,
        recordingDateNote:
          "Year and timezone are not established by the exported filename.",
        variants: [],
      };
      const variant = data.variants.find((v) => v.sha256 === digest);
      if (!variant)
        data.variants.push({
          sha256: digest,
          resource: asset,
          kind: item.kind,
          labels: [variantLabel],
          originalLocations: [file],
        });
      else {
        variant.labels = [...new Set([...variant.labels, variantLabel])].sort();
        variant.originalLocations = [
          ...new Set([...variant.originalLocations, file]),
        ].sort();
      }
      data.variants.sort((a, b) => a.sha256.localeCompare(b.sha256));
      write(
        sourceFile,
        serialize(
          data,
          previous?.body ??
            "Recovered variants are preserved verbatim. Folder names are labels, not verified model or processing-time metadata.\n",
        ),
      );
      imported.add(`sources/${sourceId}.md`);
    }
  }
  inventory.files = Object.fromEntries(
    Object.entries(inventory.files).sort(([a], [b]) => a.localeCompare(b)),
  );
  writeJSON(inventoryFile, inventory);
  return [...imported].sort();
}

export function importRecovery(root, archive, downloads) {
  const originals = fs
    .readdirSync(archive)
    .filter((name) => name.endsWith(".txt"));
  const targets = new Set([
    ...originals,
    "Aug 18 at 10-06.txt",
    ...originals.map((name) => name.replace(/\.txt$/, ".m4a")),
    "Aug 18 at 10-06.m4a",
  ]);
  // Only inspect matching exports; unrelated Downloads files are not imported.
  const matches = [];
  function visit(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) visit(path.join(dir, entry.name));
      else if (entry.isFile() && targets.has(entry.name))
        matches.push(path.join(dir, entry.name));
    }
  }
  visit(downloads);
  const imported = importFiles(root, [archive, ...matches]);
  const notes = path.join(archive, "review-progress.md");
  if (fs.existsSync(notes))
    record(
      root,
      "historical-review",
      {
        originalLocation: notes,
        sha256: hash(fs.readFileSync(notes)),
        authority:
          "Historical evidence only; no new publication authorization.",
      },
      fs.readFileSync(notes, "utf8"),
    );
  return imported;
}
