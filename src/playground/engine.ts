import type { DnaBase, DnaDuplex, DnaGeometry, DnaMetrics, DnaNode, DnaPlayground, DnaPlaygroundOptions, DuplexKind } from "./types.js";

export const DEFAULT_DNA_SEQUENCE = "ATGGAATTTGCTTGGCAAGGTCCT";

const BASES = "ACGT";
const COMPLEMENTS: Readonly<Record<DnaBase, DnaBase>> = Object.freeze({ A: "T", C: "G", G: "C", T: "A" });
const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value));
const finite = (value: number, fallback = 0) => Number.isFinite(value) ? value : fallback;

export function complementBase(base: DnaBase): DnaBase {
  const complement = COMPLEMENTS[base];
  if (!complement) throw new TypeError("Use a canonical DNA base: A, C, G, or T.");
  return complement;
}

function sequenceBases(sequence: string): DnaBase[] {
  if (typeof sequence !== "string") throw new TypeError("The DNA sequence must be a string.");
  const compact = sequence.replace(/\s/g, "");
  if (/[^ACGTacgt]/.test(compact)) throw new TypeError("Use canonical DNA bases only: A, C, G, and T.");
  if (compact.length < 6 || compact.length > 64) throw new RangeError("Use a DNA sequence with 6 to 64 bases.");
  return Array.from(compact.toUpperCase()) as DnaBase[];
}

function dimension(value: number): number {
  if (!Number.isFinite(value) || value <= 0) throw new RangeError("The field dimensions must be finite positive numbers.");
  return clamp(value, 120, 16_384);
}

function random(world: DnaPlayground): number {
  world.seed = (Math.imul(world.seed, 1664525) + 1013904223) >>> 0;
  return world.seed / 4_294_967_296;
}

function target(world: DnaPlayground, kind: DuplexKind, index: number) {
  const count = world.parent.bases.length;
  const fraction = index / Math.max(1, count - 1);
  const row = kind === "daughter" ? .74 : world.daughter ? .3 : .49;
  const amplitude = world.layout === "wave" ? world.height * .18 : Math.min(15, world.height * .025);
  return {
    x: world.width * (.13 + fraction * .74),
    y: world.height * row + Math.sin(fraction * Math.PI * 2 + world.time * .15) * amplitude,
  };
}

function makeNodes(world: DnaPlayground, kind: DuplexKind, count: number): DnaNode[] {
  const phase = random(world) * Math.PI * 2;
  return Array.from({ length: count }, (_, index) => {
    const point = target(world, kind, index);
    return {
      x: point.x, y: point.y,
      vx: (random(world) - .5) * 7, vy: (random(world) - .5) * 7,
      phase: phase + index * .61, open: 0, openTime: 0,
    };
  });
}

export function createDnaPlayground(width: number, height: number, options: DnaPlaygroundOptions = {}): DnaPlayground {
  const bases = sequenceBases(options.sequence ?? DEFAULT_DNA_SEQUENCE);
  const seed = options.seed ?? 42;
  if (!Number.isFinite(seed)) throw new RangeError("The seed must be a finite number.");
  const world: DnaPlayground = {
    width: dimension(width), height: dimension(height), time: 0, seed: seed >>> 0, generation: 0,
    baseline: [...bases],
    parent: { bases: [...bases], partners: bases.map(complementBase), nodes: [], copied: bases.length },
    daughter: null, copying: false, copyProgress: 0, copySpeed: 8, errorAt: null,
    paused: false, held: null,
    pointer: { x: 0, y: 0, down: false, active: false },
    message: "Drag the DNA, open its strands, or make a copy.", selected: { kind: "parent", index: 0 },
  };
  world.parent.nodes = makeNodes(world, "parent", bases.length);
  world.pointer.x = world.width / 2;
  world.pointer.y = world.height / 2;
  return world;
}

export function resizeDnaPlayground(world: DnaPlayground, width: number, height: number): void {
  const nextWidth = dimension(width), nextHeight = dimension(height);
  const sx = nextWidth / world.width, sy = nextHeight / world.height;
  for (const duplex of [world.parent, world.daughter]) {
    if (!duplex) continue;
    for (const node of duplex.nodes) {
      node.x = finite(node.x * sx, nextWidth / 2);
      node.y = finite(node.y * sy, nextHeight / 2);
      node.vx = clamp(finite(node.vx * sx), -220, 220);
      node.vy = clamp(finite(node.vy * sy), -220, 220);
    }
  }
  world.pointer.x = clamp(finite(world.pointer.x * sx), 0, nextWidth);
  world.pointer.y = clamp(finite(world.pointer.y * sy), 0, nextHeight);
  world.width = nextWidth;
  world.height = nextHeight;
  releaseDnaGrab(world);
}

export function duplexGeometry(world: DnaPlayground, kind: DuplexKind): DnaGeometry[] {
  const duplex = kind === "parent" ? world.parent : world.daughter;
  if (!duplex) return [];
  const visible = kind === "parent" ? duplex.bases.length : duplex.copied;
  const radius = clamp(world.height * .07, 8, world.width < 640 ? 28 : 36);
  const spread = clamp(world.height * .09, radius + 4, 46);
  return duplex.nodes.slice(0, visible).map((node, index) => {
    const previous = duplex.nodes[Math.max(0, index - 1)]!;
    const next = duplex.nodes[Math.min(duplex.nodes.length - 1, index + 1)]!;
    const angle = Math.atan2(next.y - previous.y, next.x - previous.x) + Math.PI / 2;
    const nx = Math.cos(angle), ny = Math.sin(angle);
    const phase = node.phase + world.time * .65;
    const open = clamp(node.open, 0, 1);
    const offset = Math.sin(phase) * radius + open * (radius + spread);
    const z = Math.cos(phase);
    return {
      index,
      a: { x: node.x + nx * offset, y: node.y + ny * offset, z },
      b: { x: node.x - nx * offset, y: node.y - ny * offset, z: -z },
      base: duplex.bases[index]!, partner: duplex.partners[index]!, open,
      mismatch: duplex.bases[index] !== complementBase(duplex.partners[index]!),
      changed: duplex.bases[index] !== world.baseline[index],
    };
  });
}

export function nearestDnaBase(world: DnaPlayground, x: number, y: number): { kind: DuplexKind; index: number; side: 0 | 1; distance: number } | null {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const radius = world.width < 640 ? 28 : 22;
  let nearest: { kind: DuplexKind; index: number; side: 0 | 1; distance: number } | null = null;
  for (const kind of ["parent", "daughter"] as const) {
    for (const point of duplexGeometry(world, kind)) {
      for (const side of [0, 1] as const) {
        const position = side === 0 ? point.a : point.b;
        const distance = Math.hypot(position.x - x, position.y - y);
        if (distance <= radius && (!nearest || distance < nearest.distance)) nearest = { kind, index: point.index, side, distance };
      }
    }
  }
  return nearest;
}

function duplexFor(world: DnaPlayground, kind: DuplexKind): DnaDuplex | null {
  return kind === "parent" ? world.parent : world.daughter;
}

export function beginDnaGrab(world: DnaPlayground, x: number, y: number): boolean {
  const hit = nearestDnaBase(world, x, y);
  if (!hit) return false;
  const node = duplexFor(world, hit.kind)!.nodes[hit.index]!;
  world.pointer = { x, y, down: true, active: true };
  world.held = { kind: hit.kind, index: hit.index, offsetX: node.x - x, offsetY: node.y - y };
  world.selected = { kind: hit.kind, index: hit.index };
  return true;
}

export function moveDnaPointer(world: DnaPlayground, x: number, y: number): void {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;
  world.pointer.x = clamp(x, 0, world.width);
  world.pointer.y = clamp(y, 0, world.height);
  world.pointer.active = true;
  if (world.held) {
    const node = duplexFor(world, world.held.kind)?.nodes[world.held.index];
    if (node) {
      node.x = clamp(world.pointer.x + world.held.offsetX, 12, world.width - 12);
      node.y = clamp(world.pointer.y + world.held.offsetY, 12, world.height - 12);
      node.vx = 0;
      node.vy = 0;
    }
  }
}

export function releaseDnaGrab(world: DnaPlayground): void {
  world.held = null;
  world.pointer.down = false;
}

export function unzipDnaAt(world: DnaPlayground, x: number, y: number): boolean {
  const hit = nearestDnaBase(world, x, y);
  if (!hit) return false;
  const duplex = duplexFor(world, hit.kind)!;
  for (let index = Math.max(0, hit.index - 2); index <= Math.min(duplex.nodes.length - 1, hit.index + 2); index++) {
    const node = duplex.nodes[index]!;
    node.open = Math.max(node.open, 1 - Math.abs(index - hit.index) * .18);
    node.openTime = 4;
  }
  world.selected = { kind: hit.kind, index: hit.index };
  world.message = "The strands open briefly. Their DNA letters stay the same.";
  return true;
}

export function mutateDnaAt(world: DnaPlayground, x: number, y: number): boolean {
  if (world.copying) {
    world.message = "Let the copy finish before you change its DNA template.";
    return false;
  }
  const hit = nearestDnaBase(world, x, y);
  if (!hit) return false;
  const duplex = duplexFor(world, hit.kind)!;
  if (hit.kind === "daughter" && hit.side === 1) {
    world.message = "The old template stays unchanged. Select a base on the new strand.";
    return false;
  }
  const next = BASES[(BASES.indexOf(duplex.bases[hit.index]!) + 1) % BASES.length] as DnaBase;
  duplex.bases[hit.index] = next;
  if (hit.kind === "parent") duplex.partners[hit.index] = complementBase(next);
  world.selected = { kind: hit.kind, index: hit.index };
  world.message = hit.kind === "daughter"
    ? "The new strand changes. Its old template stays the same. Repair can correct a mismatch."
    : world.daughter
      ? "The source base pair changes. This change does not alter the existing copy."
      : "The base pair changes. A later copy can keep this sequence change.";
  return true;
}

function visibleMismatches(duplex: DnaDuplex): number {
  let count = 0;
  for (let index = 0; index < duplex.copied; index++) {
    if (duplex.bases[index] !== complementBase(duplex.partners[index]!)) count++;
  }
  return count;
}

function copyMessage(world: DnaPlayground): void {
  const mismatches = world.daughter ? visibleMismatches(world.daughter) : 0;
  world.message = mismatches > 0
    ? "The copy has a mismatch. Repair it, or pass the new strand to the next generation."
    : "The copy is complete. It pairs one old template strand with one new strand.";
}

export function startDnaCopy(world: DnaPlayground, withError = false): boolean {
  if (world.copying) {
    world.message = "A copy is already in progress.";
    return false;
  }
  const bases = [...world.parent.bases];
  world.daughter = {
    bases, partners: [...world.parent.partners], nodes: makeNodes(world, "daughter", bases.length), copied: 0,
  };
  world.errorAt = withError ? 1 + Math.floor(random(world) * (bases.length - 2)) : null;
  if (world.errorAt !== null) {
    const correct = bases[world.errorAt]!;
    const alternatives = Array.from(BASES).filter(base => base !== correct);
    bases[world.errorAt] = alternatives[Math.floor(random(world) * alternatives.length)] as DnaBase;
  }
  world.copying = true;
  world.copyProgress = 0;
  releaseDnaGrab(world);
  world.selected = { kind: "parent", index: 0 };
  world.message = withError ? "A new strand grows along an old template, with one planned copying error." : "A new strand grows along an old template.";
  return true;
}

/** Complete a copy without a physics step. Node positions, velocities, time, and seed stay the same. */
export function completeDnaCopy(world: DnaPlayground): boolean {
  if (!world.copying || !world.daughter) return false;
  world.copyProgress = world.daughter.bases.length;
  world.daughter.copied = world.daughter.bases.length;
  world.copying = false;
  copyMessage(world);
  return true;
}

export function repairDnaCopy(world: DnaPlayground): number {
  if (!world.daughter) {
    world.message = "Start a copy before repair.";
    return 0;
  }
  let repaired = 0;
  for (let index = 0; index < world.daughter.copied; index++) {
    const correct = complementBase(world.daughter.partners[index]!);
    if (world.daughter.bases[index] !== correct) {
      world.daughter.bases[index] = correct;
      repaired++;
    }
  }
  world.message = repaired > 0 ? "Repair corrects the new strand from its old template." : "The visible copy has no mismatched pairs.";
  return repaired;
}

export function advanceDnaGeneration(world: DnaPlayground): boolean {
  const daughter = world.daughter;
  if (!daughter || world.copying || daughter.copied !== daughter.bases.length) {
    world.message = "Complete a copy before the next generation.";
    return false;
  }
  const bases = [...daughter.bases];
  world.parent = {
    bases, partners: bases.map(complementBase), nodes: daughter.nodes.map(node => ({ ...node })), copied: bases.length,
  };
  world.daughter = null;
  world.copying = false;
  world.copyProgress = 0;
  world.errorAt = null;
  world.generation++;
  world.selected = { kind: "parent", index: 0 };
  releaseDnaGrab(world);
  world.message = "This tracked descendant keeps the new strand. Its new partner makes a matching base pair.";
  return true;
}

function constrain(a: DnaNode, b: DnaNode, rest: number, strength: number, heldA: boolean, heldB: boolean): void {
  const dx = b.x - a.x, dy = b.y - a.y;
  const length = Math.hypot(dx, dy);
  if (length < 1e-8) return;
  const change = clamp((length - rest) / length * strength, -.8, .8);
  const aWeight = heldA ? 0 : heldB ? 1 : .5;
  a.x += dx * change * aWeight;
  a.y += dy * change * aWeight;
  b.x -= dx * change * (1 - aWeight);
  b.y -= dy * change * (1 - aWeight);
}

function stepDuplex(world: DnaPlayground, duplex: DnaDuplex, kind: DuplexKind, dt: number): void {
  const before = duplex.nodes.map(node => ({ x: node.x, y: node.y }));
  const heldIndex = world.held?.kind === kind ? world.held.index : -1;
  const rest = world.width * .74 / Math.max(1, duplex.nodes.length - 1);
  const anchors = duplex.nodes.map((_, index) => target(world, kind, index));
  const breaks = new Set(kind === "parent" ? world.breaks ?? [] : []);
  const anchorDistance = (a: number, b: number) => Math.hypot(anchors[b]!.x - anchors[a]!.x, anchors[b]!.y - anchors[a]!.y);
  for (let index = 0; index < duplex.nodes.length; index++) {
    const node = duplex.nodes[index]!;
    const anchor = anchors[index]!;
    node.x = finite(node.x, anchor.x);
    node.y = finite(node.y, anchor.y);
    node.phase = finite(node.phase);
    node.vx = clamp(finite(node.vx), -220, 220);
    node.vy = clamp(finite(node.vy), -220, 220);
    node.open = clamp(finite(node.open), 0, 1);
    node.openTime = Math.max(0, finite(node.openTime) - dt);
    if (node.openTime === 0) node.open *= Math.exp(-dt * 3);
    if (world.copying && kind === "parent" && Math.abs(index - world.copyProgress) < 3) {
      node.open = Math.max(node.open, .9);
      node.openTime = .45;
    }
    if (index === heldIndex) continue;
    const wave = world.time * .7 + node.phase;
    node.vx += ((anchor.x - node.x) * .7 + Math.sin(wave) * 3) * dt;
    node.vy += ((anchor.y - node.y) * .7 + Math.cos(wave * .8) * 3) * dt;
    const damping = Math.exp(-dt * 1.6);
    node.vx *= damping;
    node.vy *= damping;
    node.x += node.vx * dt;
    node.y += node.vy * dt;
  }
  for (let iteration = 0; iteration < 6; iteration++) {
    for (let index = 0; index + 1 < duplex.nodes.length; index++) {
      if (breaks.has(index)) continue;
      const distance = world.layout === "wave" ? anchorDistance(index, index + 1) : rest;
      constrain(duplex.nodes[index]!, duplex.nodes[index + 1]!, distance, .7, index === heldIndex, index + 1 === heldIndex);
    }
    for (let index = 0; index + 2 < duplex.nodes.length; index++) {
      if (breaks.has(index) || breaks.has(index + 1)) continue;
      const distance = world.layout === "wave" ? anchorDistance(index, index + 2) : rest * 1.98;
      constrain(duplex.nodes[index]!, duplex.nodes[index + 2]!, distance, .08, index === heldIndex, index + 2 === heldIndex);
    }
  }
  for (let index = 0; index < duplex.nodes.length; index++) {
    const node = duplex.nodes[index]!;
    node.x = clamp(finite(node.x, world.width / 2), 12, world.width - 12);
    node.y = clamp(finite(node.y, world.height / 2), 12, world.height - 12);
    node.vx = clamp(finite((node.x - finite(before[index]!.x, node.x)) / Math.max(dt, 1e-4) * .98), -220, 220);
    node.vy = clamp(finite((node.y - finite(before[index]!.y, node.y)) / Math.max(dt, 1e-4) * .98), -220, 220);
    if (index === heldIndex) { node.vx = 0; node.vy = 0; }
  }
}

export function stepDnaPlayground(world: DnaPlayground, elapsed: number): void {
  if (world.paused || !Number.isFinite(elapsed) || elapsed <= 0) return;
  const dt = Math.min(elapsed, 1 / 30);
  world.time += dt;
  stepDuplex(world, world.parent, "parent", dt);
  if (world.daughter) stepDuplex(world, world.daughter, "daughter", dt);
  if (world.copying && world.daughter) {
    world.copyProgress = clamp(world.copyProgress + dt * clamp(finite(world.copySpeed), 0, 64), 0, world.daughter.bases.length);
    world.daughter.copied = Math.min(world.daughter.bases.length, Math.floor(world.copyProgress + 1e-9));
    if (world.daughter.copied === world.daughter.bases.length) completeDnaCopy(world);
  }
}

export function getDnaMetrics(world: DnaPlayground): DnaMetrics {
  let changes = 0;
  for (let index = 0; index < world.parent.bases.length; index++) {
    if (world.parent.bases[index] !== world.baseline[index]) changes++;
  }
  let openPairs = 0;
  for (const duplex of [world.parent, world.daughter]) {
    if (!duplex) continue;
    for (let index = 0; index < duplex.copied; index++) if (duplex.nodes[index]!.open > .15) openPairs++;
  }
  return {
    basePairs: world.parent.bases.length,
    copied: world.daughter?.copied ?? 0,
    mismatches: world.daughter ? visibleMismatches(world.daughter) : 0,
    changes, openPairs, generation: world.generation,
  };
}
