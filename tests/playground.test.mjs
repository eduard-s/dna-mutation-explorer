import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_DNA_SEQUENCE,
  advanceDnaGeneration,
  beginDnaGrab,
  complementBase,
  completeDnaCopy,
  createDnaPlayground,
  duplexGeometry,
  getDnaMetrics,
  moveDnaPointer,
  mutateDnaAt,
  nearestDnaBase,
  releaseDnaGrab,
  repairDnaCopy,
  resizeDnaPlayground,
  startDnaCopy,
  stepDnaPlayground,
  unzipDnaAt,
} from "../dist/playground/engine.js";

const make = options => createDnaPlayground(800, 460, options);
const sequence = duplex => duplex.bases.join("");
const pairs = duplex => duplex.bases.every((base, index) => complementBase(base) === duplex.partners[index]);
const point = (world, kind = "parent", index = 8, side = "a") => duplexGeometry(world, kind)[index][side];
const stepSeconds = (world, seconds) => {
  for (let frame = 0; frame < Math.ceil(seconds * 60); frame++) stepDnaPlayground(world, 1 / 60);
};
const genes = world => ({
  baseline: [...world.baseline],
  parent: { bases: [...world.parent.bases], partners: [...world.parent.partners], copied: world.parent.copied },
  daughter: world.daughter && { bases: [...world.daughter.bases], partners: [...world.daughter.partners], copied: world.daughter.copied },
  copying: world.copying, copyProgress: world.copyProgress, errorAt: world.errorAt, generation: world.generation,
});
const physical = world => ({
  time: world.time, seed: world.seed,
  parent: structuredClone(world.parent.nodes),
  daughter: world.daughter && structuredClone(world.daughter.nodes),
});

test("the 24-base default has complementary aligned strands", () => {
  const world = make();
  assert.equal(DEFAULT_DNA_SEQUENCE, "ATGGAATTTGCTTGGCAAGGTCCT");
  assert.equal(sequence(world.parent), DEFAULT_DNA_SEQUENCE);
  assert.equal(world.parent.bases.length, 24);
  assert.equal(world.parent.nodes.length, 24);
  assert.equal(world.parent.copied, 24);
  assert.ok(pairs(world.parent));
  assert.deepEqual(world.baseline, world.parent.bases);
  assert.notEqual(world.baseline, world.parent.bases);
  assert.equal(world.daughter, null);
  assert.deepEqual(getDnaMetrics(world), { basePairs: 24, copied: 0, mismatches: 0, changes: 0, openPairs: 0, generation: 0 });
});

test("canonical input accepts case and whitespace with 6 to 64 bases", () => {
  assert.equal(sequence(make({ sequence: "a c g\nt a c" }).parent), "ACGTAC");
  assert.equal(make({ sequence: "A".repeat(64) }).parent.bases.length, 64);
  for (const input of ["", "ACGTA", "A".repeat(65)]) assert.throws(() => make({ sequence: input }), RangeError);
  for (const input of ["ACGTAN", "ACGTUR", ">DNA\nACGTAC", "ACGT-A", 123]) assert.throws(() => make({ sequence: input }), TypeError);
});

test("complementary bases use the canonical pairing rule", () => {
  assert.deepEqual(["A", "C", "G", "T"].map(complementBase), ["T", "G", "C", "A"]);
  assert.throws(() => complementBase("N"), TypeError);
});

test("invalid dimensions and seeds do not create nonfinite motion", () => {
  for (const dimension of [0, -1, NaN, Infinity]) assert.throws(() => createDnaPlayground(dimension, 460), RangeError);
  assert.throws(() => make({ seed: Infinity }), RangeError);
  assert.equal(createDnaPlayground(1, 1).width, 120);
  assert.equal(createDnaPlayground(20_000, 460).width, 16_384);
});

test("the same seed and steps give the same world", () => {
  const a = make({ seed: 19 }), b = make({ seed: 19 });
  assert.deepEqual(a, b);
  assert.notDeepEqual(a.parent.nodes, make({ seed: 20 }).parent.nodes);
  startDnaCopy(a, true); startDnaCopy(b, true);
  for (let frame = 0; frame < 240; frame++) { stepDnaPlayground(a, 1 / 60); stepDnaPlayground(b, 1 / 60); }
  assert.deepEqual(a, b);
});

test("the geometry exposes both strands with finite depth and correct base identities", () => {
  const world = make();
  const geometry = duplexGeometry(world, "parent");
  assert.equal(geometry.length, 24);
  for (const [index, pair] of geometry.entries()) {
    assert.equal(pair.index, index);
    assert.equal(pair.base, world.parent.bases[index]);
    assert.equal(pair.partner, world.parent.partners[index]);
    assert.equal(pair.mismatch, false);
    assert.equal(pair.changed, false);
    assert.equal(pair.a.z, -pair.b.z);
    assert.ok(Object.values(pair.a).every(Number.isFinite));
    assert.ok(Object.values(pair.b).every(Number.isFinite));
  }
  assert.deepEqual(duplexGeometry(world, "daughter"), []);
});

test("nearest-base selection uses visible strand positions and ignores distant or invalid input", () => {
  const world = make();
  for (const side of ["a", "b"]) {
    const location = point(world, "parent", 8, side);
    const hit = nearestDnaBase(world, location.x, location.y);
    assert.equal(hit.kind, "parent");
    assert.equal(hit.index, 8);
    assert.equal(hit.side, side === "a" ? 0 : 1);
    assert.equal(hit.distance, 0);
  }
  assert.equal(nearestDnaBase(world, -1000, -1000), null);
  assert.equal(nearestDnaBase(world, NaN, 0), null);
  startDnaCopy(world, true);
  const preview = structuredClone(world);
  preview.daughter.copied = preview.parent.bases.length;
  const hidden = point(preview, "daughter", 8);
  assert.notEqual(nearestDnaBase(world, hidden.x, hidden.y)?.kind, "daughter");
});

test("grab moves a center while paused, preserves DNA, and releases without a stale hold", () => {
  const world = make();
  world.paused = true;
  const before = genes(world);
  const location = point(world);
  const node = world.parent.nodes[8];
  const old = { x: node.x, y: node.y };
  assert.equal(beginDnaGrab(world, location.x, location.y), true);
  moveDnaPointer(world, location.x + 30, location.y + 20);
  assert.ok(Math.abs(node.x - old.x - 30) < 1e-9);
  assert.ok(Math.abs(node.y - old.y - 20) < 1e-9);
  assert.deepEqual(genes(world), before);
  moveDnaPointer(world, 1e9, -1e9);
  assert.ok(node.x <= world.width - 12 && node.y >= 12);
  const pointer = { ...world.pointer };
  moveDnaPointer(world, NaN, Infinity);
  assert.deepEqual(world.pointer, pointer);
  releaseDnaGrab(world);
  assert.equal(world.held, null);
  assert.equal(world.pointer.down, false);
  assert.equal(beginDnaGrab(world, -1000, -1000), false);
});

test("unzip opens a local region, preserves DNA, and relaxes after the hold", () => {
  const world = make();
  const before = genes(world);
  const location = point(world);
  const closed = duplexGeometry(world, "parent")[8];
  assert.equal(unzipDnaAt(world, location.x, location.y), true);
  assert.deepEqual(genes(world), before);
  assert.equal(world.parent.nodes[8].open, 1);
  assert.equal(world.parent.nodes[0].open, 0);
  const opened = duplexGeometry(world, "parent")[8];
  assert.ok(Math.hypot(opened.a.x - opened.b.x, opened.a.y - opened.b.y) > Math.hypot(closed.a.x - closed.b.x, closed.a.y - closed.b.y));
  stepSeconds(world, 1);
  assert.equal(world.parent.nodes[8].open, 1);
  stepSeconds(world, 6);
  assert.ok(world.parent.nodes[8].open < .02);
  assert.deepEqual(genes(world), before);
});

test("parent mutation changes a complete base pair and cycles through all four bases", () => {
  const world = make();
  const baseline = [...world.baseline];
  for (let trial = 1; trial <= 4; trial++) {
    const location = point(world);
    assert.equal(mutateDnaAt(world, location.x, location.y), true);
    assert.ok(pairs(world.parent));
    assert.deepEqual(world.baseline, baseline);
    assert.equal(getDnaMetrics(world).changes, trial === 4 ? 0 : 1);
  }
  assert.equal(sequence(world.parent), DEFAULT_DNA_SEQUENCE);
});

test("an accurate copy uses one old partner snapshot and a new matching strand", () => {
  const world = make();
  const original = genes(world);
  assert.equal(startDnaCopy(world), true);
  assert.equal(world.generation, 0);
  assert.equal(world.daughter.copied, 0);
  assert.deepEqual(world.daughter.partners, original.parent.partners);
  assert.notEqual(world.daughter.partners, world.parent.partners);
  assert.notEqual(world.daughter.bases, world.parent.bases);
  assert.equal(world.errorAt, null);
  assert.deepEqual(duplexGeometry(world, "daughter"), []);
  const daughter = world.daughter;
  assert.equal(startDnaCopy(world, true), false);
  assert.equal(world.daughter, daughter);
  stepSeconds(world, 4);
  assert.equal(world.copying, false);
  assert.equal(world.copyProgress, 24);
  assert.equal(world.daughter.copied, 24);
  assert.equal(sequence(world.daughter), DEFAULT_DNA_SEQUENCE);
  assert.ok(pairs(world.daughter));
  assert.equal(getDnaMetrics(world).mismatches, 0);
  assert.deepEqual(world.parent.bases, original.parent.bases);
});

test("copy progress reveals a prefix and only visible errors count", () => {
  const world = make({ seed: 11 });
  startDnaCopy(world, true);
  assert.ok(world.errorAt > 0 && world.errorAt < 23);
  assert.equal(getDnaMetrics(world).mismatches, 0);
  assert.equal(repairDnaCopy(world), 0);
  stepDnaPlayground(world, .033);
  assert.equal(duplexGeometry(world, "daughter").length, world.daughter.copied);
  while (world.daughter.copied <= world.errorAt) stepDnaPlayground(world, 1 / 60);
  assert.equal(getDnaMetrics(world).mismatches, 1);
  assert.equal(repairDnaCopy(world), 1);
  completeDnaCopy(world);
  assert.equal(getDnaMetrics(world).mismatches, 0);
});

test("a planned error always changes exactly one canonical interior base", () => {
  for (let seed = 0; seed < 20; seed++) {
    const world = make({ seed });
    startDnaCopy(world, true);
    completeDnaCopy(world);
    const different = world.daughter.bases.flatMap((base, index) => base !== world.parent.bases[index] ? [index] : []);
    assert.deepEqual(different, [world.errorAt]);
    assert.ok(world.errorAt > 0 && world.errorAt < world.parent.bases.length - 1);
    assert.ok(world.daughter.bases.every(base => "ACGT".includes(base)));
    assert.equal(getDnaMetrics(world).mismatches, 1);
    assert.equal(getDnaMetrics(world).changes, 0);
    assert.equal(duplexGeometry(world, "daughter")[world.errorAt].mismatch, true);
  }
});

test("complete-copy works while paused without a time, seed, or node change", () => {
  const world = make();
  world.paused = true;
  assert.equal(completeDnaCopy(world), false);
  startDnaCopy(world, true);
  const before = physical(world);
  assert.equal(completeDnaCopy(world), true);
  assert.deepEqual(physical(world), before);
  assert.equal(world.copying, false);
  assert.equal(world.daughter.copied, 24);
  assert.equal(getDnaMetrics(world).mismatches, 1);
  assert.equal(completeDnaCopy(world), false);
});

test("copying rejects template mutations without changing either sequence", () => {
  const world = make();
  startDnaCopy(world, true);
  const before = genes(world);
  const location = point(world);
  assert.equal(mutateDnaAt(world, location.x, location.y), false);
  assert.deepEqual(genes(world), before);
  assert.match(world.message, /finish/);
});

test("repair corrects new DNA from its old partner and leaves the source unchanged", () => {
  const world = make();
  assert.equal(repairDnaCopy(world), 0);
  startDnaCopy(world, true);
  completeDnaCopy(world);
  const parent = [...world.parent.bases], partner = [...world.daughter.partners], baseline = [...world.baseline];
  assert.equal(repairDnaCopy(world), 1);
  assert.equal(repairDnaCopy(world), 0);
  assert.equal(sequence(world.daughter), DEFAULT_DNA_SEQUENCE);
  assert.deepEqual(world.parent.bases, parent);
  assert.deepEqual(world.daughter.partners, partner);
  assert.deepEqual(world.baseline, baseline);
});

test("daughter mutation changes the new strand only and can be repaired", () => {
  const world = make();
  startDnaCopy(world);
  completeDnaCopy(world);
  const parent = [...world.parent.bases], partner = [...world.daughter.partners];
  const oldTemplate = point(world, "daughter", 8, "b");
  assert.equal(mutateDnaAt(world, oldTemplate.x, oldTemplate.y), false);
  const location = point(world, "daughter", 8);
  assert.equal(mutateDnaAt(world, location.x, location.y), true);
  assert.deepEqual(world.parent.bases, parent);
  assert.deepEqual(world.daughter.partners, partner);
  assert.equal(getDnaMetrics(world).mismatches, 1);
  assert.equal(repairDnaCopy(world), 1);
  assert.equal(sequence(world.daughter), DEFAULT_DNA_SEQUENCE);
});

test("source edits after a completed copy do not rewrite that copy or its old template", () => {
  const world = make();
  startDnaCopy(world);
  completeDnaCopy(world);
  const copied = [...world.daughter.bases], oldTemplate = [...world.daughter.partners];
  const location = point(world);
  assert.equal(mutateDnaAt(world, location.x, location.y), true);
  assert.deepEqual(world.daughter.bases, copied);
  assert.deepEqual(world.daughter.partners, oldTemplate);
  assert.match(world.message, /does not alter the existing copy/);
  assert.equal(repairDnaCopy(world), 0);
  assert.equal(getDnaMetrics(world).changes, 1);
  assert.match(world.message, /no mismatched pairs/);
});

test("one tracked descendant fixes an unrepaired error into a complementary pair", () => {
  const world = make();
  const baseline = [...world.baseline];
  assert.equal(advanceDnaGeneration(world), false);
  startDnaCopy(world, true);
  assert.equal(advanceDnaGeneration(world), false);
  completeDnaCopy(world);
  const child = [...world.daughter.bases];
  assert.equal(advanceDnaGeneration(world), true);
  assert.deepEqual(world.parent.bases, child);
  assert.deepEqual(world.baseline, baseline);
  assert.ok(pairs(world.parent));
  assert.equal(world.daughter, null);
  assert.equal(world.generation, 1);
  assert.equal(world.copyProgress, 0);
  assert.equal(getDnaMetrics(world).changes, 1);
  assert.equal(getDnaMetrics(world).mismatches, 0);
  startDnaCopy(world);
  completeDnaCopy(world);
  assert.equal(repairDnaCopy(world), 0);
  assert.deepEqual(world.daughter.bases, child);
  advanceDnaGeneration(world);
  assert.equal(getDnaMetrics(world).changes, 1);
  assert.equal(world.generation, 2);
});

test("repair does not erase a fixed mutation relative to the ancestral baseline", () => {
  const world = make();
  const location = point(world);
  mutateDnaAt(world, location.x, location.y);
  const mutated = [...world.parent.bases];
  startDnaCopy(world, true);
  completeDnaCopy(world);
  assert.equal(repairDnaCopy(world), 1);
  assert.deepEqual(world.daughter.bases, mutated);
  advanceDnaGeneration(world);
  assert.deepEqual(world.parent.bases, mutated);
  assert.equal(getDnaMetrics(world).changes, 1);
});

test("a repaired error does not become a new sequence change in the next generation", () => {
  const world = make();
  startDnaCopy(world, true);
  completeDnaCopy(world);
  repairDnaCopy(world);
  advanceDnaGeneration(world);
  assert.equal(getDnaMetrics(world).changes, 0);
  assert.equal(sequence(world.parent), DEFAULT_DNA_SEQUENCE);
});

test("resize preserves genetic state and copy progress across narrow and wide fields", () => {
  const world = make();
  startDnaCopy(world, true);
  stepSeconds(world, 1);
  const before = genes(world), clock = world.time, seed = world.seed;
  resizeDnaPlayground(world, 320, 760);
  assert.deepEqual(genes(world), before);
  assert.equal(world.time, clock);
  assert.equal(world.seed, seed);
  assert.equal(world.held, null);
  resizeDnaPlayground(world, 1600, 360);
  assert.deepEqual(genes(world), before);
  completeDnaCopy(world);
  const copied = genes(world);
  resizeDnaPlayground(world, 640, 480);
  assert.deepEqual(genes(world), copied);
});

test("paused and invalid steps are exact no-ops, including an active copy", () => {
  const world = make();
  startDnaCopy(world, true);
  for (const elapsed of [0, -1, NaN, Infinity]) {
    const before = structuredClone(world);
    stepDnaPlayground(world, elapsed);
    assert.deepEqual(world, before);
  }
  world.paused = true;
  const before = structuredClone(world);
  stepDnaPlayground(world, 100);
  assert.deepEqual(world, before);
  const location = point(world);
  assert.equal(unzipDnaAt(world, location.x, location.y), true);
  assert.equal(completeDnaCopy(world), true);
  assert.equal(repairDnaCopy(world), 1);
  assert.equal(advanceDnaGeneration(world), true);
  assert.equal(world.time, before.time);
});

test("a long frame uses the same bounded step as one thirtieth of a second", () => {
  const a = make(), b = make();
  startDnaCopy(a, true); startDnaCopy(b, true);
  stepDnaPlayground(a, 1000);
  stepDnaPlayground(b, 1 / 30);
  assert.deepEqual(a, b);
});

test("long motion, extreme grabs, and repeated resize keep finite bounded centers", () => {
  const world = make({ sequence: "ACGT".repeat(16), seed: 8 });
  const sizes = [[320, 700], [1400, 340], [128, 128], [800, 460]];
  for (let frame = 0; frame < 2400; frame++) {
    if (frame % 120 === 0) resizeDnaPlayground(world, ...sizes[(frame / 120) % sizes.length]);
    if (frame % 90 === 0) {
      const location = point(world, "parent", frame % 64);
      beginDnaGrab(world, location.x, location.y);
      moveDnaPointer(world, frame % 180 ? -1e8 : 1e8, frame % 180 ? 1e8 : -1e8);
    }
    if (frame % 90 === 20) releaseDnaGrab(world);
    stepDnaPlayground(world, frame % 2 ? 1 / 60 : 1e-9);
    for (const node of world.parent.nodes) {
      assert.ok([node.x, node.y, node.vx, node.vy, node.phase, node.open].every(Number.isFinite));
      assert.ok(node.x >= 12 && node.x <= world.width - 12);
      assert.ok(node.y >= 12 && node.y <= world.height - 12);
      assert.ok(Math.abs(node.vx) <= 220 && Math.abs(node.vy) <= 220);
    }
    assert.ok(pairs(world.parent));
  }
});
