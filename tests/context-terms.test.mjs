import { describe, expect, it } from "vitest";
import contextTerms from "../scripts/markdown/context-terms.mjs";

function fixture(
  href = "#context-2",
  reference = "#user-content-fn-context-2",
) {
  const term = {
    type: "element",
    tagName: "a",
    properties: { href },
    children: [{ type: "text", value: "virtual server" }],
  };
  const note = {
    type: "element",
    tagName: "sup",
    children: [
      {
        type: "element",
        tagName: "a",
        properties: { href: reference, dataFootnoteRef: true },
        children: [],
      },
    ],
  };
  return {
    term,
    note,
    tree: {
      type: "root",
      children: [{ tagName: "p", children: [term, note] }],
    },
  };
}
describe("explicit context phrases", () => {
  it("preserves the full phrase and the independent footnote link using renderer-owned IDs", () => {
    const { tree, term, note } = fixture(
      "#context-2",
      "#custom-prefix-fn-context-2",
    );
    contextTerms()(tree);
    expect(term.children[0].value).toBe("virtual server");
    expect(term.properties.href).toBe("#custom-prefix-fn-context-2");
    expect(term.properties.dataContextTerm).toBe("");
    expect(note.children[0].properties.href).toBe(term.properties.href);
  });
  it("rejects ambiguous or mismatched references rather than explaining the wrong phrase", () => {
    expect(() =>
      contextTerms()(fixture("#context-2", "#user-content-fn-context-1").tree),
    ).toThrow(/must match/);
    const { tree } = fixture();
    tree.children[0].children.pop();
    expect(() => contextTerms()(tree)).toThrow(/adjacent/);
  });
  it("leaves ordinary links and numbered footnotes unchanged", () => {
    const { tree } = fixture("/concepts/example/");
    const before = structuredClone(tree);
    contextTerms()(tree);
    expect(tree).toEqual(before);
  });
});
