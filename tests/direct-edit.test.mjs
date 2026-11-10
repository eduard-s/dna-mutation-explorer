import assert from "node:assert/strict";
import test from "node:test";
import { analyzeCodingEdit, MAX_SEQUENCE_LENGTH } from "../dist/core/index.js";
import { directEdit } from "../dist/react/direct-edit.js";

const sequence = "ATGGAACTGTAA";
const noEdit = { start: 4, deleteCount: 0, insert: "" };

test("the highlighted first click changes glutamate to alanine", () => {
  const edit = directEdit(sequence, noEdit, "swap", 4);
  const analysis = analyzeCodingEdit(sequence, edit);
  assert.equal(analysis.reference.codons[1].dna, "GAA");
  assert.equal(analysis.edited.codons[1].dna, "GCA");
  assert.equal(analysis.edited.codons[1].aminoAcidName, "Alanine");
  assert.equal(analysis.consequence, "missense");
});

test("repeated clicks cycle letters and can restore the original base", () => {
  let edit = noEdit;
  const values = [];
  for (let index = 0; index < 4; index++) {
    edit = directEdit(sequence, edit, "swap", 4);
    values.push(edit.insert);
  }
  assert.deepEqual(values, ["C", "G", "T", "A"]);
  assert.equal(analyzeCodingEdit(sequence, edit).consequence, "no-change");
});

test("a new trial uses the unchanged reference instead of silently accumulating edits", () => {
  const first = directEdit(sequence, noEdit, "swap", 4);
  const second = directEdit(sequence, first, "swap", 5);
  const analysis = analyzeCodingEdit(sequence, second);
  assert.equal(analysis.edited.dna, "ATGGACCTGTAA");
  assert.equal(analysis.edited.dna[4], sequence[4]);
  assert.deepEqual(noEdit, { start: 4, deleteCount: 0, insert: "" });
});

test("a one-base cut shifts the frame while a complete-codon cut preserves it", () => {
  const one = analyzeCodingEdit(sequence, directEdit(sequence, noEdit, "cut-base", 4));
  const three = analyzeCodingEdit(sequence, directEdit(sequence, noEdit, "cut-codon", 5));
  assert(one.frameshift);
  assert.deepEqual(three.edit, { start: 3, deleteCount: 3, insert: "" });
  assert(!three.frameshift);
  assert.equal(three.edited.protein, "ML*");
});

test("insertion uses the chosen base and allows the terminal append position", () => {
  assert.equal(analyzeCodingEdit(sequence, directEdit(sequence, noEdit, "insert", 3, "T")).edited.dna, "ATGTGAACTGTAA");
  assert.equal(analyzeCodingEdit(sequence, directEdit(sequence, noEdit, "insert", sequence.length, "C")).edited.dna, sequence + "C");
});

test("direct tools reject invalid coordinates, incomplete cuts, and an oversized insertion", () => {
  for (const position of [-1, .5, sequence.length + 1, NaN]) assert.equal(directEdit(sequence, noEdit, "swap", position), null);
  assert.equal(directEdit(sequence, noEdit, "swap", sequence.length), null);
  assert.equal(directEdit("ATGA", noEdit, "cut-codon", 3), null);
  assert.equal(directEdit("A".repeat(MAX_SEQUENCE_LENGTH), noEdit, "insert", 0), null);
  assert.equal(directEdit("", noEdit, "insert", 0, "G").insert, "G");
});

test("a swap can resolve an ambiguous reference base", () => {
  assert.equal(directEdit("ATGNNNTAA", noEdit, "swap", 3).insert, "A");
});
