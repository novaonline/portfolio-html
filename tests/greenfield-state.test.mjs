import { describe, it, expect } from "vitest";
import {
  initialGreenfield,
  createItem,
  stepGreenfield,
  settleGreenfield,
  pendingCount,
  CONSUMERS,
} from "../src/scripts/greenfield-state.mjs";

describe("greenfield decoupled work", () => {
  it("keeps writes and other consumers progressing while analytics is held, then replays the same IDs", () => {
    const state = initialGreenfield();
    state.held = true;
    for (let i = 0; i < 3; i++) createItem(state);
    settleGreenfield(state);
    expect(state.saved).toEqual([1, 2, 3]);
    expect(state.responses).toEqual([1, 2, 3]);
    expect(state.published).toEqual([1, 2, 3]);
    expect(state.consumers.business.done).toEqual([1, 2, 3]);
    expect(state.consumers.worker.done).toEqual([1, 2, 3]);
    expect(state.consumers.analytics.done).toEqual([]);
    expect(pendingCount(state, "analytics")).toBe(3);
    state.held = false;
    settleGreenfield(state);
    expect(state.consumers.analytics.done).toEqual([1, 2, 3]);
    expect(pendingCount(state, "analytics")).toBe(0);
    expect(state.saved).toEqual([1, 2, 3]);
  });
  it("finishes an active batch before pausing and leaves later events queued", () => {
    const state = initialGreenfield();
    for (let i = 0; i < 3; i++) createItem(state);
    for (let i = 0; i < 550; i++) stepGreenfield(state, 1 / 120);
    expect(state.consumers.analytics.active.ids).toEqual([1, 2, 3]);
    state.held = true;
    createItem(state);
    settleGreenfield(state);
    expect(state.consumers.analytics.done).toEqual([1, 2, 3]);
    expect(state.consumers.analytics.history).toEqual([[1, 2, 3]]);
    expect(state.consumers.analytics.pending).toEqual([4]);
    expect(state.consumers.business.done).toEqual([1, 2, 3, 4]);
    state.held = false;
    settleGreenfield(state);
    expect(state.consumers.analytics.history).toEqual([[1, 2, 3], [4]]);
  });
  it("bounds batches and flushes partial batches without losing or duplicating IDs", () => {
    const state = initialGreenfield();
    for (let i = 0; i < 8; i++) createItem(state);
    settleGreenfield(state);
    for (const key of ["worker", "analytics"]) {
      expect(state.consumers[key].history).toEqual([
        [1, 2, 3],
        [4, 5, 6],
        [7, 8],
      ]);
      expect(state.consumers[key].batches).toBe(3);
    }
    expect(
      state.consumers.business.history.every((batch) => batch.length === 1),
    ).toBe(true);
  });
  it("collects a partial batch before starting and completes its members together", () => {
    const state = initialGreenfield();
    createItem(state);
    for (let i = 0; i < 480; i++) stepGreenfield(state, 1 / 120);
    expect(state.consumers.worker.pending).toEqual([1]);
    expect(state.consumers.worker.active).toBeNull();
    expect(state.consumers.worker.done).toEqual([]);
    settleGreenfield(state);
    expect(state.consumers.worker.history).toEqual([[1]]);
  });
  it("saves and publishes before consumers can finish and replies before all projections finish", () => {
    const state = initialGreenfield();
    createItem(state);
    let sawIndependentResponse = false;
    for (let i = 0; i < 1400; i++) {
      stepGreenfield(state, 1 / 120);
      for (const key of CONSUMERS)
        for (const id of state.consumers[key].done) {
          expect(state.saved).toContain(id);
          expect(state.published).toContain(id);
        }
      if (state.responses.length && !state.consumers.analytics.done.length)
        sawIndependentResponse = true;
    }
    expect(sawIndependentResponse).toBe(true);
  });
});
