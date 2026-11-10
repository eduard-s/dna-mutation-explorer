import { MAX_SEQUENCE_LENGTH, normalizeDna, translateDna } from "./sequence.js";
import type { CodingAnalysis, CodingEdit, Consequence, Translation } from "./types.js";

function normalizeEdit(edit: CodingEdit): CodingEdit {
  if (edit === null || typeof edit !== "object") {
    throw new TypeError("The edit must be an object with start, deleteCount, and insert.");
  }
  if (!Number.isSafeInteger(edit.start) || edit.start < 0) {
    throw new RangeError("The edit start must be a nonnegative safe integer.");
  }
  if (!Number.isSafeInteger(edit.deleteCount) || edit.deleteCount < 0) {
    throw new RangeError("The edit deleteCount must be a nonnegative safe integer.");
  }
  return { start: edit.start, deleteCount: edit.deleteCount, insert: normalizeDna(edit.insert) };
}

function examinePosition(position: number): void {
  if (!Number.isSafeInteger(position) || position < 0) {
    throw new RangeError("The position must be a nonnegative safe integer.");
  }
}

/** Inserted bases have no reference position. End coordinates map to end coordinates. */
export function mapEditedToReference(position: number, edit: CodingEdit): number | null {
  examinePosition(position);
  const normalized = normalizeEdit(edit);
  if (position < normalized.start) return position;
  if (position - normalized.start < normalized.insert.length) return null;
  const mapped = position - normalized.insert.length + normalized.deleteCount;
  examinePosition(mapped);
  return mapped;
}

/** Deleted bases have no edited position. End coordinates map to end coordinates. */
export function mapReferenceToEdited(position: number, edit: CodingEdit): number | null {
  examinePosition(position);
  const normalized = normalizeEdit(edit);
  if (position < normalized.start) return position;
  if (position - normalized.start < normalized.deleteCount) return null;
  const mapped = position - normalized.deleteCount + normalized.insert.length;
  examinePosition(mapped);
  return mapped;
}

function codingLimit(translation: Translation): number {
  return translation.stopIndex === null ? translation.codons.length * 3 : (translation.stopIndex + 1) * 3;
}

function firstProteinDifference(reference: string, edited: string): number {
  const length = Math.min(reference.length, edited.length);
  for (let index = 0; index < length; index++) {
    if (reference[index] !== edited[index]) return index;
  }
  return length;
}

function ambiguousPrefix(translation: Translation, codonIndex: number): boolean {
  return translation.codons.some(codon => !codon.afterStop && codon.index <= codonIndex && codon.aminoAcid === "X");
}

function stopEffects(reference: Translation, edited: Translation, edit: CodingEdit, lengthDelta: number): Consequence[] {
  const effects: Consequence[] = [];
  if (reference.stopIndex === null) {
    if (edited.stopIndex !== null && !ambiguousPrefix(edited, edited.stopIndex) && !ambiguousPrefix(reference, reference.codons.length)) {
      effects.push("stop-gained");
    }
    return effects;
  }
  const referenceStopStart = reference.stopIndex * 3;
  const expectedStopStart = referenceStopStart + (edit.start <= referenceStopStart ? lengthDelta : 0);
  const expectedStop = expectedStopStart >= 0 && expectedStopStart % 3 === 0
    ? edited.codons[expectedStopStart / 3]
    : undefined;
  const knownReferenceStop = !ambiguousPrefix(reference, reference.stopIndex);
  const knownEditedStop = edited.stopIndex !== null && !ambiguousPrefix(edited, edited.stopIndex);
  if (knownEditedStop && (edited.stopIndex! * 3 < expectedStopStart) && knownReferenceStop) {
    effects.push("stop-gained");
  }
  if (knownReferenceStop && !expectedStop?.isStop &&
      !ambiguousPrefix(edited, Math.max(0, Math.floor(expectedStopStart / 3)))) {
    effects.push("stop-lost");
  }
  return effects;
}

const SUMMARIES: Record<Consequence, string> = {
  "no-change": "The edit does not change the DNA sequence.",
  synonymous: "The DNA changes. The translated protein stays the same.",
  missense: "The edit changes an amino acid in the translated protein.",
  "stop-gained": "The edit adds a stop signal to the translated sequence.",
  "stop-lost": "The edit removes the reference stop signal from the translated sequence.",
  frameshift: "The edit changes the reading frame within the translated region.",
  "in-frame-insertion": "The edit adds DNA without a reading-frame change. The translated protein changes.",
  "in-frame-deletion": "The edit removes DNA without a reading-frame change. The translated protein changes.",
  "in-frame-delins": "The edit replaces DNA without a reading-frame change. The translated protein changes.",
  untranslated: "The DNA changes outside the complete codons in the translated protein. The translated protein stays the same.",
  uncertain: "Ambiguous bases or a partial codon prevent a definite protein consequence.",
};

/** This analysis describes sequence consequences. It does not predict health effects or protein function. */
export function analyzeCodingEdit(sequence: string, inputEdit: CodingEdit): CodingAnalysis {
  const reference = translateDna(sequence);
  const edit = normalizeEdit(inputEdit);
  if (edit.start > reference.dna.length) {
    throw new RangeError(`The edit start must not exceed the reference length of ${reference.dna.length}.`);
  }
  if (edit.deleteCount > reference.dna.length - edit.start) {
    throw new RangeError("The edit deleteCount extends past the reference sequence.");
  }
  const lengthDelta = edit.insert.length - edit.deleteCount;
  if (reference.dna.length + lengthDelta > MAX_SEQUENCE_LENGTH) {
    throw new RangeError(`The edited DNA sequence must have ${MAX_SEQUENCE_LENGTH} bases or fewer.`);
  }
  const edited = translateDna(reference.dna.slice(0, edit.start) + edit.insert + reference.dna.slice(edit.start + edit.deleteCount));
  const affectedCodon = Math.floor(edit.start / 3);
  const proteinChanged = reference.protein !== edited.protein;
  const touchesCoding = edit.start < codingLimit(reference) || edit.start < codingLimit(edited);
  const firstDifference = proteinChanged
    ? firstProteinDifference(reference.protein, edited.protein)
    : affectedCodon;
  const ambiguity = ambiguousPrefix(reference, firstDifference) || ambiguousPrefix(edited, firstDifference);
  const partialReference = proteinChanged && reference.trailingBases.length > 0 && edit.start >= reference.codons.length * 3;
  let consequence: Consequence;
  let effects: Consequence[];
  let frameshift = lengthDelta % 3 !== 0 && edit.start < codingLimit(reference);
  if (reference.dna === edited.dna) {
    frameshift = false;
    consequence = "no-change";
    effects = [consequence];
  } else if (!proteinChanged && !frameshift) {
    consequence = !touchesCoding ? "untranslated" : ambiguity ? "uncertain" : "synonymous";
    effects = [consequence];
  } else {
    const stops = proteinChanged ? stopEffects(reference, edited, edit, lengthDelta) : [];
    const inFrameIndel: Consequence | null = lengthDelta % 3 === 0 && (edit.deleteCount > 0 || edit.insert.length > 0) &&
      (edit.deleteCount !== edit.insert.length || edit.deleteCount > 1)
      ? edit.deleteCount === 0 ? "in-frame-insertion" : edit.insert.length === 0 ? "in-frame-deletion" : "in-frame-delins"
      : null;
    consequence = ambiguity || partialReference ? "uncertain"
      : frameshift ? "frameshift"
      : stops.includes("stop-gained") ? "stop-gained"
      : stops.includes("stop-lost") ? "stop-lost"
      : inFrameIndel ?? "missense";
    effects = [consequence];
    if (frameshift && consequence !== "frameshift") effects.push("frameshift");
    for (const stop of stops) if (!effects.includes(stop)) effects.push(stop);
    if (inFrameIndel !== null && !effects.includes(inFrameIndel)) effects.push(inFrameIndel);
  }
  const warnings = [...new Set([
    ...reference.warnings.map(warning => `Reference: ${warning}`),
    ...edited.warnings.map(warning => `Edited: ${warning}`),
    "This analysis describes sequence consequences. It does not predict health effects, protein function, or protein structure.",
  ])];
  return { reference, edited, edit, consequence, effects, summary: SUMMARIES[consequence], affectedCodon, lengthDelta, frameshift, warnings };
}
