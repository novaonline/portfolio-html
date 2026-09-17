export const PAGE_SIZE = 10_000;
export const PAGE_LIMIT = 5;
export const PAGE_SIZES = { database: 50_000, api: PAGE_SIZE };
export const PAGE_LIMITS = { database: 1, api: PAGE_LIMIT };
export function initialPages() {
  return {
    database: { pages: 0, resolved: 0 },
    api: { pages: 0, resolved: 0 },
  };
}
// The model owns counts. Animations never commit, discard or resolve readings.
export function changePages(state, route, action) {
  if (!["database", "api"].includes(route)) throw new Error("Unknown route");
  const next = structuredClone(state);
  const lane = next[route];
  if (action === "next" && lane.pages < PAGE_LIMITS[route]) {
    lane.pages++;
    if (route === "api") lane.resolved++;
  } else if (
    action === "resolve" &&
    route === "database" &&
    lane.resolved < lane.pages
  ) {
    lane.resolved++;
  }
  return next;
}
