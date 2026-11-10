export {
  DEFAULT_DNA_SEQUENCE, complementBase, createDnaPlayground, resizeDnaPlayground,
  stepDnaPlayground, duplexGeometry, nearestDnaBase, beginDnaGrab, moveDnaPointer,
  releaseDnaGrab, unzipDnaAt, mutateDnaAt, startDnaCopy, completeDnaCopy,
  repairDnaCopy, advanceDnaGeneration, getDnaMetrics
} from "./engine.js";
export type {
  DnaBase, DnaBrush, DuplexKind, DnaNode, DnaDuplex, DnaPlayground,
  DnaGeometry, DnaMetrics, DnaSnapshot, DnaPlaygroundOptions
} from "./types.js";
export {
  SPECIES_PROFILES, DEFAULT_DAMAGE_EXPOSURES, DEFAULT_DNA_PROTECTORS,
  createDamageLab, resizeDamageLab, stepDamageLab, setDamageExposures,
  setDnaProtectors, setDamageSpecies, pulseDamage, repairDamageAt,
  getDamageMetrics, takeDamageSnapshot
} from "./damage.js";
export type {
  ExposureKind, DamageEffect, SpeciesId, LesionKind, DamageExposures,
  DnaProtectors, SpeciesProfile, DamageLesion, DamageParticle, DamageEvent,
  DamageMetrics, DamageSnapshot, DamageLabOptions, DamageWorld
} from "./damage-types.js";
