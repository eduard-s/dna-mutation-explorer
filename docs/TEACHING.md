# Teaching guide

## Damage and protection lab

Expose DNA to different conditions.
Add protection.
Examine which damage forms and which protection acts on it.

`DnaDamageLab` is the main component.
It shows exposure particles, DNA lesions, protection events, and a schematic atomic view.
The DNA letters stay the same when a lesion marker appears.
The lab has no rounds or score.

Before a comparison, set unrelated exposures to zero.
Change one factor or protector at a time.
Use pause and manual pulses for direct examples.
Use reset for a fresh sample.

| Control | Action |
| --- | --- |
| Grab | Drag the DNA to bend or stretch its illustrative geometry. |
| Expose | Apply the selected factor near the pointer. |
| Repair | Remove a nearby lesion marker. |
| Pulse | Apply or emit one action for the selected factor. |
| Pause | Stop motion and automatic exposure or repair steps. |
| Reset | Restore the initial sample and settings. |

Select a factor name to change the atomic explanation.
The sliders control continuous exposure or protection.
The Pulse button applies a separate direct action.
Paused exposure pulses act immediately.

Focus the DNA canvas to use its keyboard controls.
Press G, E, or R to select Grab, Expose, or Repair.
Use the arrow keys to select a base pair.
Press Space to apply the selected tool.
In Grab, Space holds or releases the DNA, and the arrow keys pull it.
Press Enter to pause or resume.
Press Escape to release the DNA.

| Factor | What to examine |
| --- | --- |
| UV | A dimer joins neighboring `C` or `T` bases on one strand. |
| X-rays | Ionization and reactive oxygen can produce backbone breaks. |
| Heat | More motion and open base pairs without automatic chemical lesions. |
| Electric field | Motion of the negatively charged backbone without automatic radiation lesions. |
| Oxidants | A reactive-oxygen particle can mark a `G` base as oxidized. |

## Match protection to the mechanism

| Protector | Model action |
| --- | --- |
| UV filter | Attenuate incoming UV particles. |
| X-ray shield | Attenuate incoming X-ray particles. |
| Antioxidants | Intercept reactive oxygen. |
| Repair | Remove existing lesion markers through the selected repair context. |
| Repair light | Reverse dimers through E. coli photolyase. |

Antioxidants do not stop direct UV photons or the direct X-ray path in this model.
They do not remove an existing lesion.
Filters prevent selected incoming events but do not repair earlier damage.
New exposure can cause more lesions after repair.

The manual repair brush represents external repair activity.
It also works on Bare DNA.
Bare DNA has no automatic cellular repair.

## Read the atomic view

The atomic view explains the selected factor or event.
UV illustrates electronic excitation and a same-strand dimer.
X-rays illustrate electron ejection and a direct or reactive-oxygen damage path.
Heat illustrates motion and loss of pairing.
The electric field illustrates a force on the charged backbone.

Electron clouds and paths are schematic.
They do not show literal orbits or a quantum calculation.
Read the event explanation with the lesion state.

## Compare species contexts

The species contexts keep the same DNA and existing lesions.
They change qualitative repair settings.
They do not calculate survival or rank biological resistance.

Bare DNA has no intrinsic cellular repair.
E. coli includes photolyase under repair light.
Human cells and D. radiodurans have no photolyase in this model.
D. radiodurans illustrates stronger break repair and the importance of protein protection.
Its DNA still takes damage.

## Use the damage component

Import the component and the stylesheet.

```tsx
import { DnaDamageLab } from "@esmirnov.ai/dna-mutation-explorer/react";
import "@esmirnov.ai/dna-mutation-explorer/styles.css";

export function DamageLesson() {
  return (
    <DnaDamageLab
      seed={42}
      onChange={(snapshot) => {
        console.log(snapshot.activeLesions, snapshot.repaired);
      }}
    />
  );
}
```

The controls use relative levels.
The model does not calculate calibrated doses, clinical risk, or survival.
Read the [model guide](MODEL.md) for mechanisms, sources, and limits.

## Copy-and-repair utility

Use `DnaPlayground` for this separate utility.

Drag the DNA to bend it.
Select Unzip to separate nearby pairs.
Make a copy.
Add an error.
Repair it, or copy again to see which branch keeps it.

The copy utility has no rounds, score, or target sequence.
The DNA moves continuously until pause.
The letters identify bases, and each visible rung is a base pair.
The source and copy stay visible together.

| Control | What it does |
| --- | --- |
| Grab | Move nearby DNA with the pointer. |
| Unzip | Separate nearby pairs briefly without a sequence change. |
| Mutate | Change a source pair or a permitted new-strand base. |
| Copy DNA | Make a copy with correct base pairs. |
| Copy with mistake | Make a copy with one wrong new base. |
| Repair copy | Correct visible mismatches on the new strand. |
| Next generation | Continue the branch that keeps the new upper strand. |
| Pause | Stop model motion. |
| Reset | Restore the initial model. |

## Repair before another copy

1. Press "Copy with mistake".
2. Let the copy finish.
3. Examine the mismatched pair.
4. Press "Repair copy".
5. Press "Next generation".

The repair uses the old partner to correct the new base.
The next tracked copy can keep the original sequence.

## Continue without repair

1. Reset the model.
2. Press "Copy with mistake".
3. Let the copy finish.
4. Press "Next generation" without repair.

The new upper strand becomes the next template.
Its new partner makes a matching pair.
The mismatch count returns to zero, while the sequence-change count can increase.
Repair cannot identify that stable change from a mismatch because the pair now matches.

The display selects one branch for this experiment.
Other descendants can have a different sequence.
The branch represents descendant body cells.
The model does not show parent-to-child inheritance.

## Read the model states

| State | Meaning |
| --- | --- |
| Old partner | The template that the new strand copies. |
| Mismatch | Two letters that do not form an `A`–`T` or `G`–`C` pair. |
| Sequence change | A current parent base that differs from the original ancestry baseline. |
| Generation | One successful continuation through the selected copy. |

A source edit changes both bases of a pair immediately.
A daughter edit changes only the new upper base.
The old daughter partner stays unchanged.
Later source edits do not change an existing copy.
The Mutate brush is a deliberate edit, not a physical damage model.

Pause and reduced motion stop the animated process.
Copy actions still complete immediately in those states.
The forces, motion, and time are illustrative.
Read the [model guide](MODEL.md) for sources and limits.

## Use the continuous component

Import the component and the stylesheet.

```tsx
import { DnaPlayground } from "@esmirnov.ai/dna-mutation-explorer/react";
import "@esmirnov.ai/dna-mutation-explorer/styles.css";

export function DnaLesson() {
  return (
    <DnaPlayground
      seed={42}
      onChange={(snapshot) => {
        console.log(snapshot.mismatches, snapshot.changes);
      }}
    />
  );
}
```

The sequence contains 6–64 known DNA bases.
The default synthetic sequence contains 24 bases.
The data stays in the browser.

## Keyboard controls

Focus the canvas with Tab.

| Key | Action |
| --- | --- |
| Left Arrow or Right Arrow | Select a base pair. |
| Up Arrow or Down Arrow | Select the source or visible copy. |
| Space | Apply Unzip or Mutate, or hold and release with Grab. |
| Arrow keys during a grab | Move the held point. |
| `G`, `U`, or `M` | Select Grab, Unzip, or Mutate. |
| Enter | Pause or resume motion. |
| Escape | Release the held point. |

## Advanced direct editor

A mutation is a change to a DNA sequence.
This playground shows how DNA letter changes affect codons and the translated amino-acid sequence.
It supports lessons about sequence consequences.
It does not predict health effects or protein function.

The direct editor in `MutationExplorer` appears before its guided challenges and forms.
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

## Eight advanced challenges

`MutationExplorer` includes eight guided challenges.
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

## Advanced sequence terms

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

## Use the advanced component

Import the component and its stylesheet.

```tsx
import { MutationExplorer } from "@esmirnov.ai/dna-mutation-explorer/react";
import "@esmirnov.ai/dna-mutation-explorer/styles.css";

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
import { analyzeCodingEdit } from "@esmirnov.ai/dna-mutation-explorer";
import { CHALLENGES, evaluateChallenge } from "@esmirnov.ai/dna-mutation-explorer/lessons";

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

## Advanced repair challenge

A repair challenge starts with a damaged synthetic reference.
The repair-frame challenge includes one extra `C` at base 7.
Its completion rule needs the exact original synthetic DNA.
Different DNA with the same translated protein does not complete this challenge.

The analysis labels describe changes relative to the damaged reference.
A repair can therefore have a `missense` or `frameshift` label.
This exercise uses an exact sequence edit.
It does not invoke the playground's mismatch-repair action.

Completion does not prove that the protein has a specific function.
It does not identify a treatment or a natural repair mechanism.
See the [model guide](MODEL.md) for the full scope.

## Ambiguous reference

The ambiguity challenge starts with `NNN` in the reference.
The core cannot assign a definite amino acid to that reference codon.
The edited sequence can have definite codons while the comparison consequence stays `uncertain`.
The challenge feedback examines the edited sequence separately.
