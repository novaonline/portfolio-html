import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import {
  init,
  approve,
  select,
  exportContent,
  checkpoint,
} from "./workflow.mjs";
import { importFiles } from "./import.mjs";
import { migrate } from "./migrate.mjs";
import { askProfile, answerProfile, resumeProfile } from "./profile.mjs";
import { validatePrivate } from "./validate-private.mjs";
import { snapshot, readJSON } from "./documents.mjs";

const { values: v, positionals: p } = parseArgs({
  allowPositionals: true,
  options: Object.fromEntries(
    [
      "root",
      "site",
      "archive",
      "downloads",
      "legacy-site",
      "label",
      "by",
      "reason",
      "revision",
      "question",
      "uncertainty",
      "answer-file",
      "proposed-file",
      "bump",
      "explanation",
      "state-file",
    ]
      .map((key) => [key, { type: "string" }])
      .concat([["preview", { type: "boolean" }]]),
  ),
});
const root = path.resolve(v.root ?? process.env.EDITORIAL_ROOT ?? ".editorial");
const site = path.resolve(v.site ?? ".");
try {
  let result;
  switch (p[0]) {
    case "init":
      init(root);
      result = { root };
      break;
    case "import":
      if (!p[1])
        throw new Error("Supply one or more exported audio/text paths");
      result = importFiles(root, p.slice(1), { label: v.label });
      break;
    case "migrate":
      if (!v.archive || !v.downloads)
        throw new Error("Supply --archive and --downloads");
      result = migrate(
        root,
        site,
        v.archive,
        v.downloads,
        v["legacy-site"] ?? site,
      );
      break;
    case "validate":
      result = validatePrivate(root);
      break;
    case "status":
      result = {
        state: readJSON(path.join(root, "state.json"), {}),
        selection: readJSON(path.join(root, "selection.json"), {}),
        migration: readJSON(path.join(root, "migration.json"), null),
      };
      break;
    case "snapshot":
      result = snapshot(root, p[1]);
      break;
    case "approve":
      result = approve(root, p[1], {
        by: v.by,
        reason: v.reason,
        expectedRevision: v.revision,
      });
      break;
    case "select":
      result = select(root, p.slice(1));
      break;
    case "export":
      result = exportContent(root, site, { preview: v.preview });
      break;
    case "checkpoint":
      result = checkpoint(
        root,
        JSON.parse(fs.readFileSync(v["state-file"], "utf8")),
      );
      break;
    case "profile-question":
      result = askProfile(root, v.question, v.uncertainty);
      break;
    case "profile-resume":
      result = resumeProfile(root);
      break;
    case "profile-answer":
      result = answerProfile(
        root,
        fs.readFileSync(v["answer-file"], "utf8"),
        v["proposed-file"],
        v.bump,
        v.explanation,
      );
      break;
    default:
      throw new Error(
        "Commands: init, validate, import, migrate, status, snapshot, approve, select, export, checkpoint, profile-question, profile-answer, profile-resume. See docs/editorial.md.",
      );
  }
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
