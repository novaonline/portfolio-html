import {
  PRESET,
  travelFrame,
  springStep,
  impulseVelocity,
  bodyScale,
  haloFrame,
  decayHalo,
  heartbeat,
} from "./living-motion.mjs";
import {
  initialGreenfield,
  createItem,
  stepGreenfield,
  settleGreenfield,
  pendingCount,
  CONSUMERS,
  workDuration,
  BATCH_LIMIT,
} from "./greenfield-state.mjs";
const ns = "http://www.w3.org/2000/svg";
const cell = document.querySelector<HTMLElement>("[data-greenfield]");
if (cell) {
  const scene = cell.querySelector<HTMLElement>(".gf-scene")!;
  const svg = cell.querySelector<SVGSVGElement>("svg")!;
  const pause = cell.querySelector<HTMLButtonElement>("[data-pause]")!;
  const hold = cell.querySelector<HTMLButtonElement>("[data-hold]")!;
  const status = cell.querySelector<HTMLElement>("[data-status]")!;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let state = initialGreenfield();
  const nodes = new Map(
    Array.from(cell.querySelectorAll<HTMLElement>("[data-node]")).map(
      (element) => [
        element.dataset.node!,
        { element, position: 0, velocity: 0, halo: 0 },
      ],
    ),
  );
  const routes = new Map(
    Array.from(svg.querySelectorAll<SVGPathElement>("[data-edge]")).map(
      (path) => [path.dataset.edge!, { path, length: 0 }],
    ),
  );
  const tokens = new Map<string, SVGGElement>();
  let paused = false,
    visible = false,
    time = 0,
    previous = 0,
    accumulator = 0;
  function geometry() {
    const parent = scene.getBoundingClientRect();
    svg.setAttribute("viewBox", `0 0 ${parent.width} ${parent.height}`);
    for (const [key, route] of routes) {
      const [from, to] = key.split("-");
      const a = nodes.get(from)!.element.getBoundingClientRect();
      const b = nodes.get(to)!.element.getBoundingClientRect();
      const ax = a.x + a.width / 2 - parent.x,
        bx = b.x + b.width / 2 - parent.x;
      let d: string;
      if (from === "identity") {
        const x = a.right - parent.x,
          bend =
            (a.right + nodes.get("api")!.element.getBoundingClientRect().left) /
              2 -
            parent.x;
        d = `M${x} ${a.y + a.height / 2 - parent.y} H${bend} V${b.y + 95 - parent.y} H${b.right - parent.x}`;
      } else if (Math.abs(a.y - b.y) < 5) {
        const right = b.x > a.x;
        const x1 = (right ? a.right : a.left) - parent.x,
          x2 = (right ? b.left : b.right) - parent.x;
        const y = a.y + a.height / 2 - parent.y + (right ? -8 : 8);
        d = `M${x1} ${y} H${x2}`;
      } else {
        const y1 = a.bottom - parent.y,
          y2 = b.top - parent.y;
        const middle = (y1 + y2) / 2;
        d =
          Math.abs(ax - bx) < 1
            ? `M${ax} ${y1} V${y2}`
            : `M${ax} ${y1} C${ax} ${middle} ${bx} ${middle} ${bx} ${y2}`;
      }
      route.path.setAttribute("d", d);
      route.length = route.path.getTotalLength();
    }
    render();
  }
  function setText(element: Element, text: string) {
    if (element.textContent !== text) element.textContent = text;
  }
  function update() {
    const last = (ids: number[]) => (ids.length ? ` · #${ids.at(-1)}` : "");
    const texts: Record<string, string> = {
      web: `${state.responses.length} confirmed${last(state.responses)}`,
      api: `${state.nextId - 1} ${state.nextId === 2 ? "request" : "requests"}`,
      product: `${state.saved.length} saved${last(state.saved)}`,
      stream: `${state.published.length} published`,
    };
    for (const key of CONSUMERS) {
      const c = state.consumers[key],
        pending = pendingCount(state, key);
      texts[key] =
        `${c.done.length} ${key === "analytics" ? "observed" : "processed"}${last(c.done)}\n${key === "analytics" && state.held && !c.active ? "Paused · " : ""}${pending} pending`;
      const panel = cell!.querySelector<HTMLElement>(`[data-batch="${key}"]`);
      if (panel) {
        const ids = (values: number[]) =>
          values.length
            ? values
                .slice(0, BATCH_LIMIT)
                .map((id) => `#${id}`)
                .join(" ") +
              (values.length > BATCH_LIMIT
                ? ` +${values.length - BATCH_LIMIT}`
                : "")
            : "—";
        setText(
          panel.querySelector("[data-queue]")!,
          `Queued ${c.pending.length}: ${ids(c.pending)}`,
        );
        setText(
          panel.querySelector("[data-batch-state]")!,
          c.active
            ? `Batch ${c.active.number} · ${c.active.phase === "travel" ? "Fetching" : "Processing"}`
            : state.held && key === "analytics"
              ? "Paused between batches"
              : c.pending.length
                ? "Collecting batch…"
                : "Waiting for events",
        );
        setText(
          panel.querySelector("[data-batch-items]")!,
          c.active
            ? ids(c.active.ids)
            : c.history.length
              ? `Last: ${ids(c.history.at(-1)!)}`
              : "Up to 3 items / batch",
        );
        setText(
          panel.querySelector("[data-batch-done]")!,
          `${c.batches} ${c.batches === 1 ? "batch" : "batches"} completed`,
        );
      }
      const element = nodes.get(key)!.element;
      element.dataset.held = String(
        key === "analytics" && state.held && !c.active,
      );
      const progress = element.querySelector<HTMLProgressElement>("progress")!;
      progress.hidden = !c.active || c.active.phase !== "work";
      progress.value =
        c.active?.phase === "work" ? c.active.elapsed / workDuration(key) : 0;
    }
    for (const [key, text] of Object.entries(texts))
      setText(
        nodes.get(key)!.element.querySelector("[data-node-state]")!,
        text,
      );
    hold.textContent = state.held ? "Resume processing" : "Pause after batch";
    hold.setAttribute("aria-pressed", String(state.held));
    pause.hidden = reduced.matches;
    pause.textContent = paused ? "Resume scene" : "Pause scene";
    pause.setAttribute("aria-pressed", String(paused));
    const lag = state.saved.length - state.consumers.analytics.done.length;
    const message =
      paused && !reduced.matches
        ? "Scene paused. All work is frozen."
        : state.held
          ? `${state.consumers.analytics.active ? "Analytics will pause after its current batch." : "Analytics is paused between batches."} ${lag} saved ${lag === 1 ? "item" : "items"} not yet observed. Product requests and the other consumers can continue.`
          : lag
            ? `${lag} saved ${lag === 1 ? "item" : "items"} not yet observed. Analytics is catching up independently.`
            : state.saved.length
              ? `Analytics has caught up with all ${state.saved.length} saved items.`
              : "Create a few items. Worker and Analytics collect up to 3, or start a partial batch after 2 seconds.";
    setText(status, message);
  }
  function pulse(key: string) {
    const node = nodes.get(key)!;
    node.velocity = impulseVelocity(node.velocity, 0.7);
    node.halo = 1;
  }
  function render() {
    nodes.forEach((node, key) => {
      const index = [...nodes.keys()].indexOf(key);
      const scale = bodyScale(node.position, time, index, reduced.matches),
        halo = haloFrame(node.halo),
        beat = heartbeat(time, index);
      node.element.style.setProperty("--body-x", String(scale.x));
      node.element.style.setProperty("--body-y", String(scale.y));
      node.element.style.setProperty("--halo-opacity", String(halo.opacity));
      node.element.style.setProperty("--halo-scale", String(halo.scale));
      const dot = node.element.querySelector<HTMLElement>(".gf-beat")!;
      dot.style.transform = `scale(${reduced.matches ? 1 : beat.dotRadius / 2.5})`;
      dot.style.opacity = String(reduced.matches ? 0.67 : beat.dotOpacity);
    });
    const active = new Set<string>();
    const transfers = [...state.jobs];
    for (const key of CONSUMERS) {
      const work = state.consumers[key].active;
      if (work?.phase === "travel")
        work.ids.forEach((id: number) =>
          transfers.push({
            id,
            from: "stream",
            to: key,
            kind: "event",
            elapsed: work.elapsed,
            duration: 1.13,
          }),
        );
    }
    if (!reduced.matches)
      for (const job of transfers) {
        const key = `${job.id}-${job.from}-${job.to}`,
          route = routes.get(`${job.from}-${job.to}`)!;
        active.add(key);
        let token = tokens.get(key);
        if (!token) {
          token = document.createElementNS(ns, "g");
          token.classList.add("gf-token");
          const rect = document.createElementNS(ns, "rect");
          for (const [key, value] of Object.entries({
            x: -10,
            y: -8,
            width: 20,
            height: 16,
            rx: 4,
          }))
            rect.setAttribute(key, String(value));
          const label = document.createElementNS(ns, "text");
          label.setAttribute("text-anchor", "middle");
          label.setAttribute("dy", "3");
          label.textContent = String(job.id);
          token.append(rect, label);
          svg.append(token);
          tokens.set(key, token);
        }
        const travel = travelFrame(job.elapsed / job.duration),
          point = route.path.getPointAtLength(route.length * travel.progress);
        token.setAttribute(
          "transform",
          `translate(${point.x + (job.from === "stream" ? (state.consumers[job.to].active!.ids.indexOf(job.id) - (state.consumers[job.to].active!.ids.length - 1) / 2) * 16 : 0)} ${point.y}) scale(${travel.stretchX} ${travel.stretchY})`,
        );
      }
    for (const [key, token] of tokens)
      if (!active.has(key)) {
        token.remove();
        tokens.delete(key);
      }
  }
  function sync() {
    if (reduced.matches) {
      settleGreenfield(state);
      nodes.forEach((node) => {
        node.position = 0;
        node.velocity = 0;
        node.halo = 0;
      });
    }
    update();
    render();
  }
  cell.querySelector("[data-create]")!.addEventListener("click", () => {
    createItem(state);
    if (!reduced.matches) pulse("web");
    sync();
  });
  hold.addEventListener("click", () => {
    state.held = !state.held;
    sync();
  });
  pause.addEventListener("click", () => {
    paused = !paused;
    sync();
  });
  cell.querySelector("[data-reset]")!.addEventListener("click", () => {
    state = initialGreenfield();
    paused = false;
    accumulator = 0;
    nodes.forEach((node) => {
      node.position = 0;
      node.velocity = 0;
      node.halo = 0;
    });
    sync();
  });
  cell
    .querySelectorAll<HTMLElement>(".gf-local,.gf-toolbar")
    .forEach((el) => (el.hidden = false));
  reduced.addEventListener("change", sync);
  new ResizeObserver(geometry).observe(scene);
  new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting;
      previous = 0;
    },
    { threshold: 0 },
  ).observe(cell);
  document.addEventListener("visibilitychange", () => {
    previous = 0;
  });
  function frame(now: number) {
    const dt = previous ? Math.min(0.05, (now - previous) / 1000) : 0;
    previous = now;
    if (visible && !paused && !document.hidden && !reduced.matches) {
      accumulator += dt;
      while (accumulator >= PRESET.fixedStep) {
        time += PRESET.fixedStep;
        stepGreenfield(state, PRESET.fixedStep).forEach(pulse);
        nodes.forEach((node) => {
          const next = springStep(node);
          node.position = next.position;
          node.velocity = next.velocity;
          node.halo = decayHalo(node.halo, PRESET.fixedStep);
        });
        accumulator -= PRESET.fixedStep;
      }
      update();
      render();
    }
    requestAnimationFrame(frame);
  }
  geometry();
  sync();
  requestAnimationFrame(frame);
}
