import assert from "node:assert/strict";
import test from "node:test";
import { createDnaPlayground, duplexGeometry } from "../dist/playground/engine.js";
import {
  DEFAULT_DAMAGE_EXPOSURES, DEFAULT_DNA_PROTECTORS, SPECIES_PROFILES,
  createDamageLab, getDamageMetrics, pulseDamage, repairDamageAt, resizeDamageLab,
  setDamageExposures, setDamageSpecies, setDnaProtectors, stepDamageLab, takeDamageSnapshot,
} from "../dist/playground/damage.js";

const noExposure = { uv: 0, xray: 0, heat: 0, oxidants: 0, electric: 0 };
const noProtection = { antioxidants: 0, uvFilter: 0, xrayShield: 0, repair: 0, repairLight: 0 };
const make = (options = {}) => createDamageLab(800, 460, {
  species: "bare", ...options,
  exposures: { ...noExposure, ...options.exposures }, protectors: { ...noProtection, ...options.protectors },
});
const pause = world => { world.dna.paused = true; return world; };
const seconds = (world, duration) => { for (let frame = 0; frame < Math.ceil(duration * 60); frame++) stepDamageLab(world, 1 / 60); };
const sequence = world => world.dna.parent.bases.join("");
const bases = (world, strand) => strand === 0 ? world.dna.parent.bases : world.dna.parent.partners;
const endpoint = (world, index, strand = 0) => duplexGeometry(world.dna, "parent")[index][strand === 0 ? "a" : "b"];

test("defaults expose qualitative levels and four repair profiles", () => {
  const world = createDamageLab(800, 460);
  assert.equal(world.species, "ecoli");
  assert.deepEqual(world.exposures, DEFAULT_DAMAGE_EXPOSURES);
  assert.deepEqual(world.protectors, DEFAULT_DNA_PROTECTORS);
  assert.equal(SPECIES_PROFILES.length, 4);
  assert.equal(SPECIES_PROFILES.find(item => item.id === "bare").repairFactor, 0);
  assert.deepEqual(SPECIES_PROFILES.filter(item => item.photolyase).map(item => item.id), ["ecoli"]);
  assert.ok(Object.isFrozen(SPECIES_PROFILES));
  assert.equal(world.dna.parent.bases.length, 24);
  assert.equal(world.dna.daughter, null);
  assert.equal(getDamageMetrics(world).activeLesions, 0);
});

test("the damage field starts as a broad S while ordinary DNA keeps its compact layout", () => {
  const world = make();
  const span = nodes => Math.max(...nodes.map(node => node.y)) - Math.min(...nodes.map(node => node.y));
  assert.equal(world.dna.layout, "wave");
  assert.ok(span(world.dna.parent.nodes) > world.dna.height * .3);
  assert.ok(span(createDnaPlayground(800, 460).parent.nodes) < world.dna.height * .1);
  const original = sequence(world);
  seconds(world, 3);
  assert.ok(span(world.dna.parent.nodes) > world.dna.height * .25);
  assert.equal(sequence(world), original);
});

test("settings clamp valid levels and ignore nonfinite patches", () => {
  const world = make();
  setDamageExposures(world, { uv: 4, xray: -2, electric: -4, heat: NaN, oxidants: Infinity });
  assert.deepEqual(world.exposures, { uv: 1, xray: 0, electric: -1, heat: 0, oxidants: 0 });
  setDnaProtectors(world, { antioxidants: 3, uvFilter: -1, repair: NaN });
  assert.equal(world.protectors.antioxidants, 1);
  assert.equal(world.protectors.uvFilter, 0);
  assert.equal(world.protectors.repair, 0);
  assert.throws(() => createDamageLab(800, 460, { species: "unknown" }), TypeError);
});

test("invalid pulse coordinates and unknown effects do not corrupt the field", () => {
  const world = make();
  const before = structuredClone(world);
  assert.equal(pulseDamage(world, "antioxidants", { x: NaN, y: 0 }), false);
  assert.equal(pulseDamage(world, "heat", { x: 0, y: Infinity }), false);
  assert.equal(pulseDamage(world, "unknown"), false);
  assert.deepEqual(world, before);
});

test("UV creates same-strand dimers only at adjacent C or T bases", () => {
  const world = pause(make({ seed: 17 }));
  for (let index = 0; index < 50; index++) pulseDamage(world, "uv");
  assert.ok(world.lesions.length > 0);
  for (const lesion of world.lesions) {
    assert.equal(lesion.kind, "dimer");
    assert.match(bases(world, lesion.strand)[lesion.index], /[CT]/);
    assert.match(bases(world, lesion.strand)[lesion.index + 1], /[CT]/);
  }
  const noPair = pause(make({ sequence: "ACACAC" }));
  for (let index = 0; index < 20; index++) pulseDamage(noPair, "uv");
  assert.equal(noPair.lesions.length, 0);
});

test("a UV hit on A does not borrow pyrimidines from the opposite strand", () => {
  const world = pause(make({ sequence: "AAAAAA" }));
  pulseDamage(world, "uv", endpoint(world, 2, 0));
  assert.equal(world.lesions.length, 0);
  pulseDamage(world, "uv", endpoint(world, 2, 1));
  assert.equal(world.lesions.length, 1);
  assert.equal(world.lesions[0].strand, 1);
  assert.equal(world.lesions[0].index, 2);
});

test("oxidants create G-oxidation markers without changing DNA letters", () => {
  const world = pause(make());
  const original = sequence(world), partner = [...world.dna.parent.partners];
  for (let index = 0; index < 40; index++) pulseDamage(world, "oxidants");
  assert.ok(world.lesions.length > 0);
  for (const lesion of world.lesions) {
    assert.equal(lesion.kind, "oxidized");
    assert.equal(bases(world, lesion.strand)[lesion.index], "G");
  }
  assert.equal(sequence(world), original);
  assert.deepEqual(world.dna.parent.partners, partner);
  const noG = pause(make({ sequence: "ATATAT" }));
  for (let index = 0; index < 10; index++) pulseDamage(noG, "oxidants");
  assert.equal(noG.lesions.length, 0);
});

test("X-rays eject electrons and produce single and clustered double breaks", () => {
  const world = pause(make({ sequence: "ACGT".repeat(16), seed: 14 }));
  for (let index = 0; index < 60; index++) pulseDamage(world, "xray");
  assert.ok(world.particles.some(item => item.kind === "electron"));
  assert.ok(world.lesions.some(item => item.kind === "ssb"));
  assert.ok(world.lesions.some(item => item.kind === "dsb"));
  assert.ok(world.lesions.every(item => item.kind === "ssb" || item.kind === "dsb"));
  assert.ok(world.lesions.every(item => item.index < world.dna.parent.bases.length - 1));
  assert.equal(sequence(world), "ACGT".repeat(16));
});

test("the UV filter blocks UV but does not shield X-rays", () => {
  const world = pause(make({ protectors: { uvFilter: 1 } }));
  for (let index = 0; index < 10; index++) pulseDamage(world, "uv");
  assert.equal(world.lesions.length, 0);
  assert.equal(world.totals.blocked, 10);
  for (let index = 0; index < 15; index++) pulseDamage(world, "xray");
  assert.ok(world.lesions.some(item => item.kind === "ssb" || item.kind === "dsb"));
});

test("the X-ray shield blocks X-rays but does not filter UV", () => {
  const world = pause(make({ protectors: { xrayShield: 1 } }));
  for (let index = 0; index < 10; index++) pulseDamage(world, "xray");
  assert.equal(world.lesions.length, 0);
  assert.equal(world.totals.blocked, 10);
  assert.equal(world.particles.some(item => item.kind === "electron"), false);
  for (let index = 0; index < 15; index++) pulseDamage(world, "uv");
  assert.ok(world.lesions.some(item => item.kind === "dimer"));
});

test("antioxidants neutralize ROS but do not block direct UV", () => {
  const unprotected = pause(make({ seed: 20 })), protectedWorld = pause(make({ seed: 20, protectors: { antioxidants: 1 } }));
  for (let index = 0; index < 20; index++) { pulseDamage(unprotected, "oxidants"); pulseDamage(protectedWorld, "oxidants"); }
  assert.ok(unprotected.lesions.length > 0);
  assert.equal(protectedWorld.lesions.length, 0);
  assert.equal(protectedWorld.totals.neutralized, 20);
  const uv = pause(make({ protectors: { antioxidants: 1 } }));
  pulseDamage(uv, "uv");
  assert.equal(uv.lesions[0].kind, "dimer");
  assert.equal(uv.totals.blocked, 0);
  assert.equal(uv.totals.neutralized, 0);
});

test("antioxidants leave the direct X-ray break branch active", () => {
  const world = pause(make({ seed: 32, protectors: { antioxidants: 1 } }));
  for (let index = 0; index < 40; index++) pulseDamage(world, "xray");
  assert.ok(world.totals.neutralized > 0);
  assert.ok(world.lesions.some(item => item.kind === "ssb" || item.kind === "dsb"));
  assert.equal(world.totals.blocked, 0);
});

test("an antioxidant pulse neutralizes nearby ROS and leaves photons alone", () => {
  const world = make();
  pulseDamage(world, "oxidants");
  pulseDamage(world, "uv");
  const radical = world.particles.find(item => item.kind === "radical");
  const photon = world.particles.find(item => item.kind === "uv");
  pulseDamage(world, "antioxidants", { x: radical.x, y: radical.y });
  assert.equal(radical.absorbed, true);
  assert.notEqual(photon.absorbed, true);
  assert.equal(world.totals.neutralized, 1);
  assert.ok(world.particles.some(item => item.kind === "scavenger"));
});

test("heat opens base pairing without strand lesions or sequence changes", () => {
  const world = pause(make());
  const original = sequence(world);
  pulseDamage(world, "heat");
  assert.ok(getDamageMetrics(world).openPairs > 0);
  assert.equal(world.lesions.length, 0);
  world.dna.paused = false;
  setDamageExposures(world, { heat: 1 });
  seconds(world, 2);
  assert.equal(getDamageMetrics(world).openPairs, 24);
  assert.equal(world.lesions.length, 0);
  assert.equal(sequence(world), original);
});

test("a signed electric field moves negative DNA without automatic lesions", () => {
  const neutral = make(), rightField = make({ exposures: { electric: 1 } }), leftField = make({ exposures: { electric: -1 } });
  seconds(neutral, 1); seconds(rightField, 1); seconds(leftField, 1);
  const center = world => world.dna.parent.nodes.reduce((sum, node) => sum + node.x, 0) / world.dna.parent.nodes.length;
  assert.ok(center(rightField) < center(neutral));
  assert.ok(center(leftField) > center(neutral));
  for (const world of [neutral, rightField, leftField]) {
    assert.equal(world.lesions.length, 0);
    assert.equal(sequence(world), sequence(neutral));
  }
});

test("all species receive the same initial chemistry with repair disabled", () => {
  const worlds = SPECIES_PROFILES.map(item => pause(make({ species: item.id, seed: 77 })));
  for (const world of worlds) for (let index = 0; index < 5; index++) {
    pulseDamage(world, "uv"); pulseDamage(world, "xray"); pulseDamage(world, "oxidants");
  }
  for (const world of worlds) assert.deepEqual(world.lesions, worlds[0].lesions);
  assert.ok(worlds[0].lesions.length > 0);
});

test("Bare DNA has no intrinsic repair even with repair controls at maximum", () => {
  const world = pause(make({ protectors: { repair: 1, repairLight: 1 } }));
  pulseDamage(world, "uv");
  const before = structuredClone(world.lesions);
  world.dna.paused = false;
  seconds(world, 8);
  assert.deepEqual(world.lesions, before);
  assert.equal(world.totals.repaired, 0);
});

test("repair light removes dimers only when the preset has photolyase", () => {
  for (const species of ["ecoli", "human", "deinococcus", "bare"]) {
    const world = pause(make({ species, protectors: { repairLight: 1 } }));
    pulseDamage(world, "uv"); pulseDamage(world, "oxidants"); pulseDamage(world, "xray");
    const nonDimers = world.lesions.filter(item => item.kind !== "dimer").map(item => item.id);
    world.dna.paused = false;
    seconds(world, 3);
    assert.equal(world.lesions.filter(item => item.kind === "dimer").length, species === "ecoli" ? 0 : 1, species);
    assert.deepEqual(world.lesions.filter(item => item.kind !== "dimer").map(item => item.id), nonDimers, species);
  }
});

test("the Deinococcus preset repairs break markers faster without lower initial damage", () => {
  const standard = pause(make({ species: "human", sequence: "ACGT".repeat(16), seed: 19, protectors: { repair: 1 } }));
  const enhanced = pause(make({ species: "deinococcus", sequence: "ACGT".repeat(16), seed: 19, protectors: { repair: 1 } }));
  for (let index = 0; index < 20; index++) { pulseDamage(standard, "xray"); pulseDamage(enhanced, "xray"); }
  assert.deepEqual(standard.lesions, enhanced.lesions);
  assert.ok(standard.lesions.length >= 3);
  standard.dna.paused = false; enhanced.dna.paused = false;
  seconds(standard, 2); seconds(enhanced, 2);
  assert.ok(enhanced.totals.repaired > standard.totals.repaired);
});

test("the external repair brush works on Bare DNA without blocking the next hit", () => {
  const world = pause(make());
  pulseDamage(world, "uv");
  const lesion = world.lesions[0];
  const a = endpoint(world, lesion.index, lesion.strand), b = endpoint(world, lesion.index + 1, lesion.strand);
  assert.equal(repairDamageAt(world, (a.x + b.x) / 2, (a.y + b.y) / 2), true);
  assert.equal(world.lesions.length, 0);
  assert.equal(world.totals.repaired, 1);
  assert.equal(world.protectors.repair, 0);
  assert.equal(repairDamageAt(world, -1000, -1000), false);
  pulseDamage(world, "uv");
  assert.equal(world.lesions.length, 1);
  assert.equal(sequence(world), "ATGGAATTTGCTTGGCAAGGTCCT");
});

test("automatic repair removes markers while later exposure remains active", () => {
  const world = make({ species: "human", exposures: { uv: 1 }, protectors: { repair: 1 } });
  seconds(world, 10);
  assert.ok(world.totals.repaired > 0);
  assert.ok(world.totals.created > world.totals.repaired);
  assert.ok(world.lesions.length > 0);
});

test("the repair brush can reach either backbone of a double-strand break", () => {
  const world = pause(make({ seed: 14 }));
  for (let pulse = 0; pulse < 30 && !world.lesions.some(item => item.kind === "dsb"); pulse++) pulseDamage(world, "xray");
  const lesion = world.lesions.find(item => item.kind === "dsb");
  assert.ok(lesion);
  const a = endpoint(world, lesion.index, 1), b = endpoint(world, lesion.index + 1, 1);
  assert.equal(repairDamageAt(world, (a.x + b.x) / 2, (a.y + b.y) / 2), true);
  assert.ok(!world.lesions.some(item => item.id === lesion.id));
});

test("a DSB releases center constraints and repair restores their connection", () => {
  const world = pause(make({ seed: 14 }));
  const hit = endpoint(world, 8, 0);
  for (let burst = 0; burst < 100 && !world.lesions.some(item => item.kind === "dsb"); burst++) pulseDamage(world, "xray", hit);
  const lesion = world.lesions.find(item => item.kind === "dsb");
  assert.ok(lesion);
  assert.ok(world.dna.breaks.includes(lesion.index));
  const left = world.dna.parent.nodes[lesion.index], right = world.dna.parent.nodes[lesion.index + 1];
  assert.ok(Math.abs(left.vx) + Math.abs(left.vy) + Math.abs(right.vx) + Math.abs(right.vy) > 10);
  const dx = right.x - left.x, dy = right.y - left.y, length = Math.hypot(dx, dy);
  left.x -= dx / length * 30; left.y -= dy / length * 30;
  right.x += dx / length * 30; right.y += dy / length * 30;
  const connected = structuredClone(world);
  connected.lesions = connected.lesions.filter(item => item.kind !== "dsb");
  world.dna.paused = false; connected.dna.paused = false;
  stepDamageLab(world, 1 / 30); stepDamageLab(connected, 1 / 30);
  const gap = sample => {
    const a = sample.dna.parent.nodes[lesion.index], b = sample.dna.parent.nodes[lesion.index + 1];
    return Math.hypot(b.x - a.x, b.y - a.y);
  };
  assert.ok(gap(world) > gap(connected) + 2);
  const first = endpoint(world, lesion.index, 0), second = endpoint(world, lesion.index + 1, 0);
  repairDamageAt(world, (first.x + second.x) / 2, (first.y + second.y) / 2);
  assert.ok(!world.dna.breaks.includes(lesion.index));
  seconds(world, 1);
  assert.ok(world.dna.parent.nodes.every(node => [node.x, node.y, node.vx, node.vy].every(Number.isFinite)));
});

test("a single-strand lesion keeps the intact-strand center connection", () => {
  const world = make();
  world.lesions.push({ id: 100, kind: "ssb", index: 8, strand: 0, createdAt: 0 });
  stepDamageLab(world, 1 / 30);
  assert.deepEqual(world.dna.breaks, []);
});

test("unpaused pulses cause lesions at collision rather than at emission", () => {
  const world = make();
  pulseDamage(world, "uv");
  assert.equal(world.lesions.length, 0);
  assert.equal(world.particles[0].kind, "uv");
  seconds(world, 1);
  assert.equal(world.lesions[0].kind, "dimer");
});

test("paused and invalid steps are exact no-ops but explicit pulses still act", () => {
  const world = pause(make());
  const before = structuredClone(world);
  stepDamageLab(world, 10);
  assert.deepEqual(world, before);
  pulseDamage(world, "uv");
  assert.equal(world.lesions.length, 1);
  assert.equal(world.dna.time, 0);
  world.dna.paused = false;
  for (const value of [0, -1, NaN, Infinity]) {
    const unchanged = structuredClone(world);
    stepDamageLab(world, value);
    assert.deepEqual(world, unchanged);
  }
});

test("long frames cap at one thirtieth of a second", () => {
  const a = createDamageLab(800, 460), b = createDamageLab(800, 460);
  stepDamageLab(a, 100);
  stepDamageLab(b, 1 / 30);
  assert.deepEqual(a, b);
});

test("species and resize changes preserve chemical state and the synthetic sequence", () => {
  const world = pause(make());
  pulseDamage(world, "uv"); pulseDamage(world, "oxidants");
  const lesions = structuredClone(world.lesions), original = sequence(world);
  setDamageSpecies(world, "human");
  resizeDamageLab(world, 320, 700);
  assert.equal(sequence(world), original);
  assert.deepEqual(world.lesions, lesions);
  assert.equal(world.species, "human");
  setDamageSpecies(world, "unknown");
  assert.equal(world.species, "human");
});

test("particles and unique lesion sites stay bounded under heavy exposure", () => {
  const world = pause(make());
  for (let index = 0; index < 1000; index++) pulseDamage(world, ["uv", "xray", "oxidants"][index % 3]);
  assert.ok(world.particles.length <= 150);
  assert.ok(world.lesions.length <= world.dna.parent.bases.length * 8);
  const keys = world.lesions.map(item => `${item.kind}:${item.index}:${item.strand}`);
  assert.equal(new Set(keys).size, keys.length);
  assert.ok(world.particles.every(item => [item.x, item.y, item.vx, item.vy].every(Number.isFinite)));
});

test("continuous mixed exposure stays finite and never rewrites DNA letters", () => {
  const world = make({ exposures: { uv: 1, xray: 1, heat: 1, oxidants: 1, electric: -1 } });
  const original = sequence(world), partner = [...world.dna.parent.partners];
  for (let frame = 0; frame < 1200; frame++) {
    if (frame === 400) resizeDamageLab(world, 320, 700);
    if (frame === 800) resizeDamageLab(world, 1200, 360);
    stepDamageLab(world, 1 / 60);
    assert.ok(world.particles.length <= 150);
    assert.ok(world.dna.parent.nodes.every(node => [node.x, node.y, node.vx, node.vy].every(Number.isFinite)));
  }
  assert.equal(sequence(world), original);
  assert.deepEqual(world.dna.parent.partners, partner);
  assert.equal(world.dna.daughter, null);
});

test("snapshots return detached setting objects and honest lesion counts", () => {
  const world = pause(make());
  pulseDamage(world, "uv"); pulseDamage(world, "xray"); pulseDamage(world, "oxidants");
  const snapshot = takeDamageSnapshot(world);
  assert.equal(snapshot.activeLesions, snapshot.dimers + snapshot.singleBreaks + snapshot.doubleBreaks + snapshot.oxidizedBases);
  assert.equal(snapshot.sequence, sequence(world));
  snapshot.exposures.uv = .9;
  snapshot.protectors.repair = .9;
  assert.equal(world.exposures.uv, 0);
  assert.equal(world.protectors.repair, 0);
});
