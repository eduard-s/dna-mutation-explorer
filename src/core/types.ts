/** All positions use zero-based DNA coordinates. */
export interface CodingEdit {
  start: number;
  deleteCount: number;
  insert: string;
}

export type AminoAcid =
  | "A" | "R" | "N" | "D" | "C" | "Q" | "E" | "G" | "H" | "I"
  | "L" | "K" | "M" | "F" | "P" | "S" | "T" | "W" | "Y" | "V"
  | "*" | "X";

export interface Codon {
  index: number;
  start: number;
  dna: string;
  rna: string;
  aminoAcid: AminoAcid;
  aminoAcidName: string;
  isStop: boolean;
  afterStop: boolean;
}

export interface Translation {
  dna: string;
  rna: string;
  /** The protein includes the first stop symbol. */
  protein: string;
  codons: Codon[];
  trailingBases: string;
  /** The first known stop has a zero-based codon index. */
  stopIndex: number | null;
  warnings: string[];
}

export type Consequence =
  | "no-change"
  | "synonymous"
  | "missense"
  | "stop-gained"
  | "stop-lost"
  | "frameshift"
  | "in-frame-insertion"
  | "in-frame-deletion"
  | "in-frame-delins"
  | "untranslated"
  | "uncertain";

export interface CodingAnalysis {
  reference: Translation;
  edited: Translation;
  edit: CodingEdit;
  consequence: Consequence;
  effects: Consequence[];
  summary: string;
  affectedCodon: number;
  lengthDelta: number;
  frameshift: boolean;
  warnings: string[];
}
