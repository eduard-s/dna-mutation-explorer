import test from "node:test";
import assert from "node:assert/strict";
import {
  AMINO_ACID_NAMES,
  CODON_TABLE,
  MAX_SEQUENCE_LENGTH,
  analyzeCodingEdit,
  mapEditedToReference,
  mapReferenceToEdited,
  normalizeDna,
  transcribeDna,
  translateDna,
} from "../dist/core/index.js";

const REFERENCE = "ATGGAACTGTAA";
const edit = (start, deleteCount, insert) => ({ start, deleteCount, insert });

test("the frozen standard code covers all 64 codons", () => {
  const bases = "TCAG";
  const expected = "FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG";
  let index = 0;
  for (const a of bases) for (const b of bases) for (const c of bases) {
    const codon = a + b + c;
    const aminoAcid = expected[index++];
    assert.equal(CODON_TABLE[codon], aminoAcid, codon);
    const result = translateDna(codon);
    assert.equal(result.protein, aminoAcid, codon);
    assert.equal(result.codons[0].aminoAcidName, AMINO_ACID_NAMES[aminoAcid]);
  }
  assert.equal(Object.keys(CODON_TABLE).length, 64);
  assert.equal(Object.keys(AMINO_ACID_NAMES).length, 22);
  assert.ok(Object.isFrozen(CODON_TABLE));
  assert.ok(Object.isFrozen(AMINO_ACID_NAMES));
  assert.throws(() => { CODON_TABLE.ATG = "A"; }, TypeError);
});

test("DNA normalization accepts IUPAC bases, case, and whitespace", () => {
  assert.equal(normalizeDna(" acgt rysw\nkmbd\thvn\r "), "ACGTRYSWKMBDHVN");
  assert.equal(normalizeDna(""), "");
  assert.equal(normalizeDna(" \n\t "), "");
  assert.equal(transcribeDna("atg tty"), "AUGUUY");
  assert.equal(transcribeDna("TAC"), "UAC");
});

test("invalid input has an explicit error", () => {
  assert.throws(() => normalizeDna(null), TypeError);
  assert.throws(() => normalizeDna("AUG"), /Use T for DNA, not U/);
  assert.throws(() => normalizeDna("AT-G"), /index 2/);
  assert.throws(() => normalizeDna("ATG2"), /IUPAC/);
  assert.throws(() => normalizeDna("ATGſ"), /Invalid DNA base/);
  assert.throws(() => normalizeDna(">sequence\nATG"), /FASTA headers/);
  assert.throws(() => normalizeDna("ATG\n  >other\nAAA"), /FASTA headers/);
});

test("the sequence limit applies after whitespace removal", () => {
  assert.equal(MAX_SEQUENCE_LENGTH, 30_000);
  assert.equal(normalizeDna("A ".repeat(MAX_SEQUENCE_LENGTH)).length, MAX_SEQUENCE_LENGTH);
  assert.throws(() => normalizeDna("A".repeat(MAX_SEQUENCE_LENGTH + 1)), RangeError);
  assert.throws(() => analyzeCodingEdit("A".repeat(MAX_SEQUENCE_LENGTH), edit(0, 0, "A")), /edited DNA/);
  const result = translateDna("A".repeat(MAX_SEQUENCE_LENGTH));
  assert.equal(result.codons.length, 10_000);
  assert.equal(result.protein.length, 10_000);
});

test("translation starts at base zero and keeps codons after the first stop", () => {
  const result = translateDna("GCCATGTAATGGGG");
  assert.equal(result.dna, "GCCATGTAATGGGG");
  assert.equal(result.rna, "GCCAUGUAAUGGGG");
  assert.equal(result.protein, "AM*");
  assert.equal(result.stopIndex, 2);
  assert.equal(result.trailingBases, "GG");
  assert.deepEqual(result.codons.map(c => [c.index, c.start, c.dna, c.rna, c.aminoAcid, c.isStop, c.afterStop]), [
    [0, 0, "GCC", "GCC", "A", false, false],
    [1, 3, "ATG", "AUG", "M", false, false],
    [2, 6, "TAA", "UAA", "*", true, false],
    [3, 9, "TGG", "UGG", "W", false, true],
  ]);
  assert.ok(result.warnings.some(w => w.includes("first codon is not ATG")));
  assert.ok(result.warnings.some(w => w.includes("two bases")));
});

test("the first stop can occur at codon zero", () => {
  const result = translateDna("TAATAGTGA");
  assert.equal(result.stopIndex, 0);
  assert.equal(result.protein, "*");
  assert.deepEqual(result.codons.map(c => [c.isStop, c.afterStop]), [[true, false], [true, true], [true, true]]);
});

test("every ambiguous codon uses X, including deterministic IUPAC expansions", () => {
  const result = translateDna("ATGGCNNNNTAA");
  assert.equal(result.protein, "MXX*");
  assert.equal(result.codons[1].aminoAcidName, "Unknown amino acid");
  assert.ok(result.warnings.some(w => w.includes("ambiguous")));
  assert.ok(result.warnings.some(w => w.includes("stop signal")));
  assert.equal(translateDna("TAANNN").protein, "*");
  assert.equal(translateDna("TAANNN").codons[1].aminoAcid, "X");
});

test("empty input and partial codons stay explicit", () => {
  assert.deepEqual(translateDna("").codons, []);
  assert.equal(translateDna("").protein, "");
  assert.equal(translateDna("").stopIndex, null);
  for (const sequence of ["A", "AT"]) {
    const result = translateDna(sequence);
    assert.equal(result.trailingBases, sequence);
    assert.equal(result.protein, "");
    assert.ok(result.warnings.some(w => w.includes("no complete codon")));
  }
  assert.equal(translateDna("ATGA").trailingBases, "A");
});

test("a no-op uses the normalized DNA and edit without input changes", () => {
  const input = edit(3, 3, " gaa \n");
  const result = analyzeCodingEdit("atg gaa ctg taa", input);
  assert.equal(result.consequence, "no-change");
  assert.deepEqual(result.effects, ["no-change"]);
  assert.equal(result.frameshift, false);
  assert.deepEqual(result.edit, edit(3, 3, "GAA"));
  assert.deepEqual(input, edit(3, 3, " gaa \n"));
  assert.equal(analyzeCodingEdit("NNN", edit(0, 0, "")).consequence, "no-change");
});

test("substitutions distinguish synonymous, missense, and stop effects", () => {
  const synonymous = analyzeCodingEdit(REFERENCE, edit(5, 1, "G"));
  assert.equal(synonymous.consequence, "synonymous");
  assert.equal(synonymous.edited.protein, "MEL*");
  const missense = analyzeCodingEdit(REFERENCE, edit(4, 1, "C"));
  assert.equal(missense.consequence, "missense");
  assert.equal(missense.edited.protein, "MAL*");
  assert.equal(missense.affectedCodon, 1);
  const gained = analyzeCodingEdit(REFERENCE, edit(3, 1, "T"));
  assert.equal(gained.consequence, "stop-gained");
  assert.equal(gained.edited.protein, "M*");
  const lost = analyzeCodingEdit(REFERENCE, edit(9, 1, "C"));
  assert.equal(lost.consequence, "stop-lost");
  assert.equal(lost.edited.protein, "MELQ");
  assert.equal(lost.edited.stopIndex, null);
});

test("base zero is an editable coordinate", () => {
  const result = analyzeCodingEdit(REFERENCE, edit(0, 1, "C"));
  assert.equal(result.edited.dna, "CTGGAACTGTAA");
  assert.equal(result.edited.protein, "LEL*");
  assert.equal(result.consequence, "missense");
  assert.equal(result.affectedCodon, 0);
});

test("in-frame insertions and deletions do not lose a shifted stop", () => {
  const inserted = analyzeCodingEdit(REFERENCE, edit(3, 0, "AAA"));
  assert.equal(inserted.consequence, "in-frame-insertion");
  assert.equal(inserted.edited.protein, "MKEL*");
  assert.deepEqual(inserted.effects, ["in-frame-insertion"]);
  assert.equal(inserted.lengthDelta, 3);
  const removed = analyzeCodingEdit(REFERENCE, edit(3, 3, ""));
  assert.equal(removed.consequence, "in-frame-deletion");
  assert.equal(removed.edited.protein, "ML*");
  assert.deepEqual(removed.effects, ["in-frame-deletion"]);
  assert.equal(removed.lengthDelta, -3);
  assert.equal(removed.frameshift, false);
});

test("an in-frame insertion can cross a codon boundary", () => {
  const result = analyzeCodingEdit(REFERENCE, edit(4, 0, "AAA"));
  assert.equal(result.edited.protein, "MEKL*");
  assert.equal(result.consequence, "in-frame-insertion");
  assert.equal(result.affectedCodon, 1);
  assert.equal(result.frameshift, false);
});

test("a replacement can have an in-frame delins effect", () => {
  const result = analyzeCodingEdit(REFERENCE, edit(3, 2, "CC"));
  assert.equal(result.edited.protein, "MPL*");
  assert.equal(result.consequence, "in-frame-delins");
  assert.equal(result.lengthDelta, 0);
});

test("a frameshift has priority and can also remove the reference stop", () => {
  for (const input of [edit(4, 0, "C"), edit(4, 1, "")]) {
    const result = analyzeCodingEdit(REFERENCE, input);
    assert.equal(result.consequence, "frameshift");
    assert.equal(result.frameshift, true);
    assert.ok(result.effects.includes("stop-lost"));
    assert.ok(result.edited.trailingBases.length > 0);
  }
});

test("a frame change can keep the observed amino acid sequence equal", () => {
  const inserted = analyzeCodingEdit("ATGAAA", edit(4, 0, "A"));
  assert.equal(inserted.reference.protein, "MK");
  assert.equal(inserted.edited.protein, "MK");
  assert.equal(inserted.consequence, "frameshift");
  assert.equal(inserted.frameshift, true);
  assert.equal(inserted.edited.trailingBases, "A");
  assert.ok(!inserted.summary.includes("protein changes"));
  const removed = analyzeCodingEdit("ATGAAAA", edit(4, 1, ""));
  assert.equal(removed.reference.protein, removed.edited.protein);
  assert.equal(removed.consequence, "frameshift");
  assert.equal(removed.frameshift, true);
});

test("an inserted stop reports both the stop and in-frame insertion", () => {
  const result = analyzeCodingEdit(REFERENCE, edit(3, 0, "TAA"));
  assert.equal(result.consequence, "stop-gained");
  assert.deepEqual(result.effects, ["stop-gained", "in-frame-insertion"]);
  assert.equal(result.edited.protein, "M*");
});

test("edits after the first stop do not imply a translated frameshift", () => {
  const reference = "ATGTAAGAA";
  for (const input of [edit(6, 0, "A"), edit(7, 1, ""), edit(6, 1, "C")]) {
    const result = analyzeCodingEdit(reference, input);
    assert.equal(result.consequence, "untranslated");
    assert.deepEqual(result.effects, ["untranslated"]);
    assert.equal(result.frameshift, false);
    assert.equal(result.reference.protein, result.edited.protein);
  }
  assert.equal(analyzeCodingEdit("ATGTAA", edit(6, 0, "AAA")).consequence, "untranslated");
});

test("a retained stop preserves the translated protein", () => {
  const result = analyzeCodingEdit("ATGTAA", edit(5, 1, "G"));
  assert.equal(result.edited.protein, "M*");
  assert.equal(result.consequence, "synonymous");
  assert.equal(result.frameshift, false);
});

test("partial-tail edits do not imply a translated frameshift", () => {
  const untranslated = analyzeCodingEdit("ATGA", edit(4, 0, "A"));
  assert.equal(untranslated.consequence, "untranslated");
  assert.equal(untranslated.frameshift, false);
  const completed = analyzeCodingEdit("ATGA", edit(4, 0, "AA"));
  assert.equal(completed.edited.protein, "MK");
  assert.equal(completed.consequence, "uncertain");
  assert.equal(completed.frameshift, false);
});

test("ambiguity cannot produce a definite synonymous or missense call", () => {
  const result = analyzeCodingEdit("ATGGCNTAA", edit(5, 1, "T"));
  assert.equal(result.reference.protein, "MX*");
  assert.equal(result.edited.protein, "MA*");
  assert.equal(result.consequence, "uncertain");
  assert.equal(analyzeCodingEdit("ATGGCNTAA", edit(4, 1, "A")).consequence, "uncertain");
  assert.equal(analyzeCodingEdit("NNNGAATAA", edit(4, 1, "C")).consequence, "uncertain");
  assert.equal(analyzeCodingEdit("ATGGAANNNTAA", edit(4, 1, "C")).consequence, "missense");
});

test("deletion of the complete sequence and insertion into an empty sequence are valid", () => {
  const removed = analyzeCodingEdit("ATGAAA", edit(0, 6, ""));
  assert.equal(removed.edited.dna, "");
  assert.equal(removed.edited.protein, "");
  assert.equal(removed.consequence, "in-frame-deletion");
  const inserted = analyzeCodingEdit("", edit(0, 0, "ATG"));
  assert.equal(inserted.edited.protein, "M");
  assert.equal(inserted.consequence, "in-frame-insertion");
});

test("edit bounds allow append but reject silent truncation and coercion", () => {
  assert.equal(analyzeCodingEdit("ATG", edit(3, 0, "AAA")).edited.dna, "ATGAAA");
  assert.throws(() => analyzeCodingEdit("ATG", edit(4, 0, "A")), /reference length/);
  assert.throws(() => analyzeCodingEdit("ATG", edit(3, 1, "")), /extends past/);
  for (const value of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, "0"]) {
    assert.throws(() => analyzeCodingEdit("ATG", edit(value, 0, "")), RangeError);
    assert.throws(() => analyzeCodingEdit("ATG", edit(0, value, "")), RangeError);
  }
  assert.throws(() => analyzeCodingEdit("ATG", null), TypeError);
  assert.throws(() => analyzeCodingEdit("ATG", edit(0, 0, undefined)), TypeError);
});

test("coordinate maps return null only inside the inserted or deleted span", () => {
  const input = edit(3, 2, "AAA");
  assert.deepEqual(Array.from({ length: 9 }, (_, position) => mapEditedToReference(position, input)), [0, 1, 2, null, null, null, 5, 6, 7]);
  assert.deepEqual(Array.from({ length: 8 }, (_, position) => mapReferenceToEdited(position, input)), [0, 1, 2, null, null, 6, 7, 8]);
  assert.equal(mapEditedToReference(5, edit(3, 0, "aa")), 3);
  assert.equal(mapReferenceToEdited(3, edit(3, 0, "aa")), 5);
  assert.equal(mapEditedToReference(3, edit(3, 2, "")), 5);
  assert.equal(mapReferenceToEdited(5, edit(3, 2, "")), 3);
  assert.equal(mapEditedToReference(3, edit(3, 0, "")), 3);
});

test("coordinate maps reject invalid and unsafe coordinates", () => {
  for (const map of [mapEditedToReference, mapReferenceToEdited]) {
    assert.throws(() => map(-1, edit(0, 0, "")), RangeError);
    assert.throws(() => map(0.5, edit(0, 0, "")), RangeError);
  }
  assert.throws(() => mapReferenceToEdited(Number.MAX_SAFE_INTEGER, edit(0, 0, "A")), RangeError);
  assert.throws(() => mapEditedToReference(Number.MAX_SAFE_INTEGER, edit(0, 1, "")), RangeError);
});

test("analysis output obeys sequence, translation, and effect invariants", () => {
  let state = 42;
  const random = limit => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state % limit;
  };
  const bases = "ACGTN";
  const sequence = length => Array.from({ length }, () => bases[random(bases.length)]).join("");
  for (let iteration = 0; iteration < 500; iteration++) {
    const reference = sequence(random(31));
    const start = random(reference.length + 1);
    const input = edit(start, random(reference.length - start + 1), sequence(random(8)));
    const result = analyzeCodingEdit(reference, input);
    assert.equal(result.edited.dna, reference.slice(0, start) + input.insert + reference.slice(start + input.deleteCount));
    assert.equal(result.lengthDelta, input.insert.length - input.deleteCount);
    assert.equal(result.affectedCodon, Math.floor(start / 3));
    assert.equal(result.effects[0], result.consequence);
    assert.equal(result.effects.length, new Set(result.effects).size);
    assert.equal(result.frameshift, result.effects.includes("frameshift"));
    for (const translation of [result.reference, result.edited]) {
      assert.equal(translation.codons.map(c => c.dna).join("") + translation.trailingBases, translation.dna);
      assert.equal(translation.codons.filter(c => !c.afterStop).map(c => c.aminoAcid).join(""), translation.protein);
      assert.equal(translation.stopIndex, translation.codons.find(c => c.isStop)?.index ?? null);
      assert.ok(translation.trailingBases.length < 3);
    }
    assert.deepEqual(result, analyzeCodingEdit(reference, input));
  }
});
