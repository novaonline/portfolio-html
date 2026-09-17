import { expect, it } from "vitest";
import {
  initialPages,
  changePages,
  PAGE_SIZES,
} from "../src/scripts/backfill-state.mjs";
import backfillComparison from "../scripts/markdown/backfill-comparison.mjs";
it("keeps retrieval separate from interpretation and caps the actual window", () => {
  let state = initialPages();
  for (let i = 0; i < 8; i++) state = changePages(state, "database", "next");
  expect(state.database).toEqual({ pages: 1, resolved: 0 });
  expect(state.api.pages).toBe(0);
  state = changePages(state, "database", "resolve");
  expect(state.database.resolved * PAGE_SIZES.database).toBe(50000);
  for (let i = 0; i < 8; i++) state = changePages(state, "database", "resolve");
  expect(state.database.resolved).toBe(1);
  state = changePages(state, "api", "next");
  expect(state.api).toEqual({ pages: 1, resolved: 1 });
  expect(initialPages().database.pages).toBe(0);
});
it("explains both owners without JavaScript and hides inert controls", () => {
  const tree = backfillComparison("test");
  const all = (node) => [node, ...(node.children ?? []).flatMap(all)];
  const nodes = all(tree);
  expect(nodes.filter((n) => n.properties?.dataRoute)).toHaveLength(2);
  const words = nodes
    .filter((n) => n.type === "text")
    .map((n) => n.value)
    .join(" ");
  expect(words).toContain("Analytics");
  expect(words).toContain("API");
  expect(words).toContain("Incomplete → resolve → ready");
  expect(words).toContain("Resolves the missing unit");
  expect(
    nodes
      .filter((n) => n.properties?.className === "comparison-interaction")
      .every((n) => n.properties.hidden),
  ).toBe(true);
});

it("places Analytics and its initiating control before the backend in each separate route", () => {
  for (const route of ["database", "api"]) {
    const all = (node) => [node, ...(node.children ?? []).flatMap(all)];
    const nodes = all(backfillComparison("route", route));
    const flow = nodes.find(
      (n) => n.properties?.className === "comparison-flow",
    );
    const titles = all(flow)
      .filter((n) => n.properties?.className === "comparison-node-title")
      .map((n) => n.children[0].value);
    expect(titles).toEqual([
      "Analytics",
      ...(route === "api" ? ["API"] : []),
      "Telemetry",
    ]);
    expect(
      nodes.some((n) =>
        n.properties?.ariaLabel?.startsWith("Analytics: read next page"),
      ),
    ).toBe(true);
    expect(
      all(flow.children.at(-1)).some(
        (n) => n.properties?.dataAction === "next",
      ),
    ).toBe(false);
  }
});
