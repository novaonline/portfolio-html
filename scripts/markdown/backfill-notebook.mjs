const el = (tagName, properties = {}, children = []) => ({
  type: "element",
  tagName,
  properties,
  children: children.map((child) =>
    typeof child === "string" ? { type: "text", value: child } : child,
  ),
});
const text = (x, y, value, className = "cell-note") =>
  el("text", { x, y, className }, [value]);
const temperatures = ["24°C", "27°C", "30°C"];
const badge = (x, y, label, missingUnit = false, reading = false) =>
  el("g", {}, [
    el("rect", {
      x,
      y: y - 14,
      width: 84,
      height: 26,
      rx: 6,
      className: reading
        ? `cell-badge reading-badge${missingUnit ? " unresolved-badge" : ""}`
        : "cell-badge",
    }),
    text(x + 8, y + 3, label, "cell-badge-label"),
  ]);
const page = (x, y, raw = false) =>
  el("g", { dataPageId: "P01" }, [
    el("rect", {
      x,
      y: y - 19,
      width: 158,
      height: 40,
      rx: 7,
      className: "cell-page-box",
    }),
    text(x + 8, y - 5, "P01", "cell-page-label"),
    ...["41", "42", "43"].map((id, i) =>
      el("g", { dataReadingId: id }, [
        el("rect", {
          x: x + 8 + i * 49,
          y,
          width: 44,
          height: 16,
          rx: 4,
          className: `cell-token token-${i}${raw && i === 2 ? " token-missing" : ""}`,
        }),
        text(
          x + 30 + i * 49,
          y + 12,
          raw && i === 2 ? "86 ?" : temperatures[i],
          "cell-question",
        ),
      ]),
    ),
  ]);
// Each row is one concrete interaction, not a simulated system.
const row = (y, label, reverse, packet, outcome) =>
  el(
    "g",
    { className: "cell-interaction", dataDestination: reverse ? "0" : "1" },
    [
      text(180, y - 25, label, "cell-message"),
      el("path", {
        d: reverse
          ? `M 290 ${y} H 70 l 6 -4 m -6 4 l 6 4`
          : `M 70 ${y} H 290 l -6 -4 m 6 4 l -6 4`,
        className: "cell-path",
      }),
      ...(packet
        ? [
            el(
              "g",
              { className: "cell-packet", dataTravel: reverse ? "-1" : "1" },
              [packet],
            ),
          ]
        : []),
      ...(outcome
        ? [
            typeof outcome === "string"
              ? text(180, y + 37, outcome, "cell-outcome")
              : outcome,
          ]
        : []),
    ],
  );
const stored = (y, matched = false) =>
  el("g", { className: "cell-outcome" }, [
    ...["41", "42", "43"].map((id, i) =>
      el("g", {}, [
        el("rect", {
          x: 87 + i * 49,
          y: y - 12,
          width: 44,
          height: 20,
          rx: 4,
          className: `cell-token token-${i}`,
        }),
        text(109 + i * 49, y + 2, temperatures[i], "cell-question"),
        ...(matched
          ? [
              el("path", {
                d: `M ${103 + i * 49} ${y + 15} l 4 4 l 7 -8`,
                className: "cell-match",
              }),
            ]
          : []),
      ]),
    ),
    text(252, y + 2, "3 stored", "cell-note"),
  ]);
const scenes = [
  {
    title: "Recover the detail",
    description:
      "Within the standard API, the handler requests a page from the telemetry store. Page P01 returns a blue reading at 24°C, a purple reading at 27°C and an amber reading with value 86 and no unit. Colours identify the example readings visually; each also has a stable reading ID.",
    actors: ["Request handler", "Telemetry store"],
    internal: true,
    height: 280,
    drawing: () => [
      row(112, "Read the historical window", false, badge(138, 112, "90 days")),
      row(209, "Return stored readings", true, page(101, 209, true)),
    ],
  },
  {
    title: "Give the readings one meaning",
    description:
      "Inside the standard API, the handler asks local device rules to resolve the amber reading: 86 with no unit. Historical device configuration establishes 86°F. The rules convert it to 30°C while preserving its reading ID.",
    actors: ["Request handler", "Device rules"],
    internal: true,
    height: 385,
    drawing: () => [
      row(
        112,
        "Look up device + recorded time",
        false,
        badge(138, 112, "86  ?", true, true),
      ),
      el("g", { className: "cell-interaction" }, [
        text(180, 193, "Historical configuration: °F", "cell-message"),
        el("path", {
          d: "M 290 207 h 24 v 29 h -24 l 6 -4 m -6 4 l 6 4",
          className: "cell-path",
        }),
        badge(138, 218, "86°F", false, true),
      ]),
      row(
        324,
        "Convert and return Celsius",
        true,
        badge(138, 324, "30°C", false, true),
        "Same reading. Consistent meaning.",
      ),
    ],
  },
  {
    title: "Keep every reading",
    description:
      "Analytics requests successive pages through the standard API. Three illustrative pages of 10,000 readings increase retained history to 10,000, 20,000 and 30,000 records. Cursor requests alternate with page responses. All readings are retained, not only threshold matches.",
    actors: ["Standard API", "Analytics"],
    height: 510,
    drawing: () => [
      row(94, "Request first page", true),
      row(
        147,
        "P01 · 10,000 readings",
        false,
        badge(138, 147, "P01"),
        "10,000 retained",
      ),
      row(226, "Request next cursor", true),
      row(
        279,
        "P02 · 10,000 readings",
        false,
        badge(138, 279, "P02"),
        "20,000 retained",
      ),
      row(358, "Request next cursor", true),
      row(
        411,
        "P03 · 10,000 readings",
        false,
        badge(138, 411, "P03"),
        "30,000 retained, not just >28°C",
      ),
      text(180, 492, "Illustrative page sizes", "cell-count"),
    ],
  },
  {
    title: "A retry is not new data",
    description:
      "First delivery of P01 inserts blue 24°C, purple 27°C and amber 30°C readings: three records. A repeated delivery matches the same stable IDs, not the temperatures, so no records are added and the count stays three.",
    actors: ["Standard API", "Analytics"],
    height: 365,
    drawing: () => [
      row(
        110,
        "First delivery: insert unseen IDs",
        false,
        page(101, 110),
        stored(148),
      ),
      row(
        232,
        "Retry: match the same IDs",
        false,
        page(101, 232),
        stored(270, true),
      ),
      el("g", { className: "cell-interaction" }, [
        badge(122, 324, "0 added"),
        text(230, 328, "Still 3", "cell-note"),
      ]),
    ],
  },
];
export default function backfillNotebook(id, selected) {
  return el(
    "div",
    { className: "backfill-notebook", dataArticleVisual: "notebook" },
    scenes.flatMap((scene, index) => {
      if (selected !== undefined && index !== selected) return [];
      const sceneId = `${id}-cell-${index}`;
      return el("section", { className: "notebook-cell", dataCell: index }, [
        el("figure", { className: "cell-visual" }, [
          el(
            "svg",
            {
              viewBox: `0 0 360 ${scene.height}`,
              role: "img",
              ariaLabelledBy: `${sceneId}-title ${sceneId}-desc`,
            },
            [
              el("title", { id: `${sceneId}-title` }, [scene.title]),
              el("desc", { id: `${sceneId}-desc` }, [scene.description]),
              ...(scene.internal
                ? [
                    el("rect", {
                      x: 8,
                      y: 8,
                      width: 344,
                      height: scene.height - 16,
                      rx: 16,
                      className: "cell-boundary",
                    }),
                    text(22, 29, "STANDARD API", "cell-boundary-title"),
                  ]
                : []),
              ...scene.actors.map((actor, i) => {
                const x = 70 + i * 220;
                const y = scene.internal ? 61 : 34;
                return el("g", { className: "cell-owner", dataOwner: i }, [
                  el("g", { className: `cell-body cell-family-${i}` }, [
                    el("rect", {
                      x: x - 56,
                      y: y - 20,
                      width: 112,
                      height: 34,
                      rx: 12,
                      className: "cell-node",
                    }),
                    el("rect", {
                      x: x - 51,
                      y: y - 15,
                      width: 9,
                      height: 24,
                      rx: 4,
                      className: "cell-identity",
                    }),
                    el("circle", {
                      cx: x + 45,
                      cy: y - 12,
                      r: 2.5,
                      className: "cell-heartbeat",
                    }),
                  ]),
                  text(x + 5, y + 2, actor, "cell-actor"),
                ]);
              }),
              ...[70, 290].map((x) =>
                el("path", {
                  d: `M ${x} ${scene.internal ? 76 : 48} V ${scene.height - 22}`,
                  className: "cell-lifeline",
                }),
              ),
              ...scene.drawing(),
            ],
          ),
          el("div", { className: "cell-controls" }, [
            el(
              "button",
              {
                type: "button",
                className: "cell-pause",
                hidden: true,
                ariaLabel: `Pause: ${scene.title}`,
                ariaPressed: false,
              },
              ["Pause"],
            ),
            el(
              "button",
              {
                type: "button",
                className: "cell-replay",
                hidden: true,
                ariaLabel: `Replay: ${scene.title}`,
              },
              ["Replay"],
            ),
          ]),
        ]),
      ]);
    }),
  );
}
