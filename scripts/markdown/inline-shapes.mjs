// Native Markdown links are the authoring notation. Emit non-interactive spans
// at build time; never copy arbitrary URLs or attributes into the output.
export default function inlineShapes() {
  return (tree) => {
    function walk(node) {
      if (["code", "pre", "script", "style"].includes(node.tagName)) return;
      if (
        node.tagName === "a" &&
        String(node.properties?.href).startsWith("shape:")
      ) {
        const match =
          /^shape:(box|pill|circle)\/(blue|purple|amber|red|green|neutral)(\/missing)?$/.exec(
            node.properties.href,
          );
        if (!match || node.children?.some((child) => child.type !== "text")) {
          throw new Error(
            "Invalid inline shape: use [label](shape:box/blue), with plain-text labels.",
          );
        }
        const label = node.children.map((child) => child.value).join("");
        if (
          !label.trim() ||
          (match[1] === "circle" && Array.from(label).length > 2)
        ) {
          throw new Error(
            "Inline shapes need a label; circles accept one or two characters. Use a pill for longer labels.",
          );
        }
        node.tagName = "span";
        node.properties = {
          className: `inline-shape shape-${match[1]} shape-${match[2]}${match[3] ? " shape-missing" : ""}`,
        };
        if (match[3])
          node.children.push({
            type: "element",
            tagName: "span",
            properties: { className: "sr-only" },
            children: [{ type: "text", value: " (unresolved)" }],
          });
      }
      for (const child of node.children ?? []) walk(child);
    }
    walk(tree);
  };
}
