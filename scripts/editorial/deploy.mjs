import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import YAML from "yaml";
import { z } from "zod";
import { isIP } from "node:net";
import { write, readJSON, writeJSON } from "./documents.mjs";
import { inspectArtifact, run } from "./releases.mjs";

// Only explicit private LAN/VPN ranges; public ranges and masks spanning outside them fail closed.
export function validateCidr(cidr) {
  const parts = cidr.split("/"),
    [ip, bits] = parts,
    family = isIP(ip),
    n = Number(bits);
  const octets = ip.split(".").map(Number);
  const privateV4 =
    family === 4 &&
    ((octets[0] === 10 && n >= 8) ||
      (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31 && n >= 12) ||
      (octets[0] === 192 && octets[1] === 168 && n >= 16) ||
      (octets[0] === 100 && octets[1] >= 64 && octets[1] <= 127 && n >= 10));
  const privateV6 = family === 6 && /^f[cd]/i.test(ip) && n >= 7;
  if (
    parts.length !== 2 ||
    !/^\d+$/.test(bits ?? "") ||
    n > (family === 4 ? 32 : 128) ||
    !(privateV4 || privateV6)
  )
    throw new Error("Explicit non-public LAN/VPN CIDRs are required");
  return cidr;
}

export function config(root) {
  const schema = z.object({
    editorialRepository: z.string().regex(/^[\w.-]+\/[\w.-]+$/),
    websiteRepository: z.string().regex(/^[\w.-]+\/[\w.-]+$/),
    websiteBranch: z.string().regex(/^[\w./-]+$/),
    firebaseProjectId: z.string(),
    runnerLabel: z.string(),
    runnerIp: z.string().default(""),
    previewHostNetwork: z.boolean().default(false),
    previewPort: z.number().int().min(1024).max(65535).default(18080),
    releasePort: z.number().int().min(1024).max(65535).default(18081),
    registry: z.string().regex(/^[a-z0-9.-]+(?::\d+)?$/),
    namespace: z.string().regex(/^[a-z0-9-]+$/),
    previewHostname: z.string().regex(/^[a-z0-9.-]+$/),
    releaseHostname: z.string().regex(/^[a-z0-9.-]+$/),
    allowedCidrs: z.array(z.string()).min(1),
    workloadIdentityProvider: z.string(),
    serviceAccount: z.string(),
  });
  const result = schema.parse(readJSON(path.join(root, "publishing.json")));
  for (const cidr of result.allowedCidrs) validateCidr(cidr);
  if (result.runnerIp) validateCidr(`${result.runnerIp}/32`);
  if (result.previewPort === result.releasePort)
    throw new Error("Draft and release ports must differ");
  return result;
}
export function deployPreview(root, code, directory) {
  const c = config(root),
    receipt = inspectArtifact(directory);
  const name =
    receipt.mode === "preview" ? "portfolio-draft" : "portfolio-release";
  const image = `${c.registry}/portfolio-editorial:${receipt.artifactSha256}`;
  fs.copyFileSync(
    path.join(code, "deploy/preview.Dockerfile"),
    path.join(directory, "Dockerfile"),
  );
  write(
    path.join(directory, ".dockerignore"),
    "*\n!site/\n!site/**\n!Dockerfile\n",
  );
  run("docker", ["build", "--tag", image, directory]);
  run("docker", ["push", image]);
  const digests = JSON.parse(
    execFileSync(
      "docker",
      ["image", "inspect", image, "--format", "{{json .RepoDigests}}"],
      { encoding: "utf8" },
    ),
  );
  const pinned = digests.find((d) =>
    d.startsWith(`${c.registry}/portfolio-editorial@sha256:`),
  );
  if (!pinned)
    throw new Error("Registry did not return an immutable image digest");
  const values = {
    image: pinned,
    hostname:
      receipt.mode === "preview" ? c.previewHostname : c.releaseHostname,
    allowedCidrs: [
      ...c.allowedCidrs,
      ...(c.runnerIp ? [`${c.runnerIp}/32`] : []),
    ],
    hostNetwork: c.previewHostNetwork,
    port: receipt.mode === "preview" ? c.previewPort : c.releasePort,
  };
  const deployDir = path.join(root, "deploy", name);
  fs.mkdirSync(deployDir, { recursive: true });
  fs.cpSync(path.join(code, "deploy/helm/preview"), deployDir, {
    recursive: true,
  });
  write(path.join(deployDir, "values.yaml"), YAML.stringify(values));
  // Argo CD watches only the committed chart/values, never the editing workspace.
  run("git", ["add", `deploy/${name}`], { cwd: root });
  if (
    execFileSync("git", ["diff", "--cached", "--name-only"], {
      cwd: root,
      encoding: "utf8",
    }).trim()
  ) {
    run("git", ["commit", "-m", `deploy: ${name} ${receipt.id}`], {
      cwd: root,
    });
    run("git", ["push", "origin", "HEAD:main"], { cwd: root });
  }
  return {
    application: name,
    image: pinned,
    hostname: values.hostname,
    artifactSha256: receipt.artifactSha256,
  };
}
export async function checkPreview(directory, url) {
  const receipt = inspectArtifact(directory),
    base = new URL(url);
  // Compare every served byte, including assets. Checking just a landing page cannot establish artifact identity.
  const { files, hash } = await import("./documents.mjs");
  for (const file of files(path.join(directory, "site"))) {
    const relative = path
      .relative(path.join(directory, "site"), file)
      .split(path.sep)
      .join("/");
    const response = await fetch(new URL(relative, base), {
      signal: AbortSignal.timeout(15000),
      redirect: "error",
    });
    if (
      !response.ok ||
      !response.headers.get("x-robots-tag")?.includes("noindex")
    )
      throw new Error(
        `Preview unavailable or indexing protection missing: ${relative}`,
      );
    if (
      hash(Buffer.from(await response.arrayBuffer())) !==
      hash(fs.readFileSync(file))
    )
      throw new Error(`Preview byte mismatch: ${relative}`);
  }
  const evidence = {
    result: "passed",
    artifactSha256: receipt.artifactSha256,
    packageSha256: receipt.packageSha256,
    url: base.href,
    at: new Date().toISOString(),
  };
  writeJSON(path.join(directory, "preview-check.json"), evidence);
  return evidence;
}
