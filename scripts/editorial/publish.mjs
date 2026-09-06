import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { execFileSync } from "node:child_process";
import { config, deployPreview, checkPreview } from "./deploy.mjs";
import { prepareRelease, inspectArtifact, promote, run } from "./releases.mjs";
import { readJSON, writeJSON, inside } from "./documents.mjs";

const { values: v, positionals: p } = parseArgs({
  allowPositionals: true,
  options: Object.fromEntries(
    [
      "root",
      "code",
      "code-revision",
      "release-id",
      "expected-sha256",
      "operation-id",
      "public-checkout",
      "url",
    ].map((key) => [key, { type: "string" }]),
  ),
});
const root = path.resolve(v.root ?? process.env.EDITORIAL_ROOT ?? ".editorial");
const code = path.resolve(v.code ?? ".");
const id = v["release-id"];
function persistRecords() {
  run("git", ["add", "records"], { cwd: root });
  if (
    execFileSync("git", ["diff", "--cached", "--name-only"], {
      cwd: root,
      encoding: "utf8",
    }).trim()
  ) {
    run("git", ["commit", "-m", `publish: record ${id}`], { cwd: root });
    run("git", ["push", "origin", "HEAD:main"], { cwd: root });
  }
}
try {
  const c = config(root);
  if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(id ?? ""))
    throw new Error("Supply a release ID");
  const directory = inside(root, `releases/${id}`);
  let result;
  if (["release", "preview"].includes(p[0])) {
    const preview = p[0] === "preview";
    if (!preview && !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(c.firebaseProjectId))
      throw new Error(
        "Configure the allocated Firebase project before building a release",
      );
    result = prepareRelease(root, code, v["code-revision"], {
      id,
      preview,
      siteUrl: preview
        ? `https://${c.previewHostname}`
        : `https://${c.firebaseProjectId}.web.app`,
    });
  } else if (p[0] === "deploy-preview")
    result = deployPreview(root, code, directory);
  else if (p[0] === "check-preview")
    result = await checkPreview(
      directory,
      v.url ??
        `https://${inspectArtifact(directory).mode === "preview" ? c.previewHostname : c.releaseHostname}/`,
    );
  else if (p[0] === "status") result = inspectArtifact(directory);
  else if (["promote", "rollback"].includes(p[0])) {
    const receipt = inspectArtifact(directory);
    const actualCode = execFileSync("git", ["rev-parse", "HEAD"], {
      cwd: code,
      encoding: "utf8",
    }).trim();
    if (actualCode !== receipt.codeRevision)
      throw new Error("Promotion must use the reviewed website tooling commit");
    const publicCheckout = path.resolve(v["public-checkout"] ?? "");
    if (!v["public-checkout"])
      throw new Error("Supply the authenticated public repository checkout");
    const expectedRemotes = [
      `https://github.com/${c.websiteRepository}`,
      `git@github.com:${c.websiteRepository}`,
    ];
    const remote = execFileSync("git", ["remote", "get-url", "origin"], {
      cwd: publicCheckout,
      encoding: "utf8",
    })
      .trim()
      .replace(/\.git$/, "");
    if (!expectedRemotes.includes(remote))
      throw new Error(
        "Public export checkout is not the configured website repository",
      );
    // Fail before touching Firebase if the export branch is stale, dirty, or unwritable.
    if (
      execFileSync("git", ["status", "--porcelain"], {
        cwd: publicCheckout,
        encoding: "utf8",
      }).trim()
    )
      throw new Error("Public export checkout must be clean");
    run("git", ["push", "--dry-run", "origin", `HEAD:${c.websiteBranch}`], {
      cwd: publicCheckout,
    });
    const previewEvidence = readJSON(
      path.join(directory, "preview-check.json"),
    );
    try {
      result = await promote(
        root,
        directory,
        {
          releaseId: id,
          expectedHash: v["expected-sha256"],
          operationId: v["operation-id"],
          previewEvidence,
          rollback: p[0] === "rollback",
        },
        {
          deploy: async (receipt) => {
            if (receipt.siteUrl !== `https://${c.firebaseProjectId}.web.app`)
              throw new Error(
                "Firebase project differs from the reviewed release",
              );
            const firebaseConfig = path.join(directory, "firebase.json");
            writeJSON(firebaseConfig, {
              hosting: { public: "site", ignore: [], trailingSlash: true },
            });
            run(
              path.join(code, "node_modules/.bin/firebase"),
              [
                "deploy",
                "--only",
                "hosting",
                "--project",
                c.firebaseProjectId,
                "--config",
                firebaseConfig,
                "--non-interactive",
              ],
              { cwd: directory },
            );
            return {
              project: c.firebaseProjectId,
              artifactSha256: receipt.artifactSha256,
              at: new Date().toISOString(),
            };
          },
          exportSource: async (receipt) => {
            for (const kind of ["experiences", "concepts"]) {
              const target = inside(publicCheckout, `src/content/${kind}`);
              fs.rmSync(target, { recursive: true, force: true });
              fs.mkdirSync(target, { recursive: true });
              const source = path.join(
                directory,
                "public-source/src/content",
                kind,
              );
              if (fs.existsSync(source))
                fs.cpSync(source, target, { recursive: true });
            }
            fs.copyFileSync(
              path.join(directory, "public-source/content-manifest.json"),
              path.join(publicCheckout, "content-manifest.json"),
            );
            run("git", ["add", "src/content", "content-manifest.json"], {
              cwd: publicCheckout,
            });
            if (
              execFileSync("git", ["diff", "--cached", "--name-only"], {
                cwd: publicCheckout,
                encoding: "utf8",
              }).trim()
            )
              run("git", ["commit", "-m", `content: publish ${receipt.id}`], {
                cwd: publicCheckout,
              });
            run("git", ["push", "origin", `HEAD:${c.websiteBranch}`], {
              cwd: publicCheckout,
            });
            return {
              commit: execFileSync("git", ["rev-parse", "HEAD"], {
                cwd: publicCheckout,
                encoding: "utf8",
              }).trim(),
            };
          },
        },
      );
    } finally {
      persistRecords();
    }
  } else
    throw new Error(
      "Operations: preview, release, deploy-preview, check-preview, status, promote, rollback",
    );
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
