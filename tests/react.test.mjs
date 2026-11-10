import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MutationExplorer } from "../dist/react/index.js";

const render = (props = {}) => renderToStaticMarkup(createElement(MutationExplorer, props));

test("a custom short sequence does not inherit an out-of-range example edit", () => {
  for (const props of [{ sequence: "ATG" }, { defaultSequence: "ATG" }, { defaultSequence: "" }]) {
    const html = render(props);
    assert(!html.includes('class="dme-error"'));
    assert(html.includes("Reference sequence"));
    assert(html.includes("No change"));
    assert(!html.includes("The insertion starts before"));
    assert(!html.includes("The deletion joins"));
  }
});

test("an invalid explicit edit gives an input error without a server-render failure", () => {
  const html = render({ sequence: "ATG", edit: { start: 5, deleteCount: 1, insert: "A" } });
  assert(html.includes('role="alert"'));
  assert(html.includes("The edit start must not exceed"));
  assert(html.includes("No result"));
});

test("an in-frame insertion highlights the new residue and preserves mapped residues", () => {
  const html = render({ sequence: "ATGGAACTGTAA", edit: { start: 3, deleteCount: 0, insert: "AAA" } });
  assert.equal((html.match(/dme-amino-changed/g) ?? []).length, 1);
  assert(html.includes("In-frame insertion"));
  assert(html.includes("Lysine"));
});

test("stop loss highlights residues that become translated", () => {
  const html = render({ sequence: "ATGTAAGAA", edit: { start: 3, deleteCount: 1, insert: "C" } });
  assert.equal((html.match(/dme-amino-changed/g) ?? []).length, 2);
  assert(html.includes("Stop lost"));
});

test("ambiguous and partial codons remain explicit in the component", () => {
  const html = render({ sequence: "ATGNNNA", edit: { start: 0, deleteCount: 0, insert: "" } });
  assert(html.includes("Unknown amino acid"));
  assert(html.includes("do not form a complete codon") || html.includes("does not form a complete codon"));
});

test("long input renders a bounded sequence window", () => {
  const html = render({ sequence: "ATG".repeat(10_000), edit: { start: 0, deleteCount: 0, insert: "" } });
  assert(html.length - 30_000 < 50_000);
  assert((html.match(/<button/g) ?? []).length < 120);
  assert(html.includes("10000"));
});

test("the teaching interface starts without completed challenges", () => {
  const html = render();
  assert(html.includes('aria-label="Guided challenges"'));
  assert(html.includes("Start challenge"));
  assert(html.includes('value="0" max="8"'));
  assert(html.includes("Explain coding DNA"));
});

test("a scientific embed can hide the challenge interface", () => {
  const html = render({ showChallenges: false });
  assert(!html.includes('aria-label="Guided challenges"'));
  assert(!html.includes("Start challenge"));
  assert(!html.includes("or start a challenge"));
  assert(html.includes("Reference coding DNA"));
  assert(html.includes("Amino-acid change"));
});
