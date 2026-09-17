const el = (tagName, properties = {}, children = []) => ({
  type: "element",
  tagName,
  properties,
  children: children.map((child) =>
    typeof child === "string" ? { type: "text", value: child } : child,
  ),
});
const readings = (raw) =>
  el(
    "div",
    {
      className: "comparison-readings",
      ariaLabel: raw
        ? "24 Celsius, 27 Celsius, 86 with an unknown unit"
        : "24 Celsius, 27 Celsius, 30 Celsius",
    },
    ["24°C", "27°C", raw ? "86 ?" : "30°C"].map((value, i) =>
      el(
        "span",
        {
          className: `comparison-reading reading-${i}${raw && i === 2 ? " is-unresolved" : ""}`,
        },
        [value],
      ),
    ),
  );
const conversion = () =>
  el("div", { className: "comparison-conversion" }, [
    el("span", { className: "comparison-reading reading-2 is-unresolved" }, [
      "86 ?",
    ]),
    el("span", { ariaHidden: "true" }, ["→"]),
    el("span", { className: "comparison-reading reading-2" }, ["30°C"]),
  ]);
const node = (title, content, className = "") =>
  el("div", { className: `comparison-node ${className}` }, [
    el("div", { className: "comparison-node-title" }, [
      title,
      el("span", { className: "comparison-beat", ariaHidden: "true" }),
    ]),
    ...content,
  ]);
const button = (label, action, extra = {}) =>
  el(
    "button",
    {
      type: "button",
      dataAction: action,
      title: label,
      ariaLabel: label,
      ...extra,
    },
    [
      el("span", { ariaHidden: "true", dataIcon: "" }, [
        { next: "↓", resolve: "↻", pause: "Ⅱ", reset: "↺" }[action],
      ]),
      ...(["next", "resolve"].includes(action)
        ? [el("span", {}, [label])]
        : []),
    ],
  );
const arrow = () =>
  el("span", { className: "comparison-arrow", ariaHidden: "true" }, ["↔"]);
export default function backfillComparison(id, selected) {
  return el(
    "figure",
    {
      className: "backfill-comparison",
      dataBackfillComparison: "",
      ariaLabelledBy: `${id}-title`,
    },
    [
      el(
        "figcaption",
        { id: `${id}-title`, className: "comparison-title sr-only" },
        [
          selected === "database"
            ? "Analytics owns interpretation"
            : selected === "api"
              ? "The API owns interpretation"
              : "Who resolves the incomplete reading?",
        ],
      ),
      ...(selected ? [selected] : ["database", "api"]).map((route) => {
        const api = route === "api";
        return el(
          "section",
          {
            className: "comparison-route",
            dataRoute: route,
            ariaLabel: api ? "API route" : "Database route",
          },
          [
            el("div", { className: "comparison-flow" }, [
              node(
                "Analytics",
                api
                  ? [
                      el("div", { className: "comparison-received" }, [
                        readings(false),
                      ]),
                      el("small", { dataClientState: "" }, [
                        "Ready to calculate",
                      ]),
                    ]
                  : [
                      el("div", { className: "comparison-received" }, [
                        conversion(),
                      ]),
                      el("small", { dataClientState: "" }, [
                        "Incomplete → resolve → ready",
                      ]),
                    ],
                api ? "" : "comparison-resolver",
              ),
              arrow(),
              ...(api
                ? [
                    node(
                      "API",
                      [
                        conversion(),
                        el("small", {}, ["Resolves the missing unit"]),
                      ],
                      "comparison-resolver",
                    ),
                    arrow(),
                  ]
                : []),
              node("Telemetry", [readings(true)], "comparison-source"),
            ]),
            el("div", { className: "comparison-toolbar" }, [
              el(
                "div",
                {
                  className:
                    "comparison-interaction comparison-client-controls",
                  hidden: true,
                  ariaLabel: "Analytics controls",
                },
                [
                  button(api ? "Next page" : "Fetch batch", "next", {
                    ariaLabel: `Analytics: read next page through the ${api ? "API" : "database"}`,
                  }),
                  ...(!api
                    ? [
                        button("Resolve", "resolve", {
                          disabled: true,
                          ariaLabel:
                            "Analytics: resolve the missing unit in the next pending page",
                        }),
                      ]
                    : []),
                ],
              ),
              el("div", { className: "comparison-global", hidden: true }, [
                button("Pause motion", "pause", { ariaPressed: false }),
                button("Start again", "reset"),
              ]),
            ]),
            el("div", { className: "comparison-track", ariaHidden: "true" }, [
              el(
                "svg",
                {
                  viewBox: "0 0 600 70",
                  preserveAspectRatio: "none",
                  className: "comparison-track-line",
                },
                [
                  el("path", {
                    d: api ? "M 95 35 H 505" : "M 150 35 H 450",
                    fill: "none",
                    stroke: "currentColor",
                  }),
                ],
              ),
              el("div", { className: "comparison-message", hidden: true }, [
                readings(true),
                el("span", { className: "comparison-batch", hidden: true }, [
                  api ? "10,000 readings" : "50,000 readings",
                ]),
                el("span", { className: "comparison-request", hidden: true }, [
                  "Page request →",
                ]),
              ]),
            ]),
            el("div", { className: "comparison-interaction", hidden: true }, [
              el(
                "output",
                { dataCount: "", ariaLive: "polite", ariaAtomic: "true" },
                ["0 / 5 pages · 0 readings"],
              ),
              el("span", { className: "comparison-status", dataStatus: "" }, [
                "Read a page to begin",
              ]),
            ]),
          ],
        );
      }),
    ],
  );
}
