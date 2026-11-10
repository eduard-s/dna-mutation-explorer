# Integration

## React damage lab

Install the package and the React dependencies.

```sh
npm install dna-mutation-explorer react react-dom
```

Import the component and the stylesheet.

```tsx
import { DnaDamageLab } from "dna-mutation-explorer/react";
import "dna-mutation-explorer/styles.css";

export function SequenceLesson() {
  return <DnaDamageLab seed={42} />;
}
```

`DnaDamageLab` is the main component.
It uses E. coli as the default repair context.
UV, oxidants, and heat start at low relative levels.
The controls change exposure and protection independently.
The lab does not calculate calibrated doses or survival probabilities.

Supply initial settings for a specific lesson.

```tsx
<DnaDamageLab
  seed={42}
  initialSpecies="bare"
  initialExposures={{ uv: 0, oxidants: 0, heat: 0 }}
  initialProtectors={{ antioxidants: 0, repair: 0 }}
/>
```

The `initial*` props take effect only at mount.
A change to `sequence` or `seed` recreates the sample with those original settings.
Reset restores those settings and the current sequence and seed.
It keeps the pause state and selected mechanism.
Keep `sequence` stable when you collect snapshots.
That prop is a reset input, not a controlled live sequence.

Without an explicit seed, the component keeps one seed for the current mount.
Invalid input shows an error and disables the controls.
Reduced motion starts the lab paused.
Manual pulses and repair remain available while paused.
Hidden or offscreen canvases stop animation and release pointer input.
The display resumes when visible unless the user paused it.

## Damage callbacks

Use `onChange` to receive damage snapshots.

```tsx
import { DnaDamageLab } from "dna-mutation-explorer/react";
import type { DamageSnapshot } from "dna-mutation-explorer/playground";

function receiveDamage(snapshot: DamageSnapshot) {
  console.log(snapshot.activeLesions, snapshot.repaired, snapshot.neutralized);
}

<DnaDamageLab seed={42} onChange={receiveDamage} />;
```

A snapshot contains the current species, sequence, exposure levels, protector levels, and damage counters.
It does not include atom coordinates or a complete event history.
Lesion markers do not change the ordinary sequence letters.
The callback receives the initial state and changed serialized snapshots.
Animation samples occur about every 180 milliseconds.
Pointer samples occur about every 100 milliseconds.
Keep the callback fast.

## Damage-lab colors

Add a class to the component root.

```tsx
<DnaDamageLab className="custom-lab" />
```

Set the lab CSS properties on that class.

```css
.dnad-lab.custom-lab {
  --dnad-accent: #6f4b40;
  --dnad-sage: #6f897c;
}
```

| Property | Default | Role |
| --- | --- | --- |
| `--dnad-surface` | `#dfe5dc` | Main surface color. |
| `--dnad-paper` | `#eff2ed` | Light surface color. |
| `--dnad-ink` | `#303832` | Main text and strand color. |
| `--dnad-accent` | `#785448` | Focus and exposure color. |
| `--dnad-sage` | `#6f897c` | Protection color. |
| `--dnad-clay` | `#a67769` | Lesion color. |
| `--dnad-rule` | A 24% ink mix | Rule and control border color. |

The canvases are transparent.
The component reads the color properties for its canvas theme.

## Copy-and-repair utility

Use `DnaPlayground` for the separate DNA copy model.

```tsx
import { DnaPlayground } from "dna-mutation-explorer/react";
import "dna-mutation-explorer/styles.css";

<DnaPlayground seed={42} />;
```

The component starts with continuous motion and no copy.
The default synthetic sequence has 24 bases.
Use `sequence` for 6–64 known DNA bases.
Use `seed` for repeatable random choices.

A change to `sequence` or `seed` recreates the sample.
Reset restores the current props and keeps the pause state.
Without an explicit seed, the component keeps one seed for the current mount.
The `sequence` prop is a reset input, not a controlled live sequence.
Keep that prop stable when you collect snapshots.

Invalid sequence input shows an error and disables the controls.
Reduced motion starts the display paused.
Copy actions complete immediately while paused or reduced motion is active.
Hidden or offscreen canvases stop animation and release pointer input.
The display resumes when visible unless the user paused it.

## Copy snapshots

Use `onChange` to receive model readouts and sequence data.

```tsx
import { DnaPlayground } from "dna-mutation-explorer/react";
import type { DnaSnapshot } from "dna-mutation-explorer/playground";

function receiveSnapshot(snapshot: DnaSnapshot) {
  console.log(snapshot.sequence, snapshot.mismatches, snapshot.changes);
}

<DnaPlayground seed={42} onChange={receiveSnapshot} />;
```

The callback receives the initial state and changed serialized snapshots.
Animation updates occur about every 180 milliseconds.
Pointer samples occur about every 90 milliseconds.
Keep the callback fast.

`copySequence` contains the full planned daughter sequence before the animation completes.
Use `copied` for the number of visible positions.
Use `copyComplete` to identify a complete copy.
The snapshot does not contain node positions.

## Copy-utility colors

Add a class to the component root.

```tsx
<DnaPlayground className="custom-dna" />
```

Set the playground CSS properties on that class.

```css
.dnap-playground.custom-dna {
  --dnap-accent: #6f4b40;
  --dnap-sage: #6f897c;
}
```

| Property | Default | Role |
| --- | --- | --- |
| `--dnap-surface` | `#dfe5dc` | Main surface color. |
| `--dnap-paper` | `#eff2ed` | Light surface color. |
| `--dnap-ink` | `#303832` | Main text and strand color. |
| `--dnap-accent` | `#785448` | Focus and selection color. |
| `--dnap-sage` | `#6f897c` | New-strand color. |
| `--dnap-clay` | `#a67769` | Error and change color. |

The canvas is transparent.
The component reads those properties for its canvas theme.

## Optional advanced editor

Import `MutationExplorer` for exact sequence edits and protein translation.
Keep it in an optional section when the canvas is the main experience.

```tsx
import { useState } from "react";
import { DnaDamageLab, MutationExplorer } from "dna-mutation-explorer/react";
import "dna-mutation-explorer/styles.css";

export function DnaPage() {
  const [showExplorer, setShowExplorer] = useState(false);

  return (
    <>
      <DnaDamageLab />
      <details onToggle={(event) => setShowExplorer(event.currentTarget.open)}>
        <summary>Open the detailed sequence editor</summary>
        {showExplorer && <MutationExplorer />}
      </details>
    </>
  );
}
```

The advanced editor uses a synthetic coding sequence by default.
Supply `defaultSequence` and `defaultEdit` for a different initial example.
If a custom sequence has no edit props, the component starts with "No edit".
The built-in example also starts with no edit and highlights base 5.

The interface uses one-based base positions.
The API and callbacks use zero-based positions in the reference sequence.
The mouse tools apply one edit when a DNA coding-strand button receives a click, tap, Enter, or Space.
Use Tab and Enter or Space to operate the sequence controls with a keyboard.
The helix is a static diagram of the selected region.

Each mouse action replaces the previous trial against the same reference sequence.
The `onEditChange` callback receives the resulting edit.
The reference sequence does not change after a trial.
The `MutationExplorer` props stay the same in version 0.4.0.

The chain preview shows the first 24 protein symbols and the full amino-acid count.
The sequence comparison and export include the rest.

Open "Edit a custom sequence or exact positions" to use the manual sequence and edit controls.
Use those controls or the codon reference for multi-base tasks.
An input error opens the manual controls automatically.

## Advanced challenges

`MutationExplorer` shows eight guided challenges by default.
Each challenge has a goal, explanations, hints, and feedback.
The component keeps completion progress only in memory.
A reload or remount resets that progress.

Hide the challenges for an editor-only interface.

```tsx
<MutationExplorer showChallenges={false} />
```

Use `onChallengeComplete` to receive completed challenge IDs.
The callback fires once for each ID per mounted component.
The reset controls and presets keep the completed IDs until the component unmounts.
See the [teaching guide](TEACHING.md) to use the lessons API without React.

## Advanced colors

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

## Control the advanced editor

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
    deleteCount: 0,
    insert: "",
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

import { DnaDamageLab } from "dna-mutation-explorer/react";

export function DnaExplorer() {
  return <DnaDamageLab />;
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

`MutationExplorer` can export edited DNA and protein sequences as FASTA files.
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
