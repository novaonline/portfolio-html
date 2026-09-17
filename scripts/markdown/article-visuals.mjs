// Named editorial illustrations, rendered to HTML/SVG at build time.
import backfillComparison from "./backfill-comparison.mjs";
import backfillNotebook from "./backfill-notebook.mjs";
// These are deliberately not a general architecture modelling language.
const text = (value) => ({ type: "text", value: String(value) });
const el = (tagName, properties = {}, children = []) => ({
  type: "element",
  tagName,
  properties,
  children: children.map((child) =>
    typeof child === "string" ? text(child) : child,
  ),
});
const label = (x, y, value, className = "") =>
  el("text", { x, y, className }, [value]);
const rect = (x, y, width, height, className = "") =>
  el("rect", { x, y, width, height, rx: 12, className });
const line = (x1, y1, x2, y2, className = "") =>
  el("line", { x1, y1, x2, y2, className });
const readingPill = (x, y, id) =>
  el("g", { className: "reading-pill", dataReadingId: id }, [
    rect(x, y, 38, 24, "reading-pill-bg"),
    label(x + 19, y + 16, id, "reading-pill-label"),
  ]);
const arrow = (x1, y1, x2, y2, id, className = "") =>
  el("line", {
    x1,
    y1,
    x2,
    y2,
    className,
    markerEnd: `url(#${id})`,
  });
const marker = (id) =>
  el("defs", {}, [
    el(
      "marker",
      {
        id,
        viewBox: "0 0 10 10",
        refX: 9,
        refY: 5,
        markerWidth: 6,
        markerHeight: 6,
        orient: "auto-start-reverse",
      },
      [el("path", { d: "M 0 0 L 10 5 L 0 10 z", fill: "context-stroke" })],
    ),
  ]);
const svg = (id, height, title, description, children) =>
  el(
    "svg",
    {
      viewBox: `0 0 720 ${height}`,
      role: "img",
      ariaLabelledBy: `${id}-title ${id}-desc`,
    },
    [
      el("title", { id: `${id}-title` }, [title]),
      el("desc", { id: `${id}-desc` }, [description]),
      ...children,
    ],
  );
const heading = (eyebrow, title) => [
  el("p", { className: "visual-eyebrow" }, [eyebrow]),
  el("h2", {}, [title]),
];
const scroll = (content) =>
  el(
    "div",
    {
      className: "visual-scroll",
      tabIndex: 0,
      role: "region",
      ariaLabel: "Diagram. Scroll horizontally on small screens.",
    },
    [content],
  );

export const backfillSteps = [
  {
    from: 0,
    to: 1,
    packet: "Q01",
    title: "Request the retained history",
    message: "GET individual readings · 90-day window",
    detail:
      "Analytics asks the standard API for all individual readings in the agreed window. There is no temperature filter: it needs to retain the detail, not just threshold matches.",
  },
  {
    from: 1,
    to: 3,
    packet: "Q01",
    title: "Read a page of stored data",
    message: "Read the next page",
    detail:
      "The API reads a bounded page from the retained telemetry history. The agreed window is preserved while the backfill runs.",
  },
  {
    from: 3,
    to: 1,
    packet: "P01",
    title: "The values still need interpretation",
    message: "Stored readings",
    detail:
      "Page P01 contains individual readings 41, 42 and 43. Their unit labels are inconsistent. A direct database copy would stop here and leave analytics to resolve them.",
  },
  {
    from: 1,
    to: 2,
    packet: "Q02",
    title: "Resolve the device-specific rules",
    message: "Look up the missing unit",
    detail:
      "For reading 43, the API consults the device configuration that applied at the reading's timestamp. This is a logical lookup, not a requirement for a separate network service.",
  },
  {
    from: 2,
    to: 1,
    packet: "Q02",
    title: "Interpret, then normalize",
    message: "Fahrenheit",
    detail:
      "The configuration establishes the missing unit. The API standardizes the labels and converts values to Celsius. If it cannot establish a unit, it flags the reading instead of guessing.",
  },
  {
    from: 1,
    to: 0,
    packet: "P01",
    title: "Return consistent individual readings",
    message: "Normalized readings",
    detail:
      "The API returns a Parquet page with consistent Celsius values and unchanged reading IDs. The same page identity follows the data through normalization; this is not an hourly aggregate.",
  },
  {
    from: 0,
    to: 0,
    packet: "P01",
    title: "Store once, even when the page is retried",
    message: "Upsert by reading ID",
    detail:
      "Analytics upserts every reading by its stable reading ID. Retrying P01 or receiving the same reading through live ingestion updates the existing record rather than inserting another: readings 41, 42 and 43 still occupy three records. It calculates the metric from that deduplicated data, so a retry does not increase the count. Subsequent pages and incoming readings use the same rule.",
  },
];

function map(id) {
  const nodes = [
    [20, "Devices", "Inconsistent units", ""],
    [200, "Telemetry store", "Individual readings", "90 days retained"],
    [380, "Standard API", "Device rules + units", "Consistent Celsius"],
    [560, "Analytics", "Retain every reading", "Calculate new metrics"],
  ];
  return el(
    "figure",
    { className: "article-visual", dataArticleVisual: "map" },
    [
      ...heading(
        "01 / The mental map",
        "Same readings. One consistent front gate.",
      ),
      scroll(
        svg(
          id,
          310,
          "Telemetry backfill architecture",
          "Devices supply inconsistent readings. Telemetry retains 90 days. The standard API interprets units and returns consistent readings to analytics. Analytics previously kept only averages; it now retains individual readings.",
          [
            marker(`${id}-arrow`),
            label(
              20,
              27,
              "UPSTREAM OWNS DEVICE INTERPRETATION",
              "map-boundary",
            ),
            label(560, 27, "ANALYTICS OWNS", "map-boundary"),
            line(548, 40, 548, 180, "boundary-line"),
            ...nodes.flatMap(([x, title, sub, note]) => [
              rect(
                x,
                55,
                140,
                110,
                x === 380 ? "map-node api-node" : "map-node",
              ),
              label(x + 12, 83, title, "node-title"),
              label(x + 12, 111, sub, "node-sub"),
              ...(x === 20
                ? ["41", "42", "43"].map((id, i) =>
                    readingPill(x + 8 + i * 43, 126, id),
                  )
                : [label(x + 12, 143, note, "node-note")]),
            ]),
            ...[160, 340, 520].map((x) =>
              arrow(x + 3, 105, x + 35, 105, `${id}-arrow`, "map-link"),
            ),
            label(
              20,
              202,
              "The arrows show the data journey. The sequence below shows the requests.",
              "map-caption",
            ),
            rect(20, 224, 325, 66, "past-box"),
            label(34, 247, "BEFORE", "node-note"),
            label(
              34,
              274,
              "Hourly averages only. Detail discarded.",
              "node-sub",
            ),
            rect(365, 224, 335, 66, "now-box"),
            label(379, 247, "NOW", "node-note"),
            label(
              379,
              274,
              "Backfill 90 days + retain incoming readings.",
              "node-sub",
            ),
          ],
        ),
      ),
      el("figcaption", {}, [
        "The API owns normalization. Analytics owns retention and the threshold calculation. Older individual readings are unavailable, not reconstructible from averages.",
      ]),
    ],
  );
}

export default function articleVisuals() {
  return (tree) => {
    let count = 0;
    function walk(node) {
      const children = node.children ?? [];
      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        if (
          child.tagName === "p" &&
          child.children?.length === 1 &&
          child.children[0].type === "text"
        ) {
          const match = /^\[visual:([a-z-]+)\]$/.exec(child.children[0].value);
          if (match) {
            const render = {
              "telemetry-map": map,
              "backfill-comparison": backfillComparison,
              "backfill-database": (id) => backfillComparison(id, "database"),
              "backfill-api": (id) => backfillComparison(id, "api"),
              "telemetry-sequence": backfillNotebook,
              "backfill-detail": (id) => backfillNotebook(id, 0),
              "backfill-meaning": (id) => backfillNotebook(id, 1),
              "backfill-pages": (id) => backfillNotebook(id, 2),
              "backfill-retry": (id) => backfillNotebook(id, 3),
            }[match[1]];
            if (!render) throw new Error(`Unknown article visual: ${match[1]}`);
            const figure = render(`visual-${match[1]}-${count++}`);
            let preceding = i - 1;
            while (
              preceding >= 0 &&
              children[preceding].type === "text" &&
              !children[preceding].value.trim()
            )
              preceding--;
            if (
              ["backfill-database", "backfill-api"].includes(match[1]) &&
              children[preceding]?.tagName === "pre"
            ) {
              children.splice(
                preceding,
                i - preceding + 1,
                el(
                  "section",
                  {
                    className: "route-package",
                    ariaLabelledBy: figure.properties.ariaLabelledBy,
                  },
                  [children[preceding], figure],
                ),
              );
              i = preceding;
            } else children[i] = figure;
            continue;
          }
        }
        walk(child);
      }
    }
    walk(tree);
  };
}
