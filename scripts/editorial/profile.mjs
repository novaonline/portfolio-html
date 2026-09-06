import fs from "node:fs";
import path from "node:path";
import {
  parse,
  serialize,
  write,
  writeJSON,
  readJSON,
  immutable,
  hash,
  record,
} from "./documents.mjs";

// A complete before/after diff remains readable without a Git client.
export const diffLines = (before, after) =>
  `--- before\n+++ after\n${before
    .split("\n")
    .map((line) => "-" + line)
    .join("\n")}\n${after
    .split("\n")
    .map((line) => "+" + line)
    .join("\n")}\n`;
export function askProfile(root, question, uncertainty) {
  if (!question || !uncertainty)
    throw new Error("Question and uncertainty are required");
  const state = readJSON(path.join(root, "state.json"), {});
  if (state.pendingQuestion)
    throw new Error("An unanswered question is already pending; resume it");
  const profile = parse(
    fs.readFileSync(path.join(root, "profiles/current.md"), "utf8"),
  );
  const pendingQuestion = {
    question,
    uncertainty,
    profileVersion: profile.data.version,
    profileRevision: hash(
      fs.readFileSync(path.join(root, "profiles/current.md")),
    ),
  };
  record(root, "profile-question", pendingQuestion);
  writeJSON(path.join(root, "state.json"), { ...state, pendingQuestion });
  return { profile: profile.data, summary: profile.body, ...pendingQuestion };
}
export function resumeProfile(root) {
  const journalFile = path.join(root, "profiles/pending-mutation.json");
  const journal = readJSON(journalFile);
  if (!journal) throw new Error("No pending profile mutation");
  const { before, after, answerData } = journal;
  const file = path.join(root, "profiles/current.md");
  const currentHash = hash(fs.readFileSync(file));
  if (![hash(before), hash(after)].includes(currentHash))
    throw new Error("Profile diverged from pending mutation");
  const state = readJSON(path.join(root, "state.json"), {});
  if (
    state.pendingQuestion &&
    state.pendingQuestion.profileRevision !== hash(before)
  )
    throw new Error("Another profile question is active");
  const answerId = record(root, "profile-answer", answerData);
  const next = answerData.to;
  immutable(path.join(root, `profiles/history/${next}.md`), after);
  immutable(
    path.join(root, `profiles/history/${next}.diff`),
    diffLines(before, after),
  );
  immutable(
    path.join(root, `profiles/history/${next}.json`),
    JSON.stringify(
      {
        answerId,
        bump: answerData.bump,
        explanation: answerData.explanation,
        before: hash(before),
        after: hash(after),
      },
      null,
      2,
    ) + "\n",
  );
  write(file, after);
  writeJSON(path.join(root, "state.json"), {
    ...state,
    pendingQuestion: null,
    profileVersion: next,
    nextActions: [
      "Review the updated profile, then ask the next single question.",
    ],
  });
  fs.unlinkSync(journalFile);
  return { version: next, answerId };
}
export function answerProfile(root, answer, proposedFile, bump, explanation) {
  if (
    !answer?.trim() ||
    !explanation?.trim() ||
    !["major", "minor", "patch"].includes(bump)
  )
    throw new Error("Answer, bump and explanation are required");
  const journalFile = path.join(root, "profiles/pending-mutation.json");
  if (fs.existsSync(journalFile))
    throw new Error(
      "Resume the pending mutation with profile-resume before answering again",
    );
  const state = readJSON(path.join(root, "state.json"), {}),
    pending = state.pendingQuestion;
  if (!pending) throw new Error("No pending profile question");
  const before = fs.readFileSync(
    path.join(root, "profiles/current.md"),
    "utf8",
  );
  if (hash(before) !== pending.profileRevision)
    throw new Error(
      "Profile changed since the question; reconcile before answering",
    );
  const current = parse(before),
    proposed = parse(fs.readFileSync(proposedFile, "utf8"));
  if (!/^\d+\.\d+\.\d+$/.test(current.data.version))
    throw new Error("Invalid profile version");
  if (
    proposed.data.type !== "writing-profile" ||
    !proposed.data.title ||
    !proposed.data.description
  )
    throw new Error("Invalid proposed profile");
  const version = current.data.version.split(".").map(Number);
  const index = { major: 0, minor: 1, patch: 2 }[bump];
  version[index]++;
  for (let i = index + 1; i < 3; i++) version[i] = 0;
  const next = version.join(".");
  const after = serialize({ ...proposed.data, version: next }, proposed.body);
  writeJSON(journalFile, {
    before,
    after,
    answerData: {
      ...pending,
      answer,
      bump,
      explanation,
      from: current.data.version,
      to: next,
      at: new Date().toISOString(),
    },
  });
  return resumeProfile(root);
}
