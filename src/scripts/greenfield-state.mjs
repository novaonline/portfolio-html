// Teaching model: one successful product write emits one event. Consumers own
// independent progress. No counts or completion decisions depend on geometry.
export const BATCH_LIMIT = 3;
export const BATCH_WAIT = 2;
export const workDuration = (key) =>
  key === "analytics" ? 3 : key === "worker" ? 2 : 0.85;
export const CONSUMERS = ["worker", "analytics", "business"];
/**
 * @typedef {{id:number,from:string,to:string,kind:string,elapsed:number,duration:number}} Transfer
 * @typedef {{ids:number[],number:number,elapsed:number,phase:'travel'|'work'}} Work
 * @typedef {{pending:number[],done:number[],active:Work|null,waiting:number,batches:number,history:number[][]}} Consumer
 * @typedef {{nextId:number,saved:number[],responses:number[],published:number[],jobs:Transfer[],held:boolean,consumers:Record<string,Consumer>}} GreenfieldState
 */
/** @returns {GreenfieldState} */
export function initialGreenfield() {
  return {
    nextId: 1,
    saved: [],
    responses: [],
    published: [],
    jobs: [],
    held: false,
    consumers: Object.fromEntries(
      CONSUMERS.map((key) => [
        key,
        {
          pending: [],
          done: [],
          active: null,
          waiting: 0,
          batches: 0,
          history: [],
        },
      ]),
    ),
  };
}
/** @param {GreenfieldState} state */
function travel(state, id, from, to, kind) {
  state.jobs.push({ id, from, to, kind, elapsed: 0, duration: 1.13 });
}
/** @param {GreenfieldState} state */
export function createItem(state) {
  const id = state.nextId++;
  travel(state, id, "web", "api", "request");
  return id;
}
/** @param {GreenfieldState} state */
export function stepGreenfield(state, dt) {
  const arrivals = [];
  for (const job of [...state.jobs]) {
    job.elapsed += dt;
    if (job.elapsed < job.duration) continue;
    state.jobs.splice(state.jobs.indexOf(job), 1);
    arrivals.push(job.to);
    if (job.to === "api") {
      travel(
        state,
        job.id,
        "api",
        job.kind === "request" ? "product" : "web",
        job.kind,
      );
    } else if (job.to === "product") {
      state.saved.push(job.id);
      travel(state, job.id, "product", "api", "response");
      travel(state, job.id, "product", "stream", "event");
    } else if (job.to === "web") state.responses.push(job.id);
    else if (job.to === "stream") {
      state.published.push(job.id);
      for (const key of CONSUMERS) state.consumers[key].pending.push(job.id);
    }
  }
  for (const key of CONSUMERS) {
    const consumer = state.consumers[key];
    if (!consumer.active && consumer.pending.length) {
      if (key === "analytics" && state.held) continue;
      consumer.waiting += dt;
      const limit = key === "business" ? 1 : BATCH_LIMIT;
      if (consumer.pending.length >= limit || consumer.waiting >= BATCH_WAIT) {
        consumer.active = {
          ids: consumer.pending.splice(0, limit),
          number: consumer.batches + 1,
          elapsed: 0,
          phase: "travel",
        };
        consumer.waiting = 0;
      }
    }
    const active = consumer.active;
    if (!active) continue;
    active.elapsed += dt;
    const duration = active.phase === "travel" ? 1.13 : workDuration(key);
    if (active.elapsed < duration) continue;
    if (active.phase === "travel") {
      active.phase = "work";
      active.elapsed = 0;
      arrivals.push(key);
    } else {
      consumer.done.push(...active.ids);
      consumer.history.push([...active.ids]);
      consumer.batches++;
      consumer.active = null;
    }
  }
  return arrivals;
}
/** @param {GreenfieldState} state */
export function pendingCount(state, key) {
  const consumer = state.consumers[key];
  return consumer.pending.length + (consumer.active?.ids.length ?? 0);
}
/** @param {GreenfieldState} state */
export function settleGreenfield(state) {
  // Reduced motion runs the same transitions, preserving held work and IDs.
  while (
    state.jobs.length ||
    CONSUMERS.some(
      (key) =>
        state.consumers[key].active ||
        (!(key === "analytics" && state.held) && pendingCount(state, key)),
    )
  ) {
    stepGreenfield(state, 0.05);
  }
}
