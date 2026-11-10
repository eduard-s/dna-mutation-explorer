# Integration

## React

Install the package and the React dependencies.

```sh
npm install dna-mutation-explorer react react-dom
```

Import the component and the stylesheet.

```tsx
import { MutationExplorer } from "dna-mutation-explorer/react";
import "dna-mutation-explorer/styles.css";

export function SequenceLesson() {
  return <MutationExplorer />;
}
```

The component uses a synthetic sequence by default.
Supply `defaultSequence` and `defaultEdit` for a different initial example.
If a custom sequence has no edit props, the component starts with "No edit".

The interface uses one-based base positions.
The API and callbacks use zero-based positions in the reference sequence.
Select a base, RNA codon, or amino acid to move the edit position.
Use Tab and Enter or Space to operate the sequence controls with a keyboard.
The helix is a static diagram of the selected region.

## Colors

Add a class to the component root.

```tsx
<MutationExplorer className="custom-explorer" />
```

Set the CSS properties on that class.

```css
.dme-explorer.custom-explorer {
  --dme-accent: #6f4b40;
  --dme-selected: #d0dccb;
}
```

| Property | Default | Role |
| --- | --- | --- |
| `--dme-surface` | `#dfe5dc` | Main surface color. |
| `--dme-paper` | `#eff2ed` | Input surface color. |
| `--dme-ink` | `#303832` | Main text color. |
| `--dme-muted` | `#5d695f` | Secondary text color. |
| `--dme-accent` | `#785448` | Accent and focus color. |
| `--dme-sage` | `#52745f` | Secondary sequence color. |
| `--dme-rule` | `#b8c3b5` | Rule and control border color. |
| `--dme-changed` | `#e7cbbd` | Changed-codon background. |
| `--dme-selected` | `#d0dccb` | Selected-codon background. |

The component root has a transparent background.
The stylesheet prefixes component classes with `dme-`.

## Controlled state

Pass `sequence` and `onSequenceChange` to control the reference sequence.
Pass `edit` and `onEditChange` to control the edit.
Update the parent state when the callbacks receive new values.

```tsx
import { useState } from "react";
import type { CodingEdit } from "dna-mutation-explorer";
import {
  MutationExplorer,
  SYNTHETIC_SEQUENCE,
} from "dna-mutation-explorer/react";
import "dna-mutation-explorer/styles.css";

export function ControlledLesson() {
  const [sequence, setSequence] = useState(SYNTHETIC_SEQUENCE);
  const [edit, setEdit] = useState<CodingEdit>({
    start: 4,
    deleteCount: 1,
    insert: "C",
  });

  return (
    <MutationExplorer
      sequence={sequence}
      edit={edit}
      onSequenceChange={setSequence}
      onEditChange={setEdit}
      onAnalysisChange={(analysis) => {
        if (analysis) console.log(analysis.consequence);
      }}
    />
  );
}
```

## Next.js

Put the component in a client component file.

```tsx
"use client";

import { MutationExplorer } from "dna-mutation-explorer/react";

export function DnaExplorer() {
  return <MutationExplorer />;
}
```

Import `dna-mutation-explorer/styles.css` in the route or root layout.
The package supports a static export.
It needs no API route or server process.

## Core without React

Install only the package.

```sh
npm install dna-mutation-explorer
```

Import the core API in a browser module, a Node.js script, or a worker.

```ts
import { analyzeCodingEdit } from "dna-mutation-explorer";

const result = analyzeCodingEdit("ATGGAACTGTAA", {
  start: 5,
  deleteCount: 1,
  insert: "G",
});

console.log(result.summary);
```

The core has no DOM calls and no runtime dependencies.
The React peer dependency is optional for core consumers.
The package uses ECMAScript modules.

## Sequence data and export

The package does not send sequence data to a server.
It does not fetch external sequences or store sequences in browser storage.
The host application controls its own network requests and callbacks.

The component can export edited DNA and protein sequences as FASTA files.
The protein FASTA file omits the terminal stop symbol.
The analysis JSON keeps that symbol in `Translation.protein`.
It can also export the analysis as JSON.
Examine the [model limits](MODEL.md) before reuse of the exported results.

## Package release

For a later release, increase the version in `package.json`.
Describe the changes in `CHANGELOG.md`.

1. Do the automated tests.

   ```sh
   npm test
   ```

2. Examine the TypeScript types.

   ```sh
   npm run typecheck
   ```

3. Examine the packed package in clean installations.

   ```sh
   npm run test:package
   ```

4. Create the static demo files.

   ```sh
   npm run build:demo
   ```

5. Examine the package file list.

   ```sh
   npm pack --dry-run
   ```

6. Authenticate with npm.

   ```sh
   npm login
   ```

7. Publish the package.

   ```sh
   npm publish --access public
   ```

The `prepack` script compiles the TypeScript files and copies the stylesheet.
The package includes compiled files, the license, the README, the changelog, and the documentation.
The package excludes demo output and development dependencies.
The package tests install the tarball without React and with React 18 and React 19.
They examine server-rendered output and package exports.
