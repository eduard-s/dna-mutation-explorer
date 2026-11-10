# DNA mutation explorer

Compare a coding DNA edit with its RNA codons and protein sequence.
Use the TypeScript core without a browser.
Embed the React component in a scientific website or a lesson.

[Demo](https://esmirnov.ai/dna-mutation-explorer/) · [API](docs/API.md) · [Model](docs/MODEL.md) · [Integration](docs/INTEGRATION.md)

## Features

- Apply one substitution, insertion, deletion, or replacement to a reference sequence.
- Compare the reference and edited DNA, RNA codons, and amino acids.
- Examine synonymous changes, missense changes, stop changes, and frameshifts.
- Select a base to move the edit and see its codon and amino acid.
- Export the edited DNA and protein sequence.
- Keep the sequence data in the browser.

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
  return (
    <MutationExplorer
      defaultSequence="ATGGAACTGTAA"
      defaultEdit={{ start: 5, deleteCount: 1, insert: "G" }}
    />
  );
}
```

For Next.js, put the component in a file with the `"use client"` directive.
See the [integration guide](docs/INTEGRATION.md) for controlled state and CSS properties.

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
