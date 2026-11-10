import { AMINO_ACID_NAMES, CODON_TABLE } from "./genetic-code.js";
import type { Codon, Translation } from "./types.js";

/** The limit bounds synchronous work in browser interfaces. */
export const MAX_SEQUENCE_LENGTH = 30_000;

/** Remove whitespace and convert IUPAC DNA bases to uppercase. */
export function normalizeDna(sequence: string): string {
  if (typeof sequence !== "string") {
    throw new TypeError("The DNA sequence must be a string.");
  }
  if (/(?:^|\n)\s*>/.test(sequence)) {
    throw new TypeError("FASTA headers are not supported. Use the DNA bases only.");
  }
  const compact = sequence.replace(/\s/g, "");
  const invalidIndex = compact.search(/[^ACGTRYSWKMBDHVNacgtryswkmbdhvn]/);
  if (invalidIndex !== -1) {
    const base = compact[invalidIndex];
    const hint = base === "U" || base === "u" ? " Use T for DNA, not U." : " Use IUPAC DNA bases only.";
    throw new TypeError(`Invalid DNA base ${JSON.stringify(base)} at index ${invalidIndex}.${hint}`);
  }
  if (compact.length > MAX_SEQUENCE_LENGTH) {
    throw new RangeError(`The DNA sequence must have ${MAX_SEQUENCE_LENGTH} bases or fewer.`);
  }
  return compact.toUpperCase();
}

/** The input is the coding strand in the 5′ to 3′ direction. */
export function transcribeDna(sequence: string): string {
  return normalizeDna(sequence).replace(/T/g, "U");
}

/** Translation starts at base 0. It does not search for a start codon. */
export function translateDna(sequence: string): Translation {
  const dna = normalizeDna(sequence);
  const rna = dna.replace(/T/g, "U");
  const codons: Codon[] = [];
  let protein = "";
  let stopIndex: number | null = null;
  const completeLength = dna.length - dna.length % 3;
  for (let start = 0; start < completeLength; start += 3) {
    const codonDna = dna.slice(start, start + 3);
    const aminoAcid = CODON_TABLE[codonDna] ?? "X";
    const index = start / 3;
    const afterStop = stopIndex !== null;
    const isStop = aminoAcid === "*";
    codons.push({
      index,
      start,
      dna: codonDna,
      rna: rna.slice(start, start + 3),
      aminoAcid,
      aminoAcidName: AMINO_ACID_NAMES[aminoAcid],
      isStop,
      afterStop,
    });
    if (!afterStop) {
      protein += aminoAcid;
      if (isStop) stopIndex = index;
    }
  }
  const trailingBases = dna.slice(completeLength);
  const warnings: string[] = [];
  if (dna.length === 0) {
    warnings.push("The sequence has no bases.");
  } else if (codons.length === 0) {
    warnings.push("The sequence has no complete codon.");
  }
  if (trailingBases.length > 0) {
    warnings.push(`The final ${trailingBases.length === 1 ? "base does" : "two bases do"} not form a complete codon.`);
  }
  if (/[^ACGT]/.test(dna)) {
    warnings.push("The sequence has ambiguous DNA bases. An ambiguous codon uses X.");
    if (codons.some(codon => codon.aminoAcid === "X" && !codon.afterStop)) {
      warnings.push("An ambiguous codon can contain a stop signal.");
    }
  }
  if (codons.length > 0 && stopIndex === null) {
    warnings.push("The sequence has no known stop codon. The protein can be incomplete.");
  }
  if (codons.length > 0 && codons[0]!.dna !== "ATG") {
    warnings.push("The first codon is not ATG. Translation still starts at base 0.");
  }
  if (stopIndex !== null && codons.length > stopIndex + 1) {
    warnings.push("Codons after the first stop do not appear in the protein.");
  }
  return { dna, rna, protein, codons, trailingBases, stopIndex, warnings };
}
