import { describe, it, expect, afterEach, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  parse,
  serialize,
  write,
  writeJSON,
  readJSON,
  snapshot,
  contextFootnotes,
  publicDocument,
  inside,
} from "../scripts/editorial/documents.mjs";
import {
  init,
  approve,
  select,
  exportContent,
  checkpoint,
} from "../scripts/editorial/workflow.mjs";
import { importFiles } from "../scripts/editorial/import.mjs";
import {
  askProfile,
  answerProfile,
  resumeProfile,
} from "../scripts/editorial/profile.mjs";
import { validatePublic } from "../scripts/editorial/validate-public.mjs";
import {
  treeHash,
  packageHash,
  inspectArtifact,
  authorizePromotion,
  promote,
  prepareRelease,
} from "../scripts/editorial/releases.mjs";
import {
  validateCidr,
  config,
  previewValues,
} from "../scripts/editorial/deploy.mjs";
import { transcribe } from "../scripts/editorial/transcribe.mjs";

const temps = [];
const temp = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "portfolio-test-"));
  temps.push(dir);
  return dir;
};
afterEach(() => {
  for (const dir of temps.splice(0))
    fs.rmSync(dir, { recursive: true, force: true });
});
const article = (extra = {}, body = "A short observation.\n") =>
  serialize(
    {
      type: "article",
      title: "Observation",
      description: "A concrete lesson.",
      slug: "observation",
      date: "2026-02-05",
      editorialStage: "ready",
      concepts: [],
      tags: ["Architecture"],
      unlisted: false,
      noindex: false,
      rss: true,
      sources: ["sources/private.md"],
      writingProfile: { version: "0.1.0" },
      ...extra,
    },
    body,
  );
function reviewed(root, relative, text) {
  write(path.join(root, relative), text);
  const { revision } = snapshot(root, relative);
  approve(root, relative, {
    by: "Test reviewer",
    reason: "Fixture approval",
    expectedRevision: revision,
  });
  select(root, [relative]);
  return revision;
}
describe("source import and durable editorial state", () => {
  it("deduplicates copies, preserves variants and never guesses a recording year", () => {
    const root = temp(),
      input = temp();
    init(root);
    write(path.join(input, "Mar 12 at 06-02.txt"), "Original text");
    write(path.join(input, "copies/Mar 12 at 06-02.txt"), "Original text");
    write(
      path.join(input, "openai/Mar 12 at 06-02.txt"),
      "Different transcription",
    );
    importFiles(root, [input]);
    const before = fs.readFileSync(path.join(root, "inventory.json"), "utf8");
    importFiles(root, [input]);
    expect(fs.readFileSync(path.join(root, "inventory.json"), "utf8")).toBe(
      before,
    );
    const { data } = parse(
      fs.readFileSync(path.join(root, "sources/mar-12-at-06-02.md"), "utf8"),
    );
    expect(data.variants).toHaveLength(2);
    expect(data.recordedAt).toBeNull();
    expect(data.variants.flatMap((v) => v.originalLocations)).toHaveLength(3);
    expect(
      data.variants.every(
        (v) => v.model === undefined && v.processedAt === undefined,
      ),
    ).toBe(true);
  });
  it("resumes a pending question and preserves the answer, snapshot and diff", () => {
    const root = temp();
    init(root);
    const profile = serialize(
      {
        type: "writing-profile",
        title: "Voice",
        description: "Profile",
        version: "0.1.0",
      },
      "Direct voice.\n",
    );
    write(path.join(root, "profiles/current.md"), profile);
    askProfile(root, "Who reads this?", "Audience unknown");
    expect(() => askProfile(root, "Another question?", "Other")).toThrow(
      /pending/,
    );
    checkpoint(root, { activeDocuments: ["articles/observation.md"] });
    expect(
      readJSON(path.join(root, "state.json")).pendingQuestion.question,
    ).toBe("Who reads this?");
    const proposed = path.join(root, "proposed.md");
    write(
      proposed,
      profile.replace("Direct voice.", "Direct voice for curious peers."),
    );
    const result = answerProfile(
      root,
      "Curious peers",
      proposed,
      "minor",
      "Confirms compatible audience preference.",
    );
    expect(result.version).toBe("0.2.0");
    expect(
      fs.readFileSync(path.join(root, "profiles/history/0.2.0.diff"), "utf8"),
    ).toContain("+Direct voice for curious peers.");
    expect(
      fs.readFileSync(
        path.join(root, `records/profile-answer/${result.answerId}.md`),
        "utf8",
      ),
    ).toContain("Curious peers");
    expect(readJSON(path.join(root, "state.json")).pendingQuestion).toBeNull();
  });
  it("converts ContextTerm explanations to accessible Markdown footnotes", () => {
    expect(
      contextFootnotes(
        'import ContextTerm from "x";\n\nAn <ContextTerm term="API" note="A published contract." /> matters.',
      ),
    ).toBe(
      "An API[^context-1] matters.\n\n[^context-1]: A published contract.\n",
    );
  });
});
describe("public revision selection", () => {
  it("keeps the published revision while a replacement draft is edited", () => {
    const root = temp(),
      site = temp();
    init(root);
    const old = reviewed(root, "articles/observation.md", article());
    write(
      path.join(root, "articles/observation.md"),
      article({ editorialStage: "draft" }, "Unfinished new content."),
    );
    exportContent(root, site);
    const output = fs.readFileSync(
      path.join(site, "src/content/experiences/observation.md"),
      "utf8",
    );
    expect(output).toContain("A short observation.");
    expect(output).not.toContain("Unfinished");
    expect(output).not.toMatch(/sources:|writingProfile:|editorialStage:/);
    expect(
      readJSON(path.join(root, "selection.json"))["articles/observation.md"],
    ).toBe(old);
    expect(validatePublic(site).documents).toBe(1);
  });
  it("rejects changed, unapproved revisions and missing concepts before touching exports", () => {
    const root = temp(),
      site = temp();
    init(root);
    const revision = reviewed(root, "articles/observation.md", article());
    exportContent(root, site);
    const before = treeHash(site);
    write(
      path.join(root, "articles/observation.md"),
      article({ concepts: ["missing"] }),
    );
    expect(() =>
      approve(root, "articles/observation.md", {
        by: "Reader",
        reason: "Review",
        expectedRevision: revision,
      }),
    ).toThrow(/changed/);
    expect(() => select(root, ["articles/observation.md"])).toThrow(
      /Unapproved/,
    );
    const next = snapshot(root, "articles/observation.md");
    approve(root, next.document, {
      by: "Reader",
      reason: "Review",
      expectedRevision: next.revision,
    });
    expect(() =>
      exportContent(root, site, {
        selection: { [next.document]: next.revision },
      }),
    ).toThrow(/Broken concept/);
    expect(treeHash(site)).toBe(before);
  });
  it("rejects draft previews in public builds, private body markers and manual export edits", () => {
    const root = temp(),
      site = temp();
    init(root);
    reviewed(root, "articles/observation.md", article());
    exportContent(root, site, { preview: true });
    expect(() => validatePublic(site)).toThrow(/preview/);
    expect(validatePublic(site, true).mode).toBe("preview");
    for (const body of [
      "/home/emmanuel/Downloads/a.txt",
      "[Speaker 1] private words",
      "[source](../sources/a.md)",
    ])
      expect(() => publicDocument(article({}, body))).toThrow(/Private/);
    exportContent(root, site);
    fs.appendFileSync(
      path.join(site, "src/content/experiences/observation.md"),
      "unreviewed edit",
    );
    expect(() => validatePublic(site)).toThrow(/changed/);
  });
  it("rejects symlinks and path traversal", () => {
    const root = temp(),
      outside = temp();
    fs.symlinkSync(outside, path.join(root, "linked"));
    expect(() => inside(root, "../escape")).toThrow(/escapes/);
    expect(() => inside(root, "linked/file.md")).toThrow(/Symlink/);
  });
});
function releaseFixture(root, id = "release-one") {
  const directory = path.join(root, `releases/${id}`);
  write(path.join(directory, "site/index.html"), `<p>Reviewed ${id}</p>`);
  write(
    path.join(directory, "public-source/content.md"),
    `Approved ${id} source`,
  );
  const receipt = {
    version: 1,
    id,
    mode: "release",
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    artifactSha256: treeHash(path.join(directory, "site")),
    sourceSha256: treeHash(path.join(directory, "public-source")),
  };
  receipt.packageSha256 = packageHash(receipt);
  writeJSON(path.join(directory, "receipt.json"), receipt);
  const options = {
    releaseId: receipt.id,
    expectedHash: receipt.packageSha256,
    previewEvidence: { result: "passed", packageSha256: receipt.packageSha256 },
    operationId: "operation-one",
  };
  return { directory, receipt, options };
}
describe("release integrity and resumable promotion", () => {
  it("binds artifact and public source bytes to the reviewed package checksum", () => {
    const root = temp();
    init(root);
    const { directory, options } = releaseFixture(root);
    expect(authorizePromotion(directory, options).id).toBe("release-one");
    write(path.join(directory, "public-source/content.md"), "Replaced source");
    expect(() => inspectArtifact(directory)).toThrow(/checksum/);
  });
  it("prevents wrong hashes, missing preview checks, expired artifacts, and first-time rollback", () => {
    const root = temp();
    init(root);
    const { directory, receipt, options } = releaseFixture(root);
    expect(() =>
      authorizePromotion(directory, { ...options, expectedHash: "wrong" }),
    ).toThrow(/checksum/);
    expect(() =>
      authorizePromotion(directory, { ...options, previewEvidence: null }),
    ).toThrow(/preview/);
    expect(() =>
      authorizePromotion(directory, { ...options, rollback: true }),
    ).toThrow(/successful/);
    receipt.expiresAt = "2000-01-01T00:00:00Z";
    receipt.packageSha256 = packageHash(receipt);
    writeJSON(path.join(directory, "receipt.json"), receipt);
    expect(() =>
      authorizePromotion(directory, {
        ...options,
        expectedHash: receipt.packageSha256,
      }),
    ).toThrow(/expired/);
  });
  it("does not redeploy after export failure; another operation must wait", async () => {
    const root = temp();
    init(root);
    const { directory, options } = releaseFixture(root);
    let deploys = 0,
      exports = 0;
    const adapters = {
      deploy: async () => {
        deploys++;
        return { ok: true };
      },
      exportSource: async () => {
        exports++;
        if (exports === 1) throw new Error("Git unavailable");
        return { commit: "saved" };
      },
    };
    await expect(promote(root, directory, options, adapters)).rejects.toThrow(
      "Git unavailable",
    );
    await expect(
      promote(root, directory, { ...options, operationId: "other" }, adapters),
    ).rejects.toThrow(/incomplete/);
    await promote(root, directory, options, adapters);
    expect(deploys).toBe(1);
    expect(exports).toBe(2);
    await promote(root, directory, options, adapters);
    expect(deploys).toBe(1);
    await promote(
      root,
      directory,
      { ...options, operationId: "rollback-one", rollback: true },
      adapters,
    );
    expect(deploys).toBe(2);
  });
  it("does not call deployment adapters when artifact validation fails", async () => {
    const root = temp();
    init(root);
    const { directory, options } = releaseFixture(root);
    let called = false;
    write(path.join(directory, "site/index.html"), "Tampered");
    await expect(
      promote(root, directory, options, {
        deploy: async () => {
          called = true;
        },
        exportSource: async () => {
          called = true;
        },
      }),
    ).rejects.toThrow(/checksum/);
    expect(called).toBe(false);
  });
});
describe("audio retranscription", () => {
  it("preserves original audio, records the requested model and resumes saved chunks without another API call", async () => {
    const root = temp(),
      input = temp();
    init(root);
    const audio = path.join(input, "Aug 18 at 10-06.m4a");
    write(audio, "test audio bytes");
    let calls = 0;
    const prior = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = "test-key";
    try {
      const request = async () => {
        calls++;
        return {
          ok: true,
          json: async () => ({ text: "Architecture as movement." }),
        };
      };
      const result = await transcribe(root, audio, { request });
      await transcribe(root, audio, { request });
      expect(calls).toBe(1);
      expect(fs.readFileSync(audio, "utf8")).toBe("test audio bytes");
      expect(result.chunks).toBe(1);
      const doc = parse(
        fs.readFileSync(path.join(root, result.sources[0]), "utf8"),
      );
      expect(
        doc.data.variants.find((v) => v.processing).processing.requestedModel,
      ).toBe("gpt-transcribe");
      await expect(
        transcribe(root, path.join(input, "text.txt"), { request }),
      ).rejects.toThrow(/audio/);
    } finally {
      if (prior === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = prior;
    }
  });
});

describe("recovery and network boundaries", () => {
  it("requires explicit ingress configuration and confirmation before trusting NAT gateways", () => {
    const root = temp();
    const example = JSON.parse(
      fs.readFileSync(
        new URL(
          "../editorial-template/publishing.example.json",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    example.allowedCidrs = ["192.168.86.0/24"];
    writeJSON(path.join(root, "publishing.json"), example);
    const c = config(root);
    const values = previewValues(
      c,
      { mode: "preview" },
      "registry.example/site@sha256:" + "a".repeat(64),
    );
    expect(values.hostname).toBe(example.previewHostname);
    expect(values.ingress.className).toBe("nginx");
    expect(values).not.toHaveProperty("hostNetwork");
    example.ingress.natCidrs = ["100.64.0.2/32"];
    writeJSON(path.join(root, "publishing.json"), example);
    expect(() => config(root)).toThrow(/confirm the shared ingress/);
    example.ingress.privateNetworkConfirmed = true;
    writeJSON(path.join(root, "publishing.json"), example);
    expect(config(root).ingress.natCidrs).toEqual(["100.64.0.2/32"]);
    example.ingress.natCidrs = ["100.64.0.0/10"];
    writeJSON(path.join(root, "publishing.json"), example);
    expect(() => config(root)).toThrow(/exact IPv4/);
    delete example.ingress;
    writeJSON(path.join(root, "publishing.json"), example);
    expect(() => config(root)).toThrow();
  });
  it("finishes the same profile mutation after interruption without duplicating its answer", () => {
    const root = temp();
    init(root);
    const profile = serialize(
      {
        type: "writing-profile",
        title: "Voice",
        description: "Profile",
        version: "0.1.0",
      },
      "Direct voice.\n",
    );
    write(path.join(root, "profiles/current.md"), profile);
    askProfile(root, "What voice?", "Voice uncertain");
    const proposal = path.join(root, "proposal.md");
    write(proposal, profile.replace("Direct voice.", "Direct and reflective."));
    const rename = fs.renameSync;
    const spy = vi.spyOn(fs, "renameSync").mockImplementation((from, to) => {
      if (to === path.join(root, "state.json"))
        throw new Error("Simulated interruption");
      return rename(from, to);
    });
    try {
      expect(() =>
        answerProfile(root, "Reflective", proposal, "minor", "Adds reflection"),
      ).toThrow("Simulated interruption");
    } finally {
      spy.mockRestore();
    }
    const before = fs.readdirSync(path.join(root, "records/profile-answer"));
    expect(resumeProfile(root).version).toBe("0.2.0");
    expect(fs.readdirSync(path.join(root, "records/profile-answer"))).toEqual(
      before,
    );
    expect(readJSON(path.join(root, "state.json")).pendingQuestion).toBeNull();
    expect(
      fs.existsSync(path.join(root, "profiles/pending-mutation.json")),
    ).toBe(false);
  });
  it("permits explicit private LAN/VPN networks and rejects public or oversized ranges", () => {
    for (const cidr of [
      "192.168.86.0/24",
      "10.0.0.0/8",
      "172.16.0.0/12",
      "100.64.0.0/10",
      "fd00::/8",
    ])
      expect(validateCidr(cidr)).toBe(cidr);
    for (const cidr of [
      "0.0.0.0/0",
      "::/0",
      "8.8.8.8/32",
      "192.168.0.0/8",
      "172.32.0.0/16",
      "10.0.0.0/33",
      "fc00::/6",
      "192.168.1.0/24/extra",
    ])
      expect(() => validateCidr(cidr)).toThrow(/LAN/);
  });
});

describe("retained release identity", () => {
  it("rejects reusing a release ID for different code or a different site", () => {
    const root = temp();
    init(root);
    const { directory, receipt } = releaseFixture(root);
    receipt.codeRevision = "a".repeat(40);
    receipt.siteUrl = "https://fixture-test.web.app";
    receipt.packageSha256 = packageHash(receipt);
    writeJSON(path.join(directory, "receipt.json"), receipt);
    expect(
      prepareRelease(root, "unused", receipt.codeRevision, {
        id: receipt.id,
        siteUrl: receipt.siteUrl,
      }),
    ).toEqual(receipt);
    expect(() =>
      prepareRelease(root, "unused", "b".repeat(40), {
        id: receipt.id,
        siteUrl: receipt.siteUrl,
      }),
    ).toThrow(/another build/);
    expect(() =>
      prepareRelease(root, "unused", receipt.codeRevision, {
        id: receipt.id,
        siteUrl: "https://another-fixture.web.app",
      }),
    ).toThrow(/another build/);
  });
  it("restores the previous artifact and matching public source after a newer successful publication", async () => {
    const root = temp();
    init(root);
    const first = releaseFixture(root),
      second = releaseFixture(root, "release-two");
    let liveHtml, liveSource;
    const adapters = {
      deploy: async (_, dir) => {
        liveHtml = fs.readFileSync(path.join(dir, "site/index.html"), "utf8");
        return { ok: true };
      },
      exportSource: async (_, dir) => {
        liveSource = fs.readFileSync(
          path.join(dir, "public-source/content.md"),
          "utf8",
        );
        return { ok: true };
      },
    };
    await promote(root, first.directory, first.options, adapters);
    const original = { html: liveHtml, source: liveSource };
    await promote(
      root,
      second.directory,
      { ...second.options, operationId: "publish-two" },
      adapters,
    );
    expect(liveHtml).not.toBe(original.html);
    await promote(
      root,
      first.directory,
      { ...first.options, operationId: "restore-one", rollback: true },
      adapters,
    );
    expect({ html: liveHtml, source: liveSource }).toEqual(original);
    expect(
      readJSON(path.join(root, "records/live-release.json")).releaseId,
    ).toBe("release-one");
  });
});
