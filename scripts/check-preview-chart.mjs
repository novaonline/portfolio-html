import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import YAML from "yaml";

// Render the actual chart, checking both the public entry point and backend isolation.
const root = fs.mkdtempSync(path.join(os.tmpdir(), "portfolio-chart-"));
const file = path.join(root, "values.yaml");
const values = {
  image: "example.invalid/site@sha256:" + "a".repeat(64),
  hostname: "preview.example.invalid",
  allowedCidrs: ["192.168.86.0/24"],
  ingress: { clusterIssuer: "test-issuer" },
};
function render(override = {}) {
  fs.writeFileSync(file, YAML.stringify({ ...values, ...override }));
  return execFileSync(
    "helm",
    ["template", "portfolio-test", "deploy/helm/preview", "-f", file],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
}
try {
  const docs = YAML.parseAllDocuments(render()).map((d) => d.toJSON());
  const resource = (kind) => docs.find((d) => d.kind === kind);
  const service = resource("Service");
  assert.equal(service.spec.type, "ClusterIP");
  assert.ok(!service.metadata.annotations);
  assert.ok(!service.spec.externalTrafficPolicy);
  const deployment = resource("Deployment");
  assert.equal(deployment.spec.template.spec.hostNetwork, false);
  assert.equal(
    deployment.spec.template.spec.containers[0].ports[0].containerPort,
    8080,
  );
  const ingress = resource("Ingress");
  assert.equal(ingress.spec.ingressClassName, "nginx");
  assert.equal(
    ingress.metadata.annotations["cert-manager.io/cluster-issuer"],
    "test-issuer",
  );
  assert.equal(
    ingress.metadata.annotations["external-dns.alpha.kubernetes.io/hostname"],
    values.hostname,
  );
  assert.equal(
    ingress.metadata.annotations["nginx.org/policies"],
    resource("Policy").metadata.name,
  );
  assert.equal(ingress.spec.tls[0].hosts[0], values.hostname);
  assert.deepEqual(
    resource("Policy").spec.accessControl.allow,
    values.allowedCidrs,
  );
  const peers = resource("NetworkPolicy").spec.ingress[0].from;
  assert.equal(peers.length, 2);
  assert.ok(peers.every((p) => p.namespaceSelector && p.podSelector));
  assert.equal(
    peers[0].namespaceSelector.matchLabels["kubernetes.io/metadata.name"],
    "nginx-ingress",
  );
  assert.equal(
    peers[1].podSelector.matchLabels["runner-deployment-name"],
    "portfolio-editorial",
  );
  for (const override of [
    { allowedCidrs: [] },
    { allowedCidrs: ["0.0.0.0/0"] },
    { ingress: { clusterIssuer: "test-issuer", natCidrs: ["100.64.0.2/32"] } },
    { hostNetwork: true },
  ]) {
    assert.throws(() => render(override));
  }
  console.log(
    "Preview chart: ingress/TLS/DNS, ClusterIP, backend isolation and fail-closed configuration passed.",
  );
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
