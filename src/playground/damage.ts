import { createDnaPlayground, duplexGeometry, nearestDnaBase, resizeDnaPlayground, stepDnaPlayground } from "./engine.js";
import type { DamageEffect, DamageExposures, DamageLabOptions, DamageLesion, DamageMetrics, DamageParticle, DamageSnapshot, DamageWorld, DnaProtectors, ExposureKind, SpeciesId, SpeciesProfile } from "./damage-types.js";

export const SPECIES_PROFILES: readonly SpeciesProfile[] = Object.freeze([
  Object.freeze({ id: "bare", name: "Bare DNA", description: "DNA without intrinsic repair. The repair brush adds an external repair action.", repairFactor: 0, breakRepairFactor: 0, photolyase: false }),
  Object.freeze({ id: "ecoli", name: "E. coli", description: "Illustrative repair with photolyase under repair light.", repairFactor: 1, breakRepairFactor: 1, photolyase: true }),
  Object.freeze({ id: "human", name: "Human cells", description: "Illustrative repair without photolyase.", repairFactor: 1, breakRepairFactor: 1, photolyase: false }),
  Object.freeze({ id: "deinococcus", name: "D. radiodurans", description: "Illustrative faster break repair. The preset does not reduce initial damage.", repairFactor: 1.2, breakRepairFactor: 3, photolyase: false }),
]);

export const DEFAULT_DAMAGE_EXPOSURES: Readonly<DamageExposures> = Object.freeze({ uv: .25, xray: 0, heat: .12, oxidants: .15, electric: 0 });
export const DEFAULT_DNA_PROTECTORS: Readonly<DnaProtectors> = Object.freeze({ antioxidants: .1, uvFilter: 0, xrayShield: 0, repair: .35, repairLight: 0 });
export const MAX_EXPOSURE_PARTICLES_PER_SECOND = { uv: 3, xray: 3, oxidants: 4 } as const;

const clamp = (value: number, low = 0, high = 1) => Math.max(low, Math.min(high, value));
const profile = (world: DamageWorld) => SPECIES_PROFILES.find(item => item.id === world.species)!;
const pointDistance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
function random(world: DamageWorld): number {
  world.seed = (Math.imul(world.seed, 1664525) + 1013904223) >>> 0;
  return world.seed / 4_294_967_296;
}

export function createDamageLab(width: number, height: number, options: DamageLabOptions = {}): DamageWorld {
  const dna = createDnaPlayground(width, height, { sequence: options.sequence, seed: options.seed });
  dna.layout = "wave";
  dna.breaks = [];
  for (let index = 0; index < dna.parent.nodes.length; index++) {
    const fraction = index / Math.max(1, dna.parent.nodes.length - 1);
    dna.parent.nodes[index]!.y = dna.height * .49 + Math.sin(fraction * Math.PI * 2) * dna.height * .18;
  }
  const species = options.species ?? "ecoli";
  if (!SPECIES_PROFILES.some(item => item.id === species)) throw new TypeError("Choose a known species preset.");
  const world: DamageWorld = {
    dna, species, exposures: { ...DEFAULT_DAMAGE_EXPOSURES }, protectors: { ...DEFAULT_DNA_PROTECTORS },
    lesions: [], particles: [], selectedEffect: "uv", lastEvent: null,
    seed: (options.seed ?? 42) >>> 0, nextId: 1,
    budgets: { uv: 0, xray: 0, heat: 0, oxidants: 0, electric: 0 }, repairBudget: 0, photoRepairBudget: 0,
    totals: { created: 0, repaired: 0, neutralized: 0, blocked: 0 },
    message: "Expose DNA, then add a matching protector. The rates are illustrative.",
  };
  setDamageExposures(world, options.exposures ?? {});
  setDnaProtectors(world, options.protectors ?? {});
  return world;
}

export function setDamageExposures(world: DamageWorld, patch: Partial<DamageExposures>): void {
  if (!patch || typeof patch !== "object") return;
  for (const key of ["uv", "xray", "heat", "oxidants", "electric"] as const) {
    const value = patch[key];
    if (typeof value === "number" && Number.isFinite(value)) world.exposures[key] = clamp(value, key === "electric" ? -1 : 0, 1);
  }
}

export function setDnaProtectors(world: DamageWorld, patch: Partial<DnaProtectors>): void {
  if (!patch || typeof patch !== "object") return;
  for (const key of ["antioxidants", "uvFilter", "xrayShield", "repair", "repairLight"] as const) {
    const value = patch[key];
    if (typeof value === "number" && Number.isFinite(value)) world.protectors[key] = clamp(value);
  }
}

export function setDamageSpecies(world: DamageWorld, id: SpeciesId): void {
  if (!SPECIES_PROFILES.some(item => item.id === id)) return;
  world.species = id;
  world.repairBudget = 0;
  world.photoRepairBudget = 0;
  world.message = "The repair preset changes. The DNA sequence and existing lesions stay the same.";
}

export function resizeDamageLab(world: DamageWorld, width: number, height: number): void {
  const previousWidth = world.dna.width, previousHeight = world.dna.height;
  resizeDnaPlayground(world.dna, width, height);
  for (const particle of world.particles) {
    particle.x *= world.dna.width / previousWidth;
    particle.y *= world.dna.height / previousHeight;
    particle.vx *= world.dna.width / previousWidth;
    particle.vy *= world.dna.height / previousHeight;
  }
}

function strandBases(world: DamageWorld, strand: 0 | 1) {
  return strand === 0 ? world.dna.parent.bases : world.dna.parent.partners;
}

function targetPoint(world: DamageWorld, index: number, strand: 0 | 1) {
  const geometry = duplexGeometry(world.dna, "parent");
  const item = geometry[clamp(index, 0, geometry.length - 1)]!;
  return strand === 0 ? item.a : item.b;
}

function candidates(world: DamageWorld, effect: "uv" | "oxidants"): { index: number; strand: 0 | 1 }[] {
  const result: { index: number; strand: 0 | 1 }[] = [];
  for (const strand of [0, 1] as const) {
    const bases = strandBases(world, strand);
    for (let index = 0; index < bases.length; index++) {
      if (effect === "oxidants" ? bases[index] === "G" : index + 1 < bases.length && /[CT]/.test(bases[index]!) && /[CT]/.test(bases[index + 1]!)) result.push({ index, strand });
    }
  }
  return result;
}

function chooseTarget(world: DamageWorld, effect: ExposureKind, point?: { x: number; y: number }) {
  if (point && Number.isFinite(point.x) && Number.isFinite(point.y)) {
    const direct = nearestDnaBase(world.dna, point.x, point.y);
    if (direct) return { index: direct.index, strand: direct.side };
    let nearest = { index: 0, strand: 0 as 0 | 1, distance: Infinity };
    for (const item of duplexGeometry(world.dna, "parent")) for (const strand of [0, 1] as const) {
      const distance = pointDistance(point, strand === 0 ? item.a : item.b);
      if (distance < nearest.distance) nearest = { index: item.index, strand, distance };
    }
    return { index: nearest.index, strand: nearest.strand };
  }
  if (effect === "uv" || effect === "oxidants") {
    const eligible = candidates(world, effect);
    if (eligible.length > 0) return eligible[Math.floor(random(world) * eligible.length)]!;
  }
  return { index: Math.floor(random(world) * world.dna.parent.bases.length), strand: random(world) < .5 ? 0 as const : 1 as const };
}

function particle(world: DamageWorld, data: Omit<DamageParticle, "id" | "age">): DamageParticle {
  const result: DamageParticle = { id: world.nextId++, age: 0, ...data };
  world.particles.push(result);
  if (world.particles.length > 150) world.particles.splice(0, world.particles.length - 150);
  return result;
}

function event(world: DamageWorld, effect: DamageEffect, outcome: NonNullable<DamageWorld["lastEvent"]>["outcome"], index: number, strand: 0 | 1) {
  world.lastEvent = { effect, outcome, time: world.dna.time, index, strand };
  world.dna.selected = { kind: "parent", index };
}

function addLesion(world: DamageWorld, kind: DamageLesion["kind"], index: number, strand: 0 | 1, effect: ExposureKind): boolean {
  if (world.lesions.some(item => item.kind === kind && item.index === index && item.strand === strand)) return false;
  if (world.lesions.length >= world.dna.parent.bases.length * 8) return false;
  if (kind === "dimer" && world.lesions.some(item => item.kind === "dimer" && item.strand === strand && Math.abs(item.index - index) <= 1)) return false;
  world.lesions.push({ id: world.nextId++, kind, index, strand, createdAt: world.dna.time });
  if (kind === "dsb") {
    world.dna.breaks = world.lesions.filter(item => item.kind === "dsb").map(item => item.index);
    const a = world.dna.parent.nodes[index]!, b = world.dna.parent.nodes[index + 1]!;
    const dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy) || 1;
    a.vx = clamp(a.vx - dx / length * 22, -220, 220);
    a.vy = clamp(a.vy - dy / length * 22, -220, 220);
    b.vx = clamp(b.vx + dx / length * 22, -220, 220);
    b.vy = clamp(b.vy + dy / length * 22, -220, 220);
  }
  world.totals.created++;
  event(world, effect, kind, index, strand);
  world.message = kind === "dimer" ? "UV joins adjacent C or T bases on one strand. The letters do not change."
    : kind === "oxidized" ? "A reactive oxygen species oxidizes a G base. This marker does not change its letter."
    : kind === "dsb" ? "Nearby breaks affect both backbones. The DNA letters stay in place."
    : "Ionization or a reactive oxygen species breaks one backbone.";
  return true;
}

function addBreak(world: DamageWorld, index: number, strand: 0 | 1): void {
  const site = Math.min(index, world.dna.parent.bases.length - 2);
  if (world.lesions.some(item => item.kind === "dsb" && Math.abs(item.index - site) <= 1)) return;
  const opposite = world.lesions.find(item => item.kind === "ssb" && item.strand !== strand && Math.abs(item.index - site) <= 1);
  if (opposite) {
    world.lesions = world.lesions.filter(item => item.id !== opposite.id && !(item.kind === "ssb" && Math.abs(item.index - site) <= 1));
    addLesion(world, "dsb", Math.min(site, opposite.index), 0, "xray");
  } else addLesion(world, "ssb", site, strand, "xray");
}

function neutralize(world: DamageWorld, radical: DamageParticle): void {
  if (radical.absorbed) return;
  radical.absorbed = true;
  radical.age = Math.max(radical.age, radical.life - .22);
  world.totals.neutralized++;
  const index = radical.targetIndex ?? 0, strand = radical.strand ?? 0;
  event(world, "antioxidants", "neutralized", index, strand);
  world.message = "An antioxidant neutralizes a reactive oxygen species. It does not stop a direct UV photon or X-ray hit.";
}

function emitElectron(world: DamageWorld, index: number, strand: 0 | 1) {
  const point = targetPoint(world, index, strand);
  const angle = random(world) * Math.PI * 2;
  particle(world, { kind: "electron", x: point.x, y: point.y, vx: Math.cos(angle) * 150, vy: Math.sin(angle) * 150, life: .65, source: "xray" });
}

function impact(world: DamageWorld, item: DamageParticle): void {
  if (item.absorbed || item.targetIndex === undefined) return;
  const index = item.targetIndex, strand = item.strand ?? 0;
  const point = targetPoint(world, index, strand);
  if (item.kind === "uv" || item.kind === "xray") {
    const filter = item.kind === "uv" ? world.protectors.uvFilter : world.protectors.xrayShield;
    if (filter >= 1 || filter > 0 && random(world) < filter) {
      item.absorbed = true;
      world.totals.blocked++;
      event(world, item.kind, "shielded", index, strand);
      world.message = item.kind === "uv" ? "The UV filter blocks this photon." : "The X-ray shield blocks this hit.";
      return;
    }
  }
  if (item.kind === "uv") {
    const bases = strandBases(world, strand);
    if (index + 1 < bases.length && /[CT]/.test(bases[index]!) && /[CT]/.test(bases[index + 1]!)) addLesion(world, "dimer", index, strand, "uv");
    else world.message = "This UV site has no adjacent C or T pair for a dimer.";
  } else if (item.kind === "xray") {
    emitElectron(world, index, strand);
    if (random(world) < .75) {
      addBreak(world, index, strand);
      if (random(world) < .18) addBreak(world, index, strand === 0 ? 1 : 0);
    } else {
      const radical = particle(world, { kind: "radical", x: point.x + 26, y: point.y - 32, vx: 0, vy: 0, life: 2, targetIndex: index, strand, source: "xray" });
      if (world.dna.paused) impact(world, radical);
    }
  } else if (item.kind === "radical") {
    const scavenger = world.particles.find(other => other.kind === "scavenger" && !other.absorbed && pointDistance(other, item) < 65);
    if (scavenger || world.protectors.antioxidants >= 1 || world.protectors.antioxidants > 0 && random(world) < world.protectors.antioxidants) {
      if (scavenger) scavenger.absorbed = true;
      neutralize(world, item);
      return;
    }
    if (item.source === "xray") addBreak(world, index, strand);
    else if (strandBases(world, strand)[index] === "G") addLesion(world, "oxidized", index, strand, "oxidants");
    else world.message = "This simplified oxidation marker targets G bases.";
  }
  item.absorbed = true;
}

function emitExposure(world: DamageWorld, effect: "uv" | "xray" | "oxidants", point?: { x: number; y: number }): boolean {
  const chosen = chooseTarget(world, effect, point);
  const destination = targetPoint(world, chosen.index, chosen.strand);
  const kind = effect === "oxidants" ? "radical" : effect;
  const item = particle(world, {
    kind, x: destination.x + (effect === "oxidants" ? 75 : -65), y: destination.y - (effect === "oxidants" ? 65 : 150),
    vx: 0, vy: 0, life: 2.5, targetIndex: chosen.index, strand: chosen.strand, source: effect,
  });
  if (world.dna.paused) impact(world, item);
  return true;
}

function repairOne(world: DamageWorld, lesion: DamageLesion, external = false): void {
  world.lesions = world.lesions.filter(item => item.id !== lesion.id);
  if (lesion.kind === "dsb") world.dna.breaks = world.lesions.filter(item => item.kind === "dsb").map(item => item.index);
  world.totals.repaired++;
  event(world, "repair", "repair", lesion.index, lesion.strand);
  if (external && world.lastEvent) world.lastEvent.externalRepair = true;
  world.message = "Repair removes one lesion marker. Incoming exposure can cause new damage.";
}

function lesionPoint(world: DamageWorld, lesion: DamageLesion) {
  const first = targetPoint(world, lesion.index, lesion.strand);
  if (lesion.kind === "oxidized") return first;
  const second = targetPoint(world, Math.min(lesion.index + 1, world.dna.parent.bases.length - 1), lesion.strand);
  return { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
}

export function repairDamageAt(world: DamageWorld, x: number, y: number): boolean {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  let nearest: DamageLesion | null = null, distance = world.dna.width < 640 ? 65 : 50;
  for (const lesion of world.lesions) {
    let nextDistance = pointDistance({ x, y }, lesionPoint(world, lesion));
    if (lesion.kind === "dsb") nextDistance = Math.min(nextDistance, pointDistance({ x, y }, lesionPoint(world, { ...lesion, strand: 1 })));
    if (nextDistance < distance) { nearest = lesion; distance = nextDistance; }
  }
  if (!nearest) return false;
  repairOne(world, nearest, true);
  return true;
}

export function pulseDamage(world: DamageWorld, effect: DamageEffect = world.selectedEffect, point?: { x: number; y: number }): boolean {
  if (!["uv", "xray", "heat", "oxidants", "electric", "antioxidants", "repair"].includes(effect)) return false;
  if (point && (!Number.isFinite(point.x) || !Number.isFinite(point.y))) return false;
  world.selectedEffect = effect;
  if (effect === "uv" || effect === "xray" || effect === "oxidants") return emitExposure(world, effect, point);
  if (effect === "repair") {
    if (point) return repairDamageAt(world, point.x, point.y);
    if (!world.lesions[0]) { world.message = "The DNA has no lesion to repair."; return false; }
    repairOne(world, world.lesions[0], true);
    return true;
  }
  const chosen = chooseTarget(world, effect === "antioxidants" ? "oxidants" : effect, point);
  const center = point ?? targetPoint(world, chosen.index, chosen.strand);
  if (effect === "antioxidants") {
    for (let index = 0; index < 6; index++) {
      const angle = index * Math.PI / 3;
      particle(world, { kind: "scavenger", x: center.x + Math.cos(angle) * 28, y: center.y + Math.sin(angle) * 28, vx: Math.cos(angle) * 7, vy: Math.sin(angle) * 7, life: 3 });
    }
    for (const item of world.particles) if (item.kind === "radical" && !item.absorbed && pointDistance(item, center) < 130) neutralize(world, item);
    world.message = "Antioxidants can neutralize nearby reactive oxygen species. Direct UV and X-ray hits need their own shields.";
    return true;
  }
  if (effect === "heat") {
    for (let index = Math.max(0, chosen.index - 3); index <= Math.min(world.dna.parent.nodes.length - 1, chosen.index + 3); index++) {
      const node = world.dna.parent.nodes[index]!;
      node.open = Math.max(node.open, .9);
      node.openTime = 1.2;
    }
    event(world, "heat", "heat", chosen.index, chosen.strand);
    world.message = "Heat opens base pairing. It does not cut a backbone or change the DNA letters in this model.";
    return true;
  }
  if (effect === "electric") {
    const direction = world.exposures.electric || .6;
    for (const node of world.dna.parent.nodes) node.vx = clamp(node.vx - direction * 80, -220, 220);
    event(world, "electric", "field", chosen.index, chosen.strand);
    world.message = "The electric field moves negatively charged DNA. It does not create a chemical lesion here.";
    return true;
  }
  return false;
}

function automaticRepair(world: DamageWorld, dt: number): void {
  const species = profile(world);
  const first = world.lesions[0];
  if (first && world.protectors.repair > 0 && species.repairFactor > 0) {
    const breakFactor = first.kind === "ssb" || first.kind === "dsb" ? species.breakRepairFactor : 1;
    world.repairBudget += dt * world.protectors.repair * species.repairFactor * breakFactor * .6;
    if (world.repairBudget >= 1) { world.repairBudget -= 1; repairOne(world, first); }
  } else world.repairBudget = 0;
  const dimer = world.lesions.find(item => item.kind === "dimer");
  if (dimer && species.photolyase && world.protectors.repairLight > 0) {
    world.photoRepairBudget += dt * world.protectors.repairLight * .9;
    if (world.photoRepairBudget >= 1) { world.photoRepairBudget -= 1; repairOne(world, dimer); }
  } else world.photoRepairBudget = 0;
}

function stepParticles(world: DamageWorld, dt: number): void {
  const geometry = duplexGeometry(world.dna, "parent");
  for (const item of [...world.particles]) {
    item.age += dt;
    if (!item.absorbed && (item.kind === "uv" || item.kind === "xray" || item.kind === "radical") && item.targetIndex !== undefined) {
      const pair = geometry[clamp(item.targetIndex, 0, geometry.length - 1)]!;
      const destination = item.strand === 1 ? pair.b : pair.a;
      const dx = destination.x - item.x, dy = destination.y - item.y, distance = Math.hypot(dx, dy);
      const speed = item.kind === "radical" ? 180 : 420;
      if (distance < Math.max(10, speed * dt) || item.age > 1.2) impact(world, item);
      else { item.vx = dx / distance * speed; item.vy = dy / distance * speed; }
    }
    item.x += item.vx * dt;
    item.y += item.vy * dt;
    if (item.absorbed) { item.vx *= Math.exp(-dt * 8); item.vy *= Math.exp(-dt * 8); }
  }
  for (const radical of world.particles) if (radical.kind === "radical" && !radical.absorbed) {
    const scavenger = world.particles.find(item => item.kind === "scavenger" && !item.absorbed && pointDistance(item, radical) < 25);
    if (scavenger) { scavenger.absorbed = true; neutralize(world, radical); }
  }
  world.particles = world.particles.filter(item => item.age < item.life && Number.isFinite(item.x) && Number.isFinite(item.y));
}

export function stepDamageLab(world: DamageWorld, elapsed: number): void {
  if (world.dna.paused || !Number.isFinite(elapsed) || elapsed <= 0) return;
  const dt = Math.min(elapsed, 1 / 30);
  world.dna.breaks = world.lesions.filter(item => item.kind === "dsb").map(item => item.index);
  const heat = world.exposures.heat;
  for (const node of world.dna.parent.nodes) {
    node.vx = clamp(node.vx - world.exposures.electric * 24 * dt, -220, 220);
    if (heat > 0) {
      const open = clamp((heat - .2) / .8);
      node.open = Math.max(node.open, open);
      if (open > 0) node.openTime = Math.max(node.openTime, .1);
      node.vx = clamp(node.vx + (random(world) - .5) * heat * Math.sqrt(dt) * 7, -220, 220);
      node.vy = clamp(node.vy + (random(world) - .5) * heat * Math.sqrt(dt) * 7, -220, 220);
    }
  }
  for (const lesion of world.lesions) if (lesion.kind === "dimer") {
    const node = world.dna.parent.nodes[Math.min(lesion.index + 1, world.dna.parent.nodes.length - 1)]!;
    node.vy = clamp(node.vy + (lesion.strand === 0 ? 1 : -1) * 16 * dt, -220, 220);
  }
  stepDnaPlayground(world.dna, dt);
  for (const kind of ["uv", "xray", "oxidants"] as const) {
    world.budgets[kind] += dt * world.exposures[kind] * MAX_EXPOSURE_PARTICLES_PER_SECOND[kind];
    while (world.budgets[kind] >= 1) { world.budgets[kind] -= 1; emitExposure(world, kind); }
  }
  stepParticles(world, dt);
  automaticRepair(world, dt);
}

export function getDamageMetrics(world: DamageWorld): DamageMetrics {
  return {
    activeLesions: world.lesions.length,
    dimers: world.lesions.filter(item => item.kind === "dimer").length,
    singleBreaks: world.lesions.filter(item => item.kind === "ssb").length,
    doubleBreaks: world.lesions.filter(item => item.kind === "dsb").length,
    oxidizedBases: world.lesions.filter(item => item.kind === "oxidized").length,
    openPairs: world.dna.parent.nodes.filter(node => node.open > .15).length,
    repaired: world.totals.repaired, neutralized: world.totals.neutralized, blocked: world.totals.blocked, created: world.totals.created,
  };
}

export function takeDamageSnapshot(world: DamageWorld): DamageSnapshot {
  return {
    ...getDamageMetrics(world), species: world.species, sequence: world.dna.parent.bases.join(""),
    exposures: { ...world.exposures }, protectors: { ...world.protectors },
  };
}
