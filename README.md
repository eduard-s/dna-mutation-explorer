# DNA mutation explorer

Change DNA letters and see the effect on the protein sequence.
Compare the original and edited DNA, codons, and amino acids.
Use the TypeScript core without a browser.
Embed the React component in a scientific website or a lesson.

[Demo](https://esmirnov.ai/dna-mutation-explorer/) · [API](docs/API.md) · [Model](docs/MODEL.md) · [Teaching](docs/TEACHING.md) · [Integration](docs/INTEGRATION.md)

## Features

- Swap, cut, or add DNA letters with the mouse, touch, or keyboard.
- Compare the reference and edited DNA, RNA codons, and amino acids.
- Examine synonymous changes, missense changes, stop changes, and frameshifts.
- Read full amino-acid names for the selected codon.
- Learn the terms with explanations and tooltips.
- Solve eight guided challenges with hints and sequence-based feedback.
- Use the codon reference to choose a three-base replacement.
- Export the edited DNA and protein sequence.
- Keep the sequence data in the browser.

## Try the playground

1. Select "Swap a letter".
2. Click a letter in the DNA coding strand.
3. Compare the edited protein with the original protein.
4. Select another tool to cut or add a base.
5. Click a DNA letter to apply that tool.
6. Press "Reset mutation" to remove the edit.

Tap or press Enter or Space on a DNA letter to use the same tools.
Each action tries one edit against the unchanged original DNA.
A click at another position replaces the previous trial.
The edits do not accumulate.

The chain preview shows the first 24 symbols and the full amino-acid count.
The sequence comparison and export include the rest.

Open "Edit a custom sequence or exact positions" for a custom sequence or a precise edit.
The guided challenges and codon reference give more tasks and explanations.

## Install

Install the package and React for the visual component.

```sh
npm install dna-mutation-explorer react react-dom
```

For the core only, install the package without React.

```sh
npm install dna-mutation-explorer
```

## React component

Import the component and its stylesheet.

```tsx
import { MutationExplorer } from "dna-mutation-explorer/react";
import "dna-mutation-explorer/styles.css";

export default function Lesson() {
  return <MutationExplorer />;
}
```

For Next.js, put the component in a file with the `"use client"` directive.
See the [integration guide](docs/INTEGRATION.md) for controlled state and CSS properties.

## How to read the result

A mutation is a change to a DNA sequence.
The DNA letters represent bases.
This model groups three bases into each codon.
The RNA representation uses `U` in place of `T`.
Each complete codon selects an amino acid or a stop signal.
The protein output is the amino-acid sequence before the first known stop.

The protein string includes that stop as `*`.

A base change can leave the amino acid unchanged.
A one-base deletion can change the downstream codon groups.
The linked sequence views show these differences directly.
The explanations describe the selected codon and the edit result.

## Guided challenges

The component includes eight challenges with goals, hints, and completion feedback.
Each challenge uses a synthetic reference sequence.
The feedback comes from the current sequence analysis.
Progress stays in memory for the current component session.
A reload or remount resets the progress.

Use `showChallenges={false}` to hide the challenges in a custom application.
Use `dna-mutation-explorer/lessons` to add the same challenges to a different interface.
See the [teaching guide](docs/TEACHING.md) for the challenge API and model limits.

## TypeScript core

The core has no runtime dependencies.
The package root and `dna-mutation-explorer/core` export the same API.

```ts
import { analyzeCodingEdit } from "dna-mutation-explorer";

const result = analyzeCodingEdit("ATGGAACTGTAA", {
  start: 5,
  deleteCount: 1,
  insert: "G",
});

console.log(result.consequence);       // "synonymous"
console.log(result.reference.protein); // "MEL*"
console.log(result.edited.protein);    // "MEL*"
```

The edit changes `GAA` to `GAG`.
Both codons encode glutamate.
The `start` value is a zero-based position in the reference sequence.
The interface shows one-based positions.

## Model limits

Supply the coding strand in the 5-prime to 3-prime direction.
Translation starts at base zero with the standard genetic code.
The core does not search for a start codon or remove introns.
The results describe sequence changes, not protein function or disease risk.
Read the [model guide](docs/MODEL.md) before use with scientific data.

## Local development

Use Node.js 22.12 or later for the demo tools.
The published core supports Node.js 18 or later.

1. Install the development dependencies.

   ```sh
   npm install
   ```

2. Do the automated tests.

   ```sh
   npm test
   ```

3. Examine the TypeScript types.

   ```sh
   npm run typecheck
   ```

4. Examine the packed package in clean installations.

   ```sh
   npm run test:package
   ```

5. Start the demo.

   ```sh
   npm run dev
   ```

6. Open the local URL from the terminal.

Create the static demo files with this command.

```sh
npm run build:demo
```

The command writes the files to `demo-dist/`.

## License

The package uses the [MIT license](LICENSE).
