import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { expect, it } from "vitest";

it("holds destinations and pauses without resetting when out of view", () => {
  const source = readFileSync(
    new URL("../src/components/ArticleVisuals.astro", import.meta.url),
    "utf8",
  ).match(/<script>([\s\S]*?)<\/script>/)[1];
  const animations = [];
  const animate = (frames, options) => {
    const animation = {
      frames,
      options,
      playState: "running",
      pause() {
        this.playState = "paused";
      },
      play() {
        this.playState = "running";
      },
      cancel() {
        this.playState = "idle";
      },
    };
    animations.push(animation);
    return animation;
  };
  let observe;
  let replay;
  let visibility;
  let pause;
  let motionChange;
  const motion = {
    matches: false,
    addEventListener: (_, callback) => {
      motionChange = callback;
    },
  };
  const button = {
    addEventListener: (_, callback) => {
      replay = callback;
    },
  };
  const pauseButton = {
    setAttribute() {},
    addEventListener: (_, callback) => {
      pause = callback;
    },
  };
  const rows = [1, -1].map((direction) => ({
    animate,
    dataset: {},
    querySelector: (selector) =>
      selector === ".cell-packet"
        ? { animate, dataset: { travel: direction } }
        : { animate },
  }));
  const cell = {
    classList: { toggle() {} },
    querySelector: (selector) =>
      selector === ".cell-pause"
        ? pauseButton
        : selector.startsWith("[data-owner")
          ? null
          : button,
    querySelectorAll: () => rows,
  };
  const document = {
    hidden: false,
    querySelectorAll: () => [cell],
    addEventListener: (_, callback) => {
      visibility = callback;
    },
  };
  runInNewContext(ts.transpile(source), {
    document,
    matchMedia: () => motion,
    IntersectionObserver: class {
      constructor(callback) {
        observe = callback;
      }
      observe() {}
    },
  });
  observe([{ isIntersecting: true }]);
  const packets = [animations[1], animations[4]];
  packets.forEach((packet, index) => {
    expect(packet.options.fill).toBe("both");
    expect(packet.frames.at(-1)).toEqual({
      offset: 1,
      transform: `translateX(${index ? -70 : 70}px) scale(1, 1)`,
      opacity: 1,
    });
  });
  expect(animations[2].options.delay).toBeGreaterThanOrEqual(
    packets[0].options.duration,
  );
  pause();
  expect(packets[1].playState).toBe("paused");
  observe([{ isIntersecting: true }]);
  expect(packets[1].playState).toBe("paused");
  pause();
  expect(packets[1].playState).toBe("running");
  packets[0].playState = "finished";
  observe([{ isIntersecting: false }]);
  expect(packets[0].playState).toBe("finished");
  expect(packets[1].playState).toBe("paused");
  observe([{ isIntersecting: true }]);
  expect(packets[1].playState).toBe("running");
  expect(animations).toHaveLength(6);
  document.hidden = true;
  visibility();
  expect(packets[1].playState).toBe("paused");
  document.hidden = false;
  visibility();
  expect(packets[1].playState).toBe("running");
  replay();
  expect(packets[0].playState).toBe("idle");
  expect(animations).toHaveLength(12);
  motion.matches = true;
  motionChange();
  expect(animations.at(-1).playState).toBe("idle");
  expect(button.hidden).toBe(true);
  expect(pauseButton.hidden).toBe(true);
});
