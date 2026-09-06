import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import YAML from "yaml";
import { config } from "./deploy.mjs";
import { write, writeJSON, readJSON } from "./documents.mjs";

const root = path.resolve(process.argv[2] ?? ".editorial");
const c = config(root);
// An undeployed channel is an empty Helm application, rather than an Argo path error.
for (const channel of ["portfolio-draft", "portfolio-release"]) {
  const chart = path.join(root, "deploy", channel, "Chart.yaml");
  if (!fs.existsSync(chart))
    write(
      chart,
      YAML.stringify({
        apiVersion: "v2",
        name: channel,
        version: "0.1.0",
        description: "Awaiting the first reviewed artifact deployment.",
      }),
    );
}
const resources = [
  { apiVersion: "v1", kind: "Namespace", metadata: { name: c.namespace } },
  {
    apiVersion: "actions.summerwind.dev/v1alpha1",
    kind: "RunnerDeployment",
    metadata: {
      name: "portfolio-editorial",
      namespace: c.runnerNamespace,
    },
    spec: {
      replicas: 1,
      template: {
        metadata: {
          annotations: c.runnerIp
            ? {
                "ovn.kubernetes.io/ip_pool": c.runnerIp,
                "ovn.kubernetes.io/port_security": "true",
              }
            : {},
        },
        spec: {
          repository: c.editorialRepository,
          labels: ["self-hosted", c.runnerLabel],
        },
      },
    },
  },
  ...["portfolio-draft", "portfolio-release"].map((name) => ({
    apiVersion: "argoproj.io/v1alpha1",
    kind: "Application",
    metadata: { name, namespace: "argocd" },
    spec: {
      project: "default",
      source: {
        repoURL: `git@github.com:${c.editorialRepository}.git`,
        targetRevision: "main",
        path: `deploy/${name}`,
      },
      destination: {
        server: "https://kubernetes.default.svc",
        namespace: c.namespace,
      },
      syncPolicy: {
        automated: { prune: false, selfHeal: true },
        syncOptions: ["CreateNamespace=true"],
      },
    },
  })),
];
const manifest = path.join(root, "bootstrap/cluster.yaml");
write(manifest, resources.map((item) => YAML.stringify(item)).join("---\n"));
if (!process.argv.includes("--apply")) {
  console.log(
    `Rendered ${manifest}; add --apply to bootstrap the dedicated runner and Argo applications.`,
  );
  process.exit(0);
}
const access = path.join(root, "media/access");
fs.mkdirSync(access, { recursive: true, mode: 0o700 });
function deployKey(repository, filename, title, writable = false) {
  const key = path.join(access, filename);
  if (!fs.existsSync(key))
    execFileSync(
      "ssh-keygen",
      ["-t", "ed25519", "-N", "", "-C", title, "-f", key],
      { stdio: "ignore" },
    );
  const keys = JSON.parse(
    execFileSync("gh", ["api", `repos/${repository}/keys`], {
      encoding: "utf8",
    }),
  );
  const publicKey = fs
    .readFileSync(key + ".pub", "utf8")
    .trim()
    .split(" ")
    .slice(0, 2)
    .join(" ");
  const existing = keys.find((item) => item.key === publicKey);
  if (!existing)
    execFileSync(
      "gh",
      [
        "repo",
        "deploy-key",
        "add",
        key + ".pub",
        "--repo",
        repository,
        "--title",
        title,
        ...(writable ? ["--allow-write"] : []),
      ],
      { stdio: "pipe" },
    );
  else if (existing.read_only === writable)
    throw new Error(
      "Existing deploy key permissions differ from configuration",
    );
  return key;
}
const key = deployKey(
  c.editorialRepository,
  "argocd",
  "portfolio-editorial-argocd",
);
// A repository-specific SSH key avoids reusing the broad local GitHub CLI token in CI.
const exportKey = deployKey(
  c.websiteRepository,
  "public-export",
  "portfolio-editorial-public-export",
  true,
);
execFileSync(
  "gh",
  ["secret", "set", "WEBSITE_EXPORT_SSH_KEY", "--repo", c.editorialRepository],
  { input: fs.readFileSync(exportKey), stdio: ["pipe", "pipe", "pipe"] },
);
// Secret plaintext never enters terminal output or a tracked file.
const secret = {
  apiVersion: "v1",
  kind: "Secret",
  metadata: {
    name: "portfolio-editorial-repository",
    namespace: "argocd",
    labels: { "argocd.argoproj.io/secret-type": "repository" },
  },
  stringData: {
    type: "git",
    url: `git@github.com:${c.editorialRepository}.git`,
    sshPrivateKey: fs.readFileSync(key, "utf8"),
  },
};
execFileSync("kubectl", ["apply", "-f", "-"], {
  input: YAML.stringify(secret),
  stdio: ["pipe", "pipe", "pipe"],
});
execFileSync("kubectl", ["apply", "-f", manifest], { stdio: "inherit" });
writeJSON(path.join(root, "bootstrap/status.json"), {
  ...readJSON(path.join(root, "bootstrap/status.json"), {}),
  clusterAppliedAt: new Date().toISOString(),
  repository: c.editorialRepository,
});
