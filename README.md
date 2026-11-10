# DNA mutation explorer

Expose DNA to UV, X-rays, heat, an electric field, or oxidants.
Add protection.
Examine which damage forms and which protection acts on it.
Use the atomic view to examine schematic electron excitation, ionization, and reactive oxygen.

Use the TypeScript core without a browser.
Embed `DnaDamageLab` in a scientific website or a lesson.
Use `DnaPlayground` for the separate copy-and-repair utility.
Use `MutationExplorer` for the advanced sequence editor.

[Demo](https://esmirnov.ai/dna-mutation-explorer/) · [API](docs/API.md) · [Model](docs/MODEL.md) · [Teaching](docs/TEACHING.md) · [Integration](docs/INTEGRATION.md)

## Features

- Apply five independent exposure factors to flexible DNA.
- Compare UV dimers, strand breaks, and oxidized bases.
- Examine schematic atomic events for each factor.
- Add antioxidants, radiation filters, and repair activity as separate protectors.
- Compare qualitative repair contexts without a survival score.
- Keep the same sequence and existing damage when the species context changes.
- Use the copy-and-repair utility for mismatches and a selected descendant branch.
- Use the advanced editor for codons, protein sequences, exact edits, and export.
- Keep the sequence data in the browser.

## Try the lab

1. Select an exposure factor, such as "UV light".
2. Select Expose.
3. Drag across the DNA, or press "Pulse UV light".
4. Examine the affected site and its atomic explanation.
5. Change one protector.
6. Apply the exposure again.
7. Compare the lesion types and protection events.

Press Reset for a fresh sample.
Keep the exposure and elapsed time consistent for a comparison.
The controls use relative scales.

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
import { DnaDamageLab } from "dna-mutation-explorer/react";
import "dna-mutation-explorer/styles.css";

export default function Lesson() {
  return <DnaDamageLab />;
}
```

For Next.js, put the component in a file with the `"use client"` directive.
See the [integration guide](docs/INTEGRATION.md) for sequence options, snapshots, and the advanced component.

## What the lab shows

UV can join neighboring pyrimidine bases on one strand.
X-rays can ionize molecules and create reactive oxygen through water chemistry.
Heat increases motion and opens base pairs without automatic mutations.
The electric field moves the charged backbone without automatic radiation damage.
Oxidants can damage bases.

Antioxidants act on reactive oxygen.
They do not block direct UV damage or restore broken DNA.
UV filters and X-ray shields attenuate their respective exposure channels.
Repair activity acts on existing lesions.
Read the [model guide](docs/MODEL.md) for the biology and sources.

## Copy-and-repair utility

`DnaPlayground` remains available as a separate component.
It illustrates base pairing, copying errors, mismatch repair, and one selected descendant branch.
It uses its own headless engine through `dna-mutation-explorer/playground`.
See the [teaching guide](docs/TEACHING.md) for that utility.

## Advanced sequence editor

`MutationExplorer` compares exact coding-sequence edits, RNA codons, and amino acids.
It includes eight challenges with goals, hints, and completion feedback.
Each challenge uses a synthetic reference sequence.
The feedback comes from the current sequence analysis.
Progress stays in memory for the current component session.
A reload or remount resets the progress.

Use `showChallenges={false}` to hide the challenges in a custom application.
Use `dna-mutation-explorer/lessons` to add the same challenges to a different interface.
See the [teaching guide](docs/TEACHING.md) for the challenge API and model limits.

## Sequence-analysis core

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

The lab uses 6–64 known DNA bases.
The default synthetic sequence has 24 bases.
The motion, forces, spacing, and time are illustrative.
Electron paths and molecular events are schematic.
The controls do not represent calibrated doses, reaction rates, or survival probabilities.
The model does not predict traits, protein function, or disease risk.
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
