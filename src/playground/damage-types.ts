import type { DnaPlayground } from "./types.js";

export type ExposureKind = "uv" | "xray" | "heat" | "oxidants" | "electric";
export type DamageEffect = ExposureKind | "antioxidants" | "repair";
export type SpeciesId = "bare" | "ecoli" | "human" | "deinococcus";
export type LesionKind = "dimer" | "ssb" | "dsb" | "oxidized";

export interface DamageExposures {
  uv: number; xray: number; heat: number; oxidants: number;
  /** Signed relative field. Positive field points right. DNA carries negative charge. */
  electric: number;
}
export interface DnaProtectors {
  antioxidants: number; uvFilter: number; xrayShield: number; repair: number; repairLight: number;
}
export interface SpeciesProfile {
  id: SpeciesId; name: string; description: string;
  repairFactor: number; breakRepairFactor: number; photolyase: boolean;
}
export interface DamageLesion {
  id: number; kind: LesionKind; index: number; strand: 0 | 1; createdAt: number;
}
export interface DamageParticle {
  id: number; kind: "uv" | "xray" | "radical" | "electron" | "scavenger";
  x: number; y: number; vx: number; vy: number; age: number; life: number;
  targetIndex?: number; strand?: 0 | 1; source?: ExposureKind; absorbed?: boolean;
}
export interface DamageEvent {
  effect: DamageEffect;
  outcome: LesionKind | "neutralized" | "shielded" | "repair" | "heat" | "field";
  time: number; index: number; strand: 0 | 1;
  externalRepair?: boolean;
}
export interface DamageMetrics {
  activeLesions: number; dimers: number; singleBreaks: number; doubleBreaks: number;
  oxidizedBases: number; openPairs: number; repaired: number; neutralized: number;
  blocked: number; created: number;
}
export interface DamageSnapshot extends DamageMetrics {
  species: SpeciesId; sequence: string; exposures: DamageExposures; protectors: DnaProtectors;
}
export interface DamageLabOptions {
  sequence?: string; seed?: number; species?: SpeciesId;
  exposures?: Partial<DamageExposures>; protectors?: Partial<DnaProtectors>;
}
export interface DamageWorld {
  dna: DnaPlayground;
  species: SpeciesId; exposures: DamageExposures; protectors: DnaProtectors;
  lesions: DamageLesion[]; particles: DamageParticle[];
  selectedEffect: DamageEffect; lastEvent: DamageEvent | null;
  seed: number; nextId: number;
  budgets: Record<ExposureKind, number>; repairBudget: number; photoRepairBudget: number;
  totals: { created: number; repaired: number; neutralized: number; blocked: number };
  message: string;
}
