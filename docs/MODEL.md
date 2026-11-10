# Sequence model

## Input

The input is one coding DNA sequence in the 5-prime to 3-prime direction.
The first base is the first base of the first codon.
The core does not search for an open reading frame or a start codon.

The core converts lowercase letters to uppercase letters and removes whitespace.
The core accepts the DNA IUPAC alphabet: `ACGTRYSWKMBDHVN`.
RNA letters, FASTA headers, gaps, and other characters cause an error.
An empty sequence is valid, for example after a full deletion.
The normalized reference and edited sequences cannot exceed 30,000 bases.

## Translation

The core uses the [NCBI standard genetic code, table 1](https://www.ncbi.nlm.nih.gov/Taxonomy/Utils/wprintgc.cgi#SG1).
Each complete codon has three bases.
The RNA representation replaces `T` with `U`.

The `protein` string includes the first known stop as `*`.
The string ends at that stop.
The `codons` array also includes complete codons after that stop.
Those codons have `afterStop: true`.
Their amino-acid labels describe the code, not a translated protein product.

A codon with an ambiguous base gives `X`.
For example, `GCN` gives `X`, although all four `GCN` codons encode alanine.
The core uses this conservative rule for all ambiguous codons.
It does not resolve alternative sequences.

One or two terminal bases remain in `trailingBases`.
The core does not translate those bases.
Warnings describe incomplete codons and ambiguous bases.

## Edit coordinates

An edit has `start`, `deleteCount`, and `insert` fields.
The `start` field is a zero-based position in the normalized reference sequence.
The `deleteCount` field gives the number of reference bases to remove.
The `insert` field supplies the replacement bases.

For an insertion, set `deleteCount` to zero.
Position zero inserts before the first base.
Position `reference.length` inserts after the last base.
For a deletion, use an empty `insert` string.
Each edit refers to the reference sequence, not a previous edited sequence.

## Consequences

A synonymous change keeps the amino-acid sequence in this model.
It does not imply that the edit has no biological effect.
A missense change substitutes an amino acid.
A stop change adds or removes a known translation stop.

An insertion or deletion can change the reading frame when the net length change is not a multiple of three.
See the [NHGRI frameshift explanation](https://www.genome.gov/genetics-glossary/Frameshift-Mutation).
An in-frame edit preserves the downstream reading frame.
An in-frame edit can still change codons at the edit boundaries.

The result separates a primary `consequence` from the `effects` list.
The `summary` explains the result in text.
Warnings identify limits that affect interpretation.

Relevant ambiguity or partial-reference completion can make the primary consequence `uncertain`.
A definite coding frame change takes priority over stop and in-frame labels.
`stop-gained` takes priority over `stop-lost`.
A stop label takes priority over an in-frame edit label.
The `effects` list keeps other detected labels.

## Scope

The core compares the supplied sequences with a fixed genetic code.
It does not model transcription rates, RNA decay, translation rates, protein structure, or protein function.
It does not map genomic coordinates to transcripts or model splicing.
It does not predict disease risk or clinical significance.
It does not produce HGVS variant descriptions.

The demo sequence is synthetic.
It does not represent a measured biological sample.
The helix is a sequence diagram, not a molecular mechanics simulation.

## Challenge results

The challenges use synthetic sequences and the same standard-code analysis as the explorer.
Their completion rules examine sequence changes, amino-acid output, stops, or the reading frame.
Completion records success with a synthetic sequence only.

A repair challenge can start with a damaged synthetic reference.
The explorer still compares the edit with that reference.
A successful repair can therefore show a sequence-change label relative to the damaged reference.
The repair-frame challenge needs the exact original synthetic DNA.
Its completion does not prove that protein function is restored.

The ambiguity challenge starts with an ambiguous reference codon.
It can finish with definite edited codons while the comparison consequence stays `uncertain`.
That label describes uncertainty in the reference comparison.
It does not mean that the edited codon is still ambiguous.
