# Models

## DNA damage and protection

`DnaDamageLab` uses a short synthetic DNA sample with 6–64 known bases.
The default sample has 24 bases.
It stores damage as lesion markers.
These markers do not replace ordinary DNA letters.
The lab does not predict mutations from every lesion.

| Factor | Mechanism in the illustration |
| --- | --- |
| UV | Electronic excitation can join adjacent `C` or `T` bases on one strand as a dimer. |
| X-rays | Ionization ejects electrons. Direct hits or reactive products from water can cause strand breaks. |
| Heat | Thermal motion opens base pairing without automatic chemical lesions. |
| Electric field | The field moves the negatively charged backbone without automatic radiation damage. |
| Oxidants | Reactive oxygen creates an oxidative lesion marker on a `G` base. |

The UV channel illustrates same-strand pyrimidine dimers.
It does not join opposite partners across a base pair.
See the [ultrafast dimer experiment](https://pmc.ncbi.nlm.nih.gov/articles/PMC2792699/).

The X-ray channel has separate direct and reactive-oxygen paths.
The radicals represent simplified water chemistry.
See the [direct and indirect damage experiment](https://doi.org/10.1093/rpd/ncl408).
The oxidant channel uses guanine as its simplified target.
Other oxidative lesions are outside this model.

Heat changes motion and strand separation.
It does not change letters or create strand-break markers.
Real duplex stability depends on base pairing and base stacking.
See the [thermal-stability experiment](https://academic.oup.com/nar/article/34/2/564/2401647).

The electric field adds motion to the charged backbone.
The model keeps its canvas constraints and restoring forces.
The resulting shape is illustrative.
See the [single-molecule electrophoresis experiment](https://pubmed.ncbi.nlm.nih.gov/2911733/).

## Protection and repair

Antioxidants intercept reactive oxygen only in this model.
They do not block direct UV photons or the direct X-ray path.
They do not remove an existing lesion.
UV filters and X-ray shields act on separate incoming-radiation channels.
See the [radical-scavenger experiment](https://pmc.ncbi.nlm.nih.gov/articles/PMC11574138/).

Repair removes existing lesion markers.
New exposure can cause new damage after repair.
The repair brush represents an external repair action and also works on Bare DNA.
Automatic repair depends on the species context and repair control.
Repair light removes dimers only in the E. coli context with photolyase.

The repair model omits enzyme recognition, excision, resynthesis, ligation, and template requirements.
One removed marker is one model repair event.
It is not a measured biochemical repair yield.

## Species contexts

All contexts use the same current DNA sample and lesion chemistry.
A species change preserves the sequence and existing damage.
It changes only qualitative repair settings.
These settings do not rank survival or biological resistance.

| Context | Model meaning |
| --- | --- |
| Bare DNA | No intrinsic cellular repair. Manual repair represents added external activity. |
| E. coli | General repair and photolyase under repair light. |
| Human | General repair without photolyase. |
| D. radiodurans | A stronger illustrative break-repair setting without reduced initial damage or photolyase. |

E. coli photolyase can use light to reverse dimers.
See the [direct photolyase experiment](https://pmc.ncbi.nlm.nih.gov/articles/PMC1283438/).
Human cells lack functional photolyase in this model.
See the [photolyase phylogenomic study](https://pmc.ncbi.nlm.nih.gov/articles/PMC2668831/).

D. radiodurans illustrates strong repair and the importance of protein protection.
The lab does not simulate its full protein-protection chemistry.
Its DNA is not invulnerable, and its preset does not reduce initial DNA damage.
See the [protein-protection experiment](https://pmc.ncbi.nlm.nih.gov/articles/PMC1828145/).
Its context excludes photolyase, consistent with the [comparative genome analysis](https://pmc.ncbi.nlm.nih.gov/articles/PMC99018/).

## Lesion counts

A single-strand-break marker identifies a cut in one backbone.
Nearby opposite-strand breaks within one model bond become one double-strand-break marker.
The model counts active markers by lesion type.
It also keeps cumulative creation, repair, neutralization, and filter counters.

Double-strand breaks release local model constraints and permit fragment separation.
A single-strand break keeps those constraints because the other strand remains intact.
Repair restores the model connection on the next step.
This illustrative motion does not delete bases.

`created` counts marker creation, including conversion from a single-strand-break marker to a double-strand-break marker.
It is not a count of absorbed photons or independent physical breaks.
`repaired` counts removed markers.
`neutralized` counts intercepted reactive-oxygen particles.
`blocked` counts filtered UV or X-ray particles.

## Atomic view and limits

Electron excitation, ejection, clouds, and reaction paths are schematic.
They are not literal electron orbits or quantum calculations.
Motion, time, geometry, exposure levels, and protection levels use relative scales.
The interface shows the scheduled UV, X-ray, and oxidant emissions in simulated particles per second.
It shows other strengths on a 0–1 model scale, with direction for the electric field.
The lab does not calculate physical doses, reaction yields, survival, health risk, or clinical effects.

The lab omits spectral differences within UV, thermal chemical degradation, electrochemistry, and detailed radiation transport.
Lesion formation and repair use bounded illustrative rules.
The model does not describe a complete cell or its genome.

## Copy-and-repair utility

`DnaPlayground` uses 6–64 DNA bases from `A`, `C`, `G`, and `T`.
The default sequence is synthetic and has 24 bases.
The original upper-strand sequence remains the ancestry baseline.
The display follows one selected branch through repeated copies.

## Copy and repair

DNA normally copies before cell division.
Each new DNA molecule contains one old strand and one new strand.
See the [NHGRI replication explanation](https://www.genome.gov/genetics-glossary/DNA-Replication) and [NCBI replication mechanism](https://www.ncbi.nlm.nih.gov/books/NBK26850/).

The playground copy stores one old partner strand and synthesizes a new upper strand.
`A` pairs with `T`, and `G` pairs with `C`.
An accurate copy uses those pairs.
"Copy with mistake" deliberately introduces one wrong base in the new strand.
The source stays visible for comparison.

A wrong new base can form a mismatch with its old partner.
"Repair copy" restores the matching new base from that partner.
The repair does not change a correctly paired sequence merely because it differs from the original baseline.

An unrepaired mismatch can become a changed matching pair after another copy.
The next-generation action selects the new upper strand as the next template.
It synthesizes the complementary partner for that strand.
The mismatch then disappears, while the sequence change can remain.
See the [NCBI mismatch-repair explanation](https://pmc.ncbi.nlm.nih.gov/articles/PMC3683899/).

The original baseline does not change between generations.
The model keeps mismatch counts separate from sequence-change counts.
Later source edits do not change an existing copy.

## Deliberate edits

The Mutate brush changes a parent base and its partner together.
That action creates a paired sequence change directly.
On the daughter copy, the brush changes only the new upper strand.
That action can create or remove a mismatch.

These are user actions in a model.
The brush does not predict how mechanical forces damage DNA.

## Playground limits

The canvas uses illustrative motion, springs, spacing, and time.
It is not a chemical or molecular mechanics simulation.
The pointer represents actions that proteins normally do.
The model omits primers, detailed enzyme steps, strand-direction chemistry, and leading- and lagging-strand synthesis.

The error is deliberate.
Its frequency does not estimate a real replication error rate.
The simplified repair uses the known old partner.
It does not reproduce all repair pathways.

The display continues one selected DNA branch.
It does not show the complete replication of both strands or all descendant cells.
The branch represents descendant body cells.
Eggs, sperm, and parent-to-child inheritance are outside this model.
See the [NHGRI mutation explanation](https://www.genome.gov/genetics-glossary/Mutation).

The playground does not model gene expression, protein function, traits, disease, or clinical effects.
Copy actions complete immediately during pause or reduced motion.
That behavior does not advance the physical time or measure biological reaction time.

## Advanced sequence input

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
