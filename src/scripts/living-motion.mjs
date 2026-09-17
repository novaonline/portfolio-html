/**
 * Living Systems: math-only adaptation of the approved SVG motion preset.
 * No DOM, dependencies, timers, physics library, or Kafka model.
 * Times are seconds; positions are SVG user units or normalized displacement.
 * Integrate springStep at PRESET.fixedStep to match the reference.
 */
export const PRESET = Object.freeze({
  elasticity: 0.45,
  speed: 1,
  fixedStep: 1 / 120,
  nodeStiffness: 175,
  beadStiffness: 65,
  publish: 1.13,
  autoInterval: 2.8,
});
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
function finite(value, name) {
  if (!Number.isFinite(value)) throw new TypeError(`${name} must be finite.`);
  return value;
}
/** @param {number} progress Normalized progress. Values outside 0..1 are clamped. */
export function smootherstep(progress) {
  const u = clamp(finite(progress, "progress"));
  return u * u * u * (u * (u * 6 - 15) + 10);
}
/** @param {'node'|'bead'} kind */
export function springParameters(kind = "node") {
  if (!["node", "bead"].includes(kind))
    throw new RangeError("Use node or bead.");
  const stiffness =
    kind === "node" ? PRESET.nodeStiffness : PRESET.beadStiffness;
  const ratio = 0.93 - (kind === "node" ? 0.48 : 0.46) * PRESET.elasticity;
  return {
    mass: 1,
    stiffness,
    dampingRatio: ratio,
    damping: 2 * Math.sqrt(stiffness) * ratio,
  };
}
/**
 * Semi-implicit Euler, as in the reference. Return a new state object.
 * @param {{position:number,velocity:number}} state
 * @param {number} target
 * @param {number} dt Use PRESET.fixedStep in an accumulator loop.
 * @param {'node'|'bead'} kind
 * @returns {{position:number,velocity:number}}
 */
export function springStep(
  state,
  target = 0,
  dt = PRESET.fixedStep,
  kind = "node",
) {
  const position = finite(state.position, "position"),
    velocity = finite(state.velocity, "velocity");
  finite(target, "target");
  finite(dt, "dt");
  if (dt < 0 || dt > 0.05)
    throw new RangeError("Use a step from 0 to 0.05 s; prefer 1/120 s.");
  const { stiffness, damping } = springParameters(kind);
  const nextVelocity =
    velocity + (stiffness * (target - position) - damping * velocity) * dt;
  return { position: position + nextVelocity * dt, velocity: nextVelocity };
}
export function impulseVelocity(velocity, amount = 1) {
  return clamp(
    finite(velocity, "velocity") -
      1.75 * finite(amount, "amount") * (0.12 + PRESET.elasticity),
    -6,
    6,
  );
}
export function travelFrame(progress) {
  const u = clamp(finite(progress, "progress"));
  const stretchX = 1 + Math.sin(Math.PI * u) ** 2 * 0.3 * PRESET.elasticity;
  return { progress: smootherstep(u), stretchX, stretchY: 1 / stretchX };
}
export function settlingStretch(velocity) {
  const stretchX =
    1 +
    clamp(Math.abs(finite(velocity, "velocity")) / 300, 0, 0.14) *
      PRESET.elasticity;
  return { stretchX, stretchY: 1 / stretchX };
}
export function heartbeat(time, componentIndex = 0) {
  finite(time, "time");
  finite(componentIndex, "componentIndex");
  if (time < 0 || componentIndex < 0)
    throw new RangeError("Use non-negative time and component index.");
  const phase = (time + componentIndex * 0.21) % 3.6;
  const beat =
    Math.exp(-(((phase - 0.14) / 0.085) ** 2)) +
    0.55 * Math.exp(-(((phase - 0.38) / 0.1) ** 2));
  return {
    beat,
    breath: 0.0018 * beat,
    dotRadius: 2.5 + beat * 0.65,
    dotOpacity: 0.67 + beat * 0.26,
  };
}
export function bodyScale(
  displacement,
  time,
  componentIndex = 0,
  reducedMotion = false,
) {
  finite(displacement, "displacement");
  const breath = reducedMotion ? 0 : heartbeat(time, componentIndex).breath;
  return { x: 1 + displacement + breath, y: 1 - displacement * 0.72 + breath };
}
export function haloFrame(strength) {
  const s = clamp(finite(strength, "strength"));
  return { opacity: s * 0.18, scale: 1 + (1 - s) * 0.11 };
}
export function decayHalo(strength, dt) {
  finite(strength, "strength");
  finite(dt, "dt");
  if (dt < 0) throw new RangeError("dt must be non-negative.");
  return Math.max(0, strength - dt * 1.8);
}
export function busyRotation(time) {
  return (finite(time, "time") * 220) % 360;
}
/** age is seconds since retirement. Remove the ghost after 1.3 s. */
export function retirementFrame(age, x = 0, y = 0) {
  finite(age, "age");
  finite(x, "x");
  finite(y, "y");
  if (age < 0) throw new RangeError("age must be non-negative.");
  const u = clamp(age / 1.3),
    e = smootherstep(u);
  return {
    x: x + 15 * Math.sin(u * Math.PI * 0.9),
    y: y + 31 * e,
    scale: 1 - e * 0.65,
    opacity: 1 - e,
    remove: age >= 1.3,
  };
}
