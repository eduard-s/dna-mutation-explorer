import assert from "node:assert/strict";
import test from "node:test";
import { createDamageLab, pulseDamage, setDnaProtectors, stepDamageLab } from "../dist/playground/damage.js";
import { renderAtomicMechanism } from "../dist/playground/atomic-render.js";

const zero = { uv: 0, xray: 0, heat: 0, oxidants: 0, electric: 0 };
function lab(options = {}) {
  const world = createDamageLab(600, 420, { species: "bare", exposures: zero, protectors: { repair: 0, antioxidants: 0 }, ...options });
  world.dna.paused = true;
  return world;
}
function diagram(world, effect) {
  const labels = [];
  const target = { canvas: { width: 600, height: 240 }, globalAlpha: 1,
    getTransform: () => ({ a: 1 }), measureText: text => ({ width: text.length * 6 }),
    createRadialGradient: () => ({ addColorStop() {} }), fillText: text => labels.push(text) };
  const ctx = new Proxy(target, { get: (object, key) => key in object ? object[key] : () => {} });
  renderAtomicMechanism(ctx, 600, 240, world, effect);
  return labels.join("\n");
}

test("the oxidation sketch intercepts ROS when antioxidants protect the DNA", () => {
  const protectedWorld = lab({ exposures: { ...zero, oxidants: 1 }, protectors: { repair: 0, antioxidants: 1 } });
  assert.match(diagram(protectedWorld, "oxidants"), /scavenger intercepts reactive oxygen/i);
  assert.doesNotMatch(diagram(protectedWorld, "oxidants"), /Chemical lesion on a base/);
  const unprotectedWorld = lab({ exposures: { ...zero, oxidants: 1 }, protectors: { repair: 0, antioxidants: 0 } });
  assert.match(diagram(unprotectedWorld, "oxidants"), /Chemical lesion on a base/);
});

test("antioxidants preserve X-ray ionization but intercept its illustrated water-radical route", () => {
  const world = lab({ exposures: { ...zero, xray: 1 }, protectors: { repair: 0, antioxidants: 1 } });
  const drawing = diagram(world, "xray");
  assert.match(drawing, /Ejected electron/);
  assert.match(drawing, /ROS intercepted; direct X-ray damage remains possible/);
  assert.doesNotMatch(drawing, /A reactive product can break the backbone/);
});

test("a neutralized zero-intensity X-ray pulse still activates the molecular sketch", () => {
  const world = lab({ seed: 3, protectors: { repair: 0, antioxidants: 1 } });
  pulseDamage(world, "xray");
  assert.equal(world.lastEvent.effect, "antioxidants");
  assert.match(diagram(world, "xray"), /Ejected electron/);
  assert.match(diagram(world, "xray"), /ROS intercepted/);
});

test("UV shielding and ROS scavenging affect different atomic mechanisms", () => {
  const shielded = lab({ exposures: { ...zero, uv: 1 }, protectors: { repair: 0, uvFilter: 1, antioxidants: 0 } });
  assert.match(diagram(shielded, "uv"), /Filter absorbs UV/);
  assert.doesNotMatch(diagram(shielded, "uv"), /New bonds on the same strand/);
  const onlyScavenger = lab({ exposures: { ...zero, uv: 1 }, protectors: { repair: 0, uvFilter: 0, antioxidants: 1 } });
  assert.match(diagram(onlyScavenger, "uv"), /New bonds on the same strand/);
});

test("fresh photons do not reactivate an expired shielding event after the filter is removed", () => {
  const world = lab({ sequence: "ACACAC", protectors: { repair: 0, antioxidants: 0, uvFilter: 1 } });
  pulseDamage(world, "uv");
  assert.match(diagram(world, "uv"), /Filter absorbs UV/);
  world.dna.paused = false;
  for (let frame = 0; frame < 480; frame++) stepDamageLab(world, 1 / 60);
  setDnaProtectors(world, { uvFilter: 0 });
  pulseDamage(world, "uv");
  assert.equal(world.lastEvent.outcome, "shielded");
  assert.ok(world.dna.time - world.lastEvent.time > 6.2);
  assert.ok(world.particles.some(particle => particle.kind === "uv" && !particle.absorbed));
  assert.doesNotMatch(diagram(world, "uv"), /Filter absorbs UV/);
});

test("Bare DNA does not animate intrinsic repair from a stored repair setting", () => {
  const world = lab({ species: "bare", protectors: { repair: 1, repairLight: 1 } });
  const drawing = diagram(world, "repair");
  assert.match(drawing, /No active repair pathway/);
  assert.doesNotMatch(drawing, /Repair enzyme/);
});

test("repair light only activates a photolyase-capable species sketch", () => {
  for (const species of ["human", "deinococcus"]) {
    const world = lab({ species, protectors: { repair: 0, repairLight: 1 } });
    assert.doesNotMatch(diagram(world, "repair"), /Repair enzyme/);
  }
  const ecoli = lab({ species: "ecoli", protectors: { repair: 0, repairLight: 1 } });
  assert.match(diagram(ecoli, "repair"), /Repair enzyme/);
});

test("an added external repair action remains visible for Bare DNA", () => {
  const world = lab();
  pulseDamage(world, "uv");
  pulseDamage(world, "repair");
  assert.equal(world.lastEvent.externalRepair, true);
  assert.match(diagram(world, "repair"), /Repair enzyme/);
});

test("heat and electric-field sketches do not show electron ejection", () => {
  const world = lab({ exposures: { ...zero, heat: 1, electric: 1 } });
  assert.doesNotMatch(diagram(world, "heat"), /Ejected electron/);
  assert.doesNotMatch(diagram(world, "electric"), /Ejected electron/);
  assert.match(diagram(world, "electric"), /negatively charged backbone/);
});

test("frequent UV hits do not restart the mechanism before bond formation", () => {
  const world = lab({ exposures: { ...zero, uv: 1 } });
  world.dna.paused = false;
  const drawings = [];
  for (let frame = 0; frame < 40; frame++) {
    world.dna.time = frame / 4;
    world.lastEvent = { effect: "uv", outcome: "dimer", time: world.dna.time, index: 1, strand: 0 };
    drawings.push(diagram(world, "uv"));
  }
  assert(drawings.some(drawing => /New bonds on the same strand/.test(drawing)));
});
