/** Bind an explicit Markdown phrase link to its adjacent standard footnote.
 * Authoring: [virtual server](#context-2)[^context-2]
 * The footnote renderer owns IDs; never guess them or infer phrase boundaries.
 */
export default function contextTerms() {
  return (tree) => {
    function walk(node) {
      const children = node.children ?? [];
      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        if (
          child.tagName === "a" &&
          /^#context-[\w-]+$/.test(child.properties?.href ?? "")
        ) {
          const reference = children[i + 1]?.children?.find(
            (entry) =>
              entry.tagName === "a" &&
              entry.properties?.dataFootnoteRef !== undefined,
          );
          if (!reference)
            throw new Error(
              "Context term requires an adjacent footnote reference",
            );
          const expected = child.properties.href.slice(1);
          if (!reference.properties.href.endsWith(`fn-${expected}`)) {
            throw new Error("Context term and footnote identifiers must match");
          }
          child.properties.href = reference.properties.href;
          child.properties.className = ["context-term-link"];
          child.properties.dataContextTerm = "";
        }
        walk(child);
      }
    }
    walk(tree);
  };
}
