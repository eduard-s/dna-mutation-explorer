import test from "node:test";
import assert from "node:assert/strict";
import { analyzeCodingEdit, translateDna } from "../dist/core/index.js";
import { CHALLENGES, EXAMPLE_EDITS, SYNTHETIC_SEQUENCE, evaluateChallenge } from "../dist/lessons/index.js";

const edit = (start, deleteCount, insert) => ({ start, deleteCount, insert });
const challenge = id => {
  const result = CHALLENGES.find(item => item.id === id);
  assert.ok(result, id);
  return result;
};
const analyze = (id, input) => analyzeCodingEdit(challenge(id).sequence, input);
const grade = (id, input) => evaluateChallenge(id, analyze(id, input));
const replaceResult = (id, sequence) => grade(id, edit(0, challenge(id).sequence.length, sequence));
const proteinLetters = sequence => translateDna(sequence).protein.replace(/\*$/, "");
const solutions = {
  synonymous: edit(5, 1, "G"),
  missense: edit(4, 1, "C"),
  "early-stop": edit(14, 1, "A"),
  "delete-one": edit(6, 1, ""),
  "delete-three": edit(6, 3, ""),
  "repair-frame": edit(6, 1, ""),
  "restore-stop": edit(51, 1, "T"),
  "resolve-ambiguity": edit(6, 3, "GCT"),
};

test("eight ordered tasks have unique ids, useful text, and no initial edit", () => {
  assert.deepEqual(CHALLENGES.map(item => item.id), Object.keys(solutions));
  assert.equal(new Set(CHALLENGES.map(item => item.id)).size, 8);
  for (const item of CHALLENGES) {
    assert.ok(item.title.length > 0);
    assert.ok(item.goal.length > 0);
    assert.ok(item.explanation.length > 0);
    assert.equal(item.hints.length, 3);
    assert.ok(item.hints.every(hint => hint.length > 0));
    assert.deepEqual(item.initialEdit, edit(0, 0, ""));
    assert.ok(!item.targetProtein?.includes("*"));
    assert.ok(Object.isFrozen(item));
    assert.ok(Object.isFrozen(item.hints));
    assert.ok(Object.isFrozen(item.initialEdit));
  }
  assert.ok(Object.isFrozen(CHALLENGES));
});

test("the original examples retain their sequences, edits, and outcomes", () => {
  assert.equal(SYNTHETIC_SEQUENCE, "ATGGAATTTGCTTGGCAAGGTCCTAACGACTACAAAGAGGCTTTCGGTAAGTAA");
  assert.equal(translateDna(SYNTHETIC_SEQUENCE).protein, "MEFAWQGPNDYKEAFGK*");
  assert.deepEqual(EXAMPLE_EDITS.map(item => item.id), ["synonymous", "missense", "stop", "delete-one", "delete-three"]);
  assert.deepEqual(EXAMPLE_EDITS.map(item => analyzeCodingEdit(SYNTHETIC_SEQUENCE, item.edit).consequence), [
    "synonymous", "missense", "stop-gained", "frameshift", "in-frame-deletion",
  ]);
});

test("every initial task requires an action", () => {
  for (const item of CHALLENGES) {
    const result = grade(item.id, item.initialEdit);
    assert.equal(result.completed, false, item.id);
    assert.ok(result.feedback.startsWith("Start with an edit."), item.id);
    assert.ok(result.feedback.includes(item.goal), item.id);
    assert.equal(grade(item.id, edit(0, 3, item.sequence.slice(0, 3))).completed, false, item.id);
  }
});

test("all intended solutions complete their own task", () => {
  for (const [id, input] of Object.entries(solutions)) {
    const result = grade(id, input);
    assert.equal(result.completed, true, `${id}: ${result.feedback}`);
    assert.ok(result.feedback.length > 0);
  }
});

test("equivalent full-sequence replacement descriptions count", () => {
  for (const [id, input] of Object.entries(solutions)) {
    const result = analyze(id, input);
    assert.equal(replaceResult(id, result.edited.dna).completed, true, id);
  }
});

test("a full-codon replacement with one effective SNP completes the SNP task", () => {
  assert.equal(grade("synonymous", edit(3, 3, "GAG")).completed, true);
  assert.equal(grade("missense", edit(3, 3, "GCA")).completed, true);
  assert.equal(grade("early-stop", edit(12, 3, "TGA")).completed, true);
});

test("a mismatched reference never completes a task", () => {
  for (const [id, input] of Object.entries(solutions)) {
    const current = challenge(id);
    const wrongReference = "C" + current.sequence.slice(1);
    const result = evaluateChallenge(id, analyzeCodingEdit(wrongReference, input));
    assert.equal(result.completed, false, id);
    assert.ok(result.feedback.includes("challenge sample"), id);
  }
});

test("after-stop changes and appended bases do not complete tasks", () => {
  for (const item of CHALLENGES) {
    const reference = translateDna(item.sequence);
    const position = reference.stopIndex === null ? item.sequence.length : (reference.stopIndex + 1) * 3;
    for (const insert of ["A", "AAA", "TAA"]) {
      assert.equal(grade(item.id, edit(position, 0, insert)).completed, false, `${item.id}: ${insert}`);
    }
  }
});

test("the synonymous task needs one effective change before the stop", () => {
  assert.equal(grade("synonymous", edit(5, 1, "G")).completed, true);
  assert.equal(grade("synonymous", edit(3, 6, "GAGTTC")).completed, false);
  assert.equal(grade("synonymous", edit(51, 3, "TAG")).completed, false);
  assert.equal(grade("synonymous", edit(4, 1, "C")).completed, false);
  assert.equal(grade("synonymous", edit(5, 1, "N")).completed, false);
});

test("the missense task needs one altered codon and one amino-acid difference", () => {
  assert.equal(grade("missense", edit(3, 3, "TGG")).completed, true);
  assert.equal(grade("missense", edit(5, 1, "G")).completed, false);
  assert.equal(grade("missense", edit(3, 6, "GCATTA")).completed, false);
  assert.equal(grade("missense", edit(14, 1, "A")).completed, false);
  assert.equal(grade("missense", edit(3, 3, "GCN")).completed, false);
  assert.equal(grade("missense", edit(6, 0, "AAA")).completed, false);
});

test("the early-stop task needs a new earlier stop from one effective SNP", () => {
  const result = analyze("early-stop", solutions["early-stop"]);
  assert.equal(result.edited.stopIndex, 4);
  assert.equal(result.edited.protein, "MEFA*");
  assert.equal(grade("early-stop", edit(51, 3, "TAG")).completed, false);
  assert.equal(grade("early-stop", edit(51, 1, "C")).completed, false);
  assert.equal(grade("early-stop", edit(12, 0, "TAA")).completed, false);
  assert.equal(grade("early-stop", edit(12, 3, "TAA")).completed, false);
  assert.equal(grade("early-stop", edit(12, 3, "TGN")).completed, false);
});

test("the one-base deletion task rejects other edit outcomes", () => {
  assert.equal(grade("delete-one", edit(8, 1, "")).completed, true);
  assert.equal(grade("delete-one", edit(6, 3, "")).completed, false);
  assert.equal(grade("delete-one", edit(6, 1, "C")).completed, false);
  assert.equal(grade("delete-one", edit(6, 0, "A")).completed, false);
  assert.equal(grade("delete-one", edit(53, 1, "")).completed, false);
  assert.equal(grade("delete-one", edit(3, 3, "GG")).completed, false);
});

test("the three-base deletion task needs a whole-codon deletion with a retained stop", () => {
  const result = analyze("delete-three", solutions["delete-three"]);
  assert.equal(result.edited.protein, "MEAWQGPNDYKEAFGK*");
  assert.equal(result.frameshift, false);
  assert.equal(grade("delete-three", edit(15, 3, "")).completed, true);
  assert.equal(grade("delete-three", edit(6, 1, "")).completed, false);
  assert.equal(grade("delete-three", edit(4, 3, "")).completed, false);
  assert.equal(grade("delete-three", edit(51, 3, "")).completed, false);
  assert.equal(grade("delete-three", edit(6, 0, "AAA")).completed, false);
});

test("repair restores exact DNA and can retain a frameshift label", () => {
  const current = challenge("repair-frame");
  assert.equal(current.sequence, SYNTHETIC_SEQUENCE.slice(0, 6) + "C" + SYNTHETIC_SEQUENCE.slice(6));
  const result = analyze(current.id, solutions[current.id]);
  assert.equal(result.edited.dna, SYNTHETIC_SEQUENCE);
  assert.equal(result.frameshift, true);
  assert.equal(result.consequence, "frameshift");
  assert.equal(proteinLetters(result.edited.dna), current.targetProtein);
  assert.ok(grade(current.id, solutions[current.id]).feedback.includes("damaged reference"));
  const synonymousTarget = SYNTHETIC_SEQUENCE.slice(0, 5) + "G" + SYNTHETIC_SEQUENCE.slice(6);
  assert.equal(proteinLetters(synonymousTarget), current.targetProtein);
  assert.equal(replaceResult(current.id, synonymousTarget).completed, false);
  assert.equal(grade(current.id, edit(7, 1, "")).completed, false);
});

test("terminal-stop restoration accepts each standard stop and preserves its prefix", () => {
  const current = challenge("restore-stop");
  assert.equal(translateDna(current.sequence).stopIndex, null);
  for (const stop of ["TAA", "TAG", "TGA"]) {
    const result = analyze(current.id, edit(51, 3, stop));
    assert.equal(evaluateChallenge(current.id, result).completed, true, stop);
    assert.equal(result.edited.stopIndex, 17);
    assert.equal(proteinLetters(result.edited.dna), current.targetProtein);
  }
  assert.equal(grade(current.id, edit(51, 3, "")).completed, false);
  assert.equal(grade(current.id, edit(51, 3, "CAG")).completed, false);
  assert.equal(grade(current.id, edit(14, 1, "A")).completed, false);
  assert.equal(grade(current.id, edit(51, 3, "NNN")).completed, false);
  const changedPrefix = SYNTHETIC_SEQUENCE.slice(0, 5) + "G" + SYNTHETIC_SEQUENCE.slice(6);
  assert.equal(replaceResult(current.id, changedPrefix).completed, false);
});

test("ambiguity resolution uses the selected GCT codon and can stay uncertain", () => {
  const current = challenge("resolve-ambiguity");
  assert.equal(current.sequence.slice(6, 9), "NNN");
  assert.ok(translateDna(current.sequence).protein.includes("X"));
  const result = analyze(current.id, solutions[current.id]);
  assert.equal(result.consequence, "uncertain");
  assert.ok(!result.edited.protein.includes("X"));
  assert.equal(result.edited.codons[2].aminoAcid, "A");
  assert.equal(proteinLetters(result.edited.dna), current.targetProtein);
  assert.ok(grade(current.id, solutions[current.id]).feedback.includes("reference codon was NNN"));
  for (const codon of ["GCA", "AAA", "GCN", "TAA"]) {
    assert.equal(grade(current.id, edit(6, 3, codon)).completed, false, codon);
  }
  const changedPrefix = result.edited.dna.slice(0, 5) + "G" + result.edited.dna.slice(6);
  assert.equal(replaceResult(current.id, changedPrefix).completed, false);
});

test("an unknown challenge id returns useful feedback without a success", () => {
  const analysis = analyze("synonymous", solutions.synonymous);
  assert.deepEqual(evaluateChallenge("not-a-challenge", analysis), {
    completed: false,
    feedback: "This challenge is not available.",
  });
});

test("evaluation is deterministic and does not change its inputs", () => {
  for (const [id, input] of Object.entries(solutions)) {
    const analysis = analyze(id, input);
    const before = JSON.stringify(analysis);
    const first = evaluateChallenge(id, analysis);
    assert.deepEqual(evaluateChallenge(id, analysis), first);
    assert.equal(JSON.stringify(analysis), before);
  }
});
