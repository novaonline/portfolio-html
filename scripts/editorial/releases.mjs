import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  files,
  hash,
  writeJSON,
  readJSON,
  assertPublicText,
  record,
  inside,
} from "./documents.mjs";
import { validatePrivate } from "./validate-private.mjs";
import { exportContent } from "./workflow.mjs";

export const run = (program, args, options = {}) =>
  execFileSync(program, args, { stdio: "inherit", ...options });
export function treeHash(root) {
  return hash(
    JSON.stringify(
      files(root).map((file) => [
        path.relative(root, file).split(path.sep).join("/"),
        hash(fs.readFileSync(file)),
      ]),
    ),
  );
}
export function packageHash(receipt) {
  const { packageSha256: _, ...immutableReceipt } = receipt;
  return hash(JSON.stringify(immutableReceipt));
}
export function inspectArtifact(directory) {
  const receipt = readJSON(path.join(directory, "receipt.json"));
  if (!receipt || receipt.version !== 1)
    throw new Error("Missing release receipt");
  if (packageHash(receipt) !== receipt.packageSha256)
    throw new Error("Release receipt checksum mismatch");
  for (const [folder, key] of [
    ["site", "artifactSha256"],
    ["public-source", "sourceSha256"],
  ]) {
    if (
      !fs.existsSync(path.join(directory, folder)) ||
      treeHash(path.join(directory, folder)) !== receipt[key]
    )
      throw new Error(`Release ${folder} checksum mismatch`);
  }
  for (const file of files(path.join(directory, "site")).filter((file) =>
    /\.(html|xml|txt|json|js|css)$/.test(file),
  ))
    assertPublicText(fs.readFileSync(file, "utf8"));
  return receipt;
}
export function prepareRelease(
  root,
  code,
  codeRevision,
  { id, siteUrl, preview = false, build = true } = {},
) {
  if (!/^[a-f0-9]{40}$/.test(codeRevision))
    throw new Error("Pin a full website commit SHA");
  if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(id ?? ""))
    throw new Error("Supply a stable release ID");
  const url = new URL(siteUrl);
  if (
    !preview &&
    (url.protocol !== "https:" || !url.hostname.endsWith(".web.app"))
  )
    throw new Error("A release requires the allocated Firebase web.app URL");
  const directory = inside(root, `releases/${id}`);
  if (fs.existsSync(path.join(directory, "receipt.json"))) {
    const existing = inspectArtifact(directory);
    if (
      existing.codeRevision !== codeRevision ||
      existing.siteUrl !== siteUrl ||
      existing.mode !== (preview ? "preview" : "release")
    )
      throw new Error(
        "Release ID already belongs to another build; use a new ID",
      );
    return existing;
  }
  if (
    execFileSync("git", ["status", "--porcelain"], {
      cwd: root,
      encoding: "utf8",
    }).trim()
  )
    throw new Error("Commit editorial changes before preparing a release");
  validatePrivate(root);
  const editorialRevision = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  }).trim();
  const work = inside(root, `releases/${id}/work`);
  // An interrupted build has no reviewed identity. Remove its partial output before retrying.
  for (const folder of ["work", "site", "public-source"])
    fs.rmSync(path.join(directory, folder), { recursive: true, force: true });
  fs.mkdirSync(work, { recursive: true });
  // Extract only a pinned commit; never include the website working tree or private resume.
  const archive = path.join(directory, "code.tar");
  execFileSync(
    "git",
    ["archive", "--format=tar", `--output=${archive}`, codeRevision],
    { cwd: code },
  );
  run("tar", ["-xf", archive, "-C", work]);
  fs.unlinkSync(archive);
  const { selected } = exportContent(root, work, { preview });
  const source = path.join(directory, "public-source");
  fs.mkdirSync(source, { recursive: true });
  for (const kind of ["experiences", "concepts"])
    fs.cpSync(
      path.join(work, "src/content", kind),
      path.join(source, "src/content", kind),
      { recursive: true },
    );
  fs.copyFileSync(
    path.join(work, "content-manifest.json"),
    path.join(source, "content-manifest.json"),
  );
  const env = {
    ...process.env,
    SITE_URL: siteUrl,
    SITE_PREVIEW: preview ? "1" : "0",
  };
  // The caller passes a reviewed site profile explicitly if needed; never inherit a local raw resume.
  delete env.RESUME_JSON;
  delete env.OPENAI_API_KEY;
  if (build) {
    run("npm", ["ci", "--no-audit", "--no-fund"], { cwd: work, env });
    run("npm", ["run", "check"], { cwd: work, env });
    run("npm", ["run", "build"], { cwd: work, env });
  }
  if (!fs.existsSync(path.join(work, "dist/index.html")))
    throw new Error("Build did not produce a website");
  fs.cpSync(path.join(work, "dist"), path.join(directory, "site"), {
    recursive: true,
  });
  const receipt = {
    version: 1,
    id,
    mode: preview ? "preview" : "release",
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
    codeRevision,
    editorialRevision,
    selected,
    siteUrl,
    artifactSha256: treeHash(path.join(directory, "site")),
    sourceSha256: treeHash(source),
  };
  receipt.packageSha256 = packageHash(receipt);
  writeJSON(path.join(directory, "receipt.json"), receipt);
  inspectArtifact(directory);
  fs.rmSync(work, { recursive: true, force: true });
  return receipt;
}

export function authorizePromotion(
  directory,
  {
    expectedHash,
    releaseId,
    previewEvidence,
    rollback = false,
    successful = false,
  },
) {
  const receipt = inspectArtifact(directory);
  if (receipt.mode !== "release")
    throw new Error("Draft previews cannot be promoted");
  if (receipt.id !== releaseId || receipt.packageSha256 !== expectedHash)
    throw new Error("Release identity or reviewed checksum mismatch");
  if (new Date(receipt.expiresAt).getTime() <= Date.now())
    throw new Error("Release artifact expired; build and review a new release");
  if (
    !previewEvidence ||
    previewEvidence.packageSha256 !== expectedHash ||
    previewEvidence.result !== "passed"
  )
    throw new Error("Release preview has not passed validation");
  if (rollback && !successful)
    throw new Error("Rollback requires a previously successful public release");
  return receipt;
}

// Firebase switches the live channel only after all files are uploaded and the version is finalized.
// Export the matching public snapshot after deployment; save each step so retries can resume it.
export async function promote(
  root,
  directory,
  options,
  { deploy, exportSource },
) {
  const { releaseId, expectedHash, rollback = false, operationId } = options;
  if (!/^[a-z0-9-]+$/.test(operationId ?? ""))
    throw new Error(
      "A unique operation ID is required for resumable promotion",
    );
  const successFile = path.join(root, "records", "successful-releases.json");
  const successful = readJSON(successFile, {});
  const receipt = authorizePromotion(directory, {
    ...options,
    successful: successful[releaseId]?.packageSha256 === expectedHash,
  });
  const stateFile = path.join(root, "records", `promotion-${operationId}.json`);
  const state = readJSON(stateFile, {
    releaseId,
    expectedHash,
    rollback,
    operationId,
  });
  if (
    state.releaseId !== releaseId ||
    state.expectedHash !== expectedHash ||
    state.rollback !== rollback
  )
    throw new Error("Operation ID already belongs to another request");
  const lock = path.join(root, ".promotion-lock");
  fs.mkdirSync(lock); // fail closed when another local promotion is active
  try {
    const activeFile = path.join(root, "records", "active-promotion.json");
    const active = readJSON(activeFile);
    if (active && active.operationId !== operationId)
      throw new Error(
        "Resume the incomplete promotion before starting another",
      );
    const live = readJSON(path.join(root, "records", "live-release.json"));
    if (state.completedAt && live?.operationId === operationId) {
      fs.rmSync(activeFile, { force: true });
      return state;
    }
    if (state.completedAt && active?.operationId !== operationId) {
      if (live?.operationId !== operationId)
        throw new Error(
          "This completed operation has been superseded; use a new operation ID",
        );
      return state;
    }
    writeJSON(activeFile, { operationId, releaseId, expectedHash });
    if (!state.firebase) {
      state.firebase = await deploy(receipt, directory);
      writeJSON(stateFile, state);
    }
    if (!state.publicSource) {
      state.publicSource = await exportSource(receipt, directory);
      writeJSON(stateFile, state);
    }
    state.completedAt = state.completedAt ?? new Date().toISOString();
    writeJSON(stateFile, state);
    successful[releaseId] = {
      packageSha256: expectedHash,
      completedAt: state.completedAt,
    };
    writeJSON(successFile, successful);
    writeJSON(path.join(root, "records", "live-release.json"), {
      releaseId,
      packageSha256: expectedHash,
      operationId,
    });
    record(root, "release-receipt", { ...receipt, promotion: state });
    fs.rmSync(activeFile);
    return state;
  } finally {
    fs.rmdirSync(lock);
  }
}
