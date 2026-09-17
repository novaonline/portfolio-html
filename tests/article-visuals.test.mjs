import { describe, expect, it } from "vitest";
import articleVisuals from "../scripts/markdown/article-visuals.mjs";

const paragraph = (value) => ({
  type: "element",
  tagName: "p",
  children: [{ type: "text", value }],
});
function find(node, predicate) {
  return [
    ...(predicate(node) ? [node] : []),
    ...(node.children ?? []).flatMap((child) => find(child, predicate)),
  ];
}
describe("article visual embeds", () => {
  it("keeps temperatures and accessible descriptions in visual-only embeds", () => {
    const tree = { children: [paragraph("[visual:telemetry-sequence]")] };
    articleVisuals()(tree);
    const inline = find(tree, (node) =>
      node.properties?.className?.startsWith("inline-reading "),
    );
    expect(inline).toHaveLength(0);
    const words = find(tree, (node) => node.type === "text")
      .map((node) => node.value)
      .join(" ");
    expect(words).toContain("86°F");
    expect(words).toContain("30°C");
    expect(words).toContain("same stable IDs, not the temperatures");
    const pages = find(tree, (node) => node.properties?.dataPageId === "P01");
    expect(
      find(pages[0], (node) => node.type === "text").map((node) => node.value),
    ).toEqual(["P01", "24°C", "27°C", "86 ?"]);
    expect(
      find(pages[1], (node) => node.type === "text").map((node) => node.value),
    ).toEqual(["P01", "24°C", "27°C", "30°C"]);
  });
  it("renders both illustrations with unique accessible SVG IDs", () => {
    const tree = {
      children: [
        paragraph("[visual:telemetry-map]"),
        paragraph("[visual:telemetry-sequence]"),
        paragraph("[visual:telemetry-map]"),
      ],
    };
    articleVisuals()(tree);
    expect(tree.children.map((node) => node.tagName)).toEqual([
      "figure",
      "div",
      "figure",
    ]);
    const ids = find(tree, (node) => node.properties?.id).map(
      (node) => node.properties.id,
    );
    expect(new Set(ids).size).toBe(ids.length);
    expect(
      find(tree, (node) => node.tagName === "svg").every(
        (node) => node.properties.ariaLabelledBy,
      ),
    ).toBe(true);
  });
  it("renders all messages without injecting article prose", () => {
    const tree = { children: [paragraph("[visual:telemetry-sequence]")] };
    articleVisuals()(tree);
    expect(
      find(tree, (node) => node.properties?.dataCell !== undefined),
    ).toHaveLength(4);
    expect(find(tree, (node) => node.tagName === "p")).toHaveLength(0);
    expect(find(tree, (node) => node.tagName === "svg")).toHaveLength(4);
    const cells = find(tree, (node) => node.properties?.dataCell !== undefined);
    expect(
      find(
        cells[1],
        (node) => node.properties?.className === "cell-interaction",
      ),
    ).toHaveLength(3);
    expect(
      find(
        cells[2],
        (node) => node.properties?.className === "cell-interaction",
      ),
    ).toHaveLength(6);
    expect(
      find(
        cells[3],
        (node) => node.properties?.className === "cell-interaction",
      ),
    ).toHaveLength(3);
    expect(
      find(tree, (node) => node.properties?.className === "inline-missing"),
    ).toHaveLength(0);
    expect(
      find(tree, (node) => node.tagName === "button").every(
        (node) => node.properties.hidden,
      ),
    ).toBe(true);
  });
  it("leaves prose untouched and rejects unknown named embeds", () => {
    const prose = paragraph("Mention [visual:telemetry-map] in prose.");
    const tree = { children: [prose] };
    articleVisuals()(tree);
    expect(tree.children[0]).toBe(prose);
    expect(() =>
      articleVisuals()({ children: [paragraph("[visual:unknown]")] }),
    ).toThrow("Unknown article visual");
  });
  it("preserves three reading identities through normalization and retry without data tables", () => {
    const tree = { children: [paragraph("[visual:telemetry-sequence]")] };
    articleVisuals()(tree);
    const pages = find(tree, (node) => node.properties?.dataPageId === "P01");
    expect(pages).toHaveLength(3);
    for (const page of pages) {
      expect(
        find(page, (node) => node.properties?.className === "reading-pill"),
      ).toHaveLength(0);
      expect(
        find(page, (node) => node.properties?.dataReadingId).map(
          (node) => node.properties.dataReadingId,
        ),
      ).toEqual(["41", "42", "43"]);
    }
    expect(
      find(pages[0], (node) =>
        node.properties?.className?.includes("token-missing"),
      ),
    ).toHaveLength(1);
    expect(
      find(pages[1], (node) =>
        node.properties?.className?.includes("token-missing"),
      ),
    ).toHaveLength(0);
  });
});

it("groups code and route visuals across Markdown whitespace without changing code", () => {
  const code = {
    type: "element",
    tagName: "pre",
    children: [{ type: "text", value: "SELECT * FROM readings;" }],
  };
  const tree = {
    children: [
      code,
      { type: "text", value: "\n" },
      paragraph("[visual:backfill-database]"),
    ],
  };
  articleVisuals()(tree);
  expect(tree.children).toHaveLength(1);
  expect(tree.children[0].properties.className).toBe("route-package");
  expect(tree.children[0].children[0]).toBe(code);
  expect(tree.children[0].children[1].tagName).toBe("figure");
});
