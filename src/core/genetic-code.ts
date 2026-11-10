import type { AminoAcid } from "./types.js";

/** This table uses the standard genetic code. */
export const CODON_TABLE: Readonly<Record<string, AminoAcid>> = Object.freeze({
  TTT: "F", TTC: "F", TTA: "L", TTG: "L",
  TCT: "S", TCC: "S", TCA: "S", TCG: "S",
  TAT: "Y", TAC: "Y", TAA: "*", TAG: "*",
  TGT: "C", TGC: "C", TGA: "*", TGG: "W",
  CTT: "L", CTC: "L", CTA: "L", CTG: "L",
  CCT: "P", CCC: "P", CCA: "P", CCG: "P",
  CAT: "H", CAC: "H", CAA: "Q", CAG: "Q",
  CGT: "R", CGC: "R", CGA: "R", CGG: "R",
  ATT: "I", ATC: "I", ATA: "I", ATG: "M",
  ACT: "T", ACC: "T", ACA: "T", ACG: "T",
  AAT: "N", AAC: "N", AAA: "K", AAG: "K",
  AGT: "S", AGC: "S", AGA: "R", AGG: "R",
  GTT: "V", GTC: "V", GTA: "V", GTG: "V",
  GCT: "A", GCC: "A", GCA: "A", GCG: "A",
  GAT: "D", GAC: "D", GAA: "E", GAG: "E",
  GGT: "G", GGC: "G", GGA: "G", GGG: "G",
});

export const AMINO_ACID_NAMES: Readonly<Record<AminoAcid, string>> = Object.freeze({
  A: "Alanine", R: "Arginine", N: "Asparagine", D: "Aspartic acid",
  C: "Cysteine", Q: "Glutamine", E: "Glutamic acid", G: "Glycine",
  H: "Histidine", I: "Isoleucine", L: "Leucine", K: "Lysine",
  M: "Methionine", F: "Phenylalanine", P: "Proline", S: "Serine",
  T: "Threonine", W: "Tryptophan", Y: "Tyrosine", V: "Valine",
  "*": "Stop", X: "Unknown amino acid",
});
