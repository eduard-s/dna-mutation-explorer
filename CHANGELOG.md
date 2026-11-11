# Changelog

## 0.4.4

- Show simulated particle rates for UV, X-rays, and oxidants.
- Describe heat and protection levels and show electric field direction.
- Announce the displayed settings when a slider has keyboard focus.

## 0.4.1

- Move the npm package to `@esmirnov.ai/dna-mutation-explorer`.
- Update installation commands, import examples, and npm links.
- Add scoped package checks and a typed core consumer.
- Keep the component API, model behavior, and visual design.

## 0.4.0

- Add `DnaDamageLab` as the main damage-and-protection experience.
- Add UV, X-rays, heat, electric field, and oxidant exposure channels.
- Add UV dimers, strand breaks, and oxidative base lesions.
- Add separate antioxidants, UV filters, X-ray shields, repair, and repair light.
- Add schematic atomic explanations for excitation, ionization, and reactive oxygen.
- Add qualitative species contexts without calibrated survival comparisons.
- Preserve the sequence and existing damage when the species context changes.
- Keep the copy-and-repair utility and advanced sequence editor separate.
- Add `DnaPlayground` as a continuous canvas experience.
- Add Grab, Unzip, and Mutate brushes for flexible DNA strands.
- Add accurate copies and copies with one deliberate new-strand error.
- Add repair for new-strand mismatches.
- Keep mismatch counts separate from stable sequence changes.
- Add a selected next-generation branch with a preserved original baseline.
- Add a headless playground engine and snapshot callbacks.
- Complete copy actions immediately during pause or reduced motion.
- Keep `MutationExplorer` and the sequence-analysis API for advanced use.

## 0.3.0

- Add direct DNA tools for mouse, touch, and keyboard input.
- Add letter substitution, one-base deletion, whole-codon deletion, and one-base insertion.
- Add immediate views of the original and edited protein chains.
- Show full amino-acid names for the selected codon.
- Start the default example with no mutation.
- Keep each trial relative to the unchanged reference sequence.
- Put custom sequences and exact-position controls in a native disclosure.
- Keep guided challenges, hints, tooltips, and the codon reference.
- Keep the public props and the sequence-analysis core.

## 0.2.0

- Add eight guided challenges with goals, hints, and sequence-based feedback.
- Add explanations for DNA, RNA codons, amino acids, and sequence consequences.
- Add keyboard controls for term tooltips.
- Add explanations for the selected codon.
- Add a codon reference with three-base replacement controls.
- Add progress for the current component session.
- Add a lessons API for custom interfaces.
- Add `showChallenges` and `onChallengeComplete` props.
- Keep the sequence-analysis core and the existing component API.

## 0.1.0

- Add a TypeScript core for one edit to a coding DNA sequence.
- Add standard-code translation with explicit stops, incomplete codons, and ambiguous bases.
- Add sequence consequence labels and coordinate maps.
- Add a React component with linked DNA, codon, and amino-acid views.
- Add edit examples, sequence export, and a static browser demo.
- Add API, model, and integration guides.
