# Teaching guide

## Mouse playground

A mutation is a change to a DNA sequence.
This playground shows how DNA letter changes affect codons and the translated amino-acid sequence.
It supports lessons about sequence consequences.
It does not predict health effects or protein function.

The mouse playground appears before the guided challenges and forms.
The built-in example starts with no edit at highlighted base 5.
The original DNA stays unchanged during each trial.
The original and edited protein chains show the current result.

| Tool | Action on the coding strand |
| --- | --- |
| "Swap a letter" | Cycle the clicked base through `A`, `C`, `G`, and `T`. |
| "Cut one base" | Remove the clicked reference base. |
| "Cut one codon" | Remove the complete three-base codon that contains the clicked base. |
| "Add a base" | Insert the selected palette base before the clicked reference base. |

1. Select a tool.
2. Click a letter on the DNA coding strand.
3. Compare the edited protein chain with the original chain.
4. Read the focused-codon result for the full amino-acid names.

Repeated clicks with "Swap a letter" cycle the letter at the same position.
For "Add a base", select `A`, `C`, `G`, or `T` in the palette.
Use the "Append" control on the final DNA page to append a base.
Press "Reset mutation" to remove the current edit.

A click at another position replaces the previous trial.
Each action makes one edit relative to the unchanged reference DNA.
The edits do not accumulate.
Tap, Enter, and Space apply the same tool as a mouse click.
No tool needs a drag action.

The chain preview shows the first 24 symbols, including a stop symbol when present.
The full amino-acid count stays visible.
The sequence comparison and export include the rest.
Clay marks a different symbol at the same position.
This comparison does not align protein sequences.

Open "Edit a custom sequence or exact positions" for manual controls.
Use those controls or the codon reference for multi-base replacements.
The original sequence remains the reference for those edits.
An input error opens the manual controls automatically.

## Guided challenges

The React component includes eight guided challenges.
Each challenge supplies a sequence, an initial edit, a goal, an explanation, and hints.
The component compares the current result with the challenge rules.
The feedback describes the sequence result.

| ID | Task |
| --- | --- |
| `synonymous` | Change one DNA base before the stop and keep the translated sequence. |
| `missense` | Change one codon and exactly one amino acid. |
| `early-stop` | Change one base to add a stop before the terminal stop. |
| `delete-one` | Delete one base before the stop and change the downstream codon groups. |
| `delete-three` | Delete one complete codon and keep the other amino acids in frame. |
| `repair-frame` | Remove the extra `C` at base 7 and restore the original synthetic DNA. |
| `restore-stop` | Replace the final `CAA` with a stop and keep all earlier DNA bases. |
| `resolve-ambiguity` | Replace `NNN` at bases 7–9 with `GCT`. |

The component keeps completed challenges in memory for the current session.
A reload or remount removes that progress.
The package does not use browser storage or send progress to a server.
The completion count is a count of completed challenges, not a score for biological skill.

The component loads a challenge only after "Start challenge".
The challenge does not replace a custom sequence automatically.
A preset, a global reset, or a change to the custom reference exits the active challenge.
These actions keep completed challenge IDs.
A task reset also keeps completed challenge IDs.

## Terms in the interface

| Term | Meaning in this model |
| --- | --- |
| Reference sequence | DNA before the current edit. |
| Edited sequence | DNA after the current edit. |
| Codon | Three bases in the selected reading frame. |
| RNA codon | A codon with `U` in place of DNA `T`. |
| Amino acid | One unit in the translated sequence, shown with a one-letter symbol. |
| Stop | A signal that ends the translated sequence. |
| Synonymous change | A DNA change that keeps the translated amino-acid sequence. |
| Frameshift | A reading-frame change when the net length change is not a multiple of three. |
| Ambiguous base | An IUPAC symbol that can represent more than one DNA base. |

## Use the component

Import the component and its stylesheet.

```tsx
import { MutationExplorer } from "dna-mutation-explorer/react";
import "dna-mutation-explorer/styles.css";

export function DnaLesson() {
  return (
    <MutationExplorer
      onChallengeComplete={(id) => {
        console.log("Completed challenge:", id);
      }}
    />
  );
}
```

The challenges appear by default.
Set `showChallenges={false}` to hide them.
The sequence comparison and edit controls remain available.

`onChallengeComplete` fires once for each completed challenge ID in a mounted component.
Task resets and presets do not make the same ID fire again.
With controlled props, update the parent state through the sequence and edit callbacks.

The component starts evaluation after the host accepts the task reference and the initial unchanged result.
A host that rejects those values cannot complete that task.
The feedback explains that the host must accept the task values.

## Explanations and tooltips

The component explains the edit result and the selected codon.
Term buttons show more explanations near their labels.

Press a term button to show or hide its tooltip.
Use Enter or Space when the term button has keyboard focus.
Press Escape or click outside the tooltip to hide it.

## Codon reference

Select a complete reference codon.
Choose an amino acid in the codon reference.
Apply one of its DNA codons.

The component replaces three bases at the selected reference codon.
The codon reference uses the standard genetic code.
It does not predict protein function.

## Use a custom interface

Import the challenge data and evaluation function from the lessons entry.

```ts
import { analyzeCodingEdit } from "dna-mutation-explorer";
import { CHALLENGES, evaluateChallenge } from "dna-mutation-explorer/lessons";

const challenge = CHALLENGES[0];
const analysis = analyzeCodingEdit(challenge.sequence, {
  start: 5,
  deleteCount: 1,
  insert: "G",
});
const result = evaluateChallenge(challenge.id, analysis);

console.log(challenge.goal);
console.log(result.completed); // true
console.log(result.feedback);
```

The lessons entry has no React dependency.
Use `initialEdit` for the initial controls in a custom interface.
Use the challenge sequence as the reference for its analysis.
Pass the result from `analyzeCodingEdit` to `evaluateChallenge`.
The evaluation function does not store progress.
The host application controls progress in a custom interface.

The evaluator compares the actual reference and edited sequences.
Different edit descriptions can produce the same accepted result.
The reference must match the challenge sample.
Completion needs a changed edited sequence with known DNA bases.

An unknown challenge ID gives `completed: false` and feedback text.
An analysis with a different reference also gives `completed: false`.
The optional `targetProtein` field gives context for selected tasks.
Each challenge has its own completion rule.

## Repair challenges

A repair challenge starts with a damaged synthetic reference.
The repair-frame challenge includes one extra `C` at base 7.
Its completion rule needs the exact original synthetic DNA.
Different DNA with the same translated protein does not complete this challenge.

The analysis labels describe changes relative to the damaged reference.
A repair can therefore have a `missense` or `frameshift` label.

Completion does not prove that the protein has a specific function.
It does not identify a treatment or a natural repair mechanism.
See the [model guide](MODEL.md) for the full scope.

## Ambiguous reference

The ambiguity challenge starts with `NNN` in the reference.
The core cannot assign a definite amino acid to that reference codon.
The edited sequence can have definite codons while the comparison consequence stays `uncertain`.
The challenge feedback examines the edited sequence separately.
