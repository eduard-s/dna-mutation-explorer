export { AMINO_ACID_NAMES, CODON_TABLE } from "./genetic-code.js";
export { MAX_SEQUENCE_LENGTH, normalizeDna, transcribeDna, translateDna } from "./sequence.js";
export { analyzeCodingEdit, mapEditedToReference, mapReferenceToEdited } from "./edits.js";
export type { AminoAcid, CodingAnalysis, CodingEdit, Codon, Consequence, Translation } from "./types.js";
