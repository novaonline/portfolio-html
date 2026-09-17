import { describe, expect, it } from "vitest";
import { createMarkdownProcessor } from "@astrojs/markdown-remark";
import inlineShapes from "../scripts/markdown/inline-shapes.mjs";
import articleVisuals from "../scripts/markdown/article-visuals.mjs";

const render = async (source) =>
  (
    await createMarkdownProcessor({
      rehypePlugins: [inlineShapes, articleVisuals],
    })
  ).render(source);
describe("shape-based Markdown", () => {
  it("renders ordinary Markdown paragraphs and independently placed visuals", async () => {
    const { code } = await render(
      "### Meaning\n\nFollow [86 ?](shape:box/amber/missing), then [30°C](shape:box/amber).\n\n[visual:backfill-meaning]\n\n### Retain\n\nKeep them all.\n\n[visual:backfill-pages]",
    );
    expect(code).toContain(
      'class="inline-shape shape-box shape-amber shape-missing"',
    );
    expect(code).toContain("(unresolved)");
    expect(code).not.toContain('href="shape:');
    expect(code.match(/<svg /g)).toHaveLength(2);
    expect(code.match(/<p>/g)).toHaveLength(2);
    expect(code.indexOf("Follow")).toBeLessThan(code.indexOf("<svg"));
    expect(code.indexOf("Keep them all.")).toBeGreaterThan(
      code.indexOf("</svg>"),
    );
  });
  it("supports reusable shapes and preserves links and code examples", async () => {
    const { code } = await render(
      "[Request](shape:pill/purple) [?](shape:circle/red) [Ready](shape:box/green) [Neutral](shape:box/neutral) [Link](https://example.com) `[24°C](shape:box/blue)`",
    );
    expect(code).toContain("shape-pill shape-purple");
    expect(code).toContain("shape-circle shape-red");
    expect(code).toContain('href="https://example.com"');
    expect(code).toContain("<code>[24°C](shape:box/blue)</code>");
  });
  it("rejects invalid syntax instead of generating broken links or unsafe styles", async () => {
    for (const source of [
      "[x](shape:box/mauve)",
      "[x](shape:triangle/red)",
      "[long label](shape:circle/blue)",
      "[**bold**](shape:box/blue)",
    ]) {
      await expect(render(source)).rejects.toThrow(
        /inline shape|Inline shape/i,
      );
    }
  });
});
