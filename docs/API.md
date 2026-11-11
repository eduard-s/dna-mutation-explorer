# API

## Exports

Import the core from `@esmirnov.ai/dna-mutation-explorer` or `@esmirnov.ai/dna-mutation-explorer/core`.
Import the React components from `@esmirnov.ai/dna-mutation-explorer/react`.
Import the headless playground engine from `@esmirnov.ai/dna-mutation-explorer/playground`.
Import the challenge data from `@esmirnov.ai/dna-mutation-explorer/lessons`.
Import the component stylesheet from `@esmirnov.ai/dna-mutation-explorer/styles.css`.

The core has no React dependency.
All core functions are synchronous.
The core also exports the `AminoAcid`, `CodingEdit`, `Codon`, `Translation`, `Consequence`, and `CodingAnalysis` types.

## React damage lab

The React entry exports `DnaDamageLab` and the `DnaDamageLabProps` type.
The component shows the damage-and-protection lab.

```ts
interface DnaDamageLabProps {
  sequence?: string;
  seed?: number;
  initialSpecies?: SpeciesId;
  initialExposures?: Partial<DamageExposures>;
  initialProtectors?: Partial<DnaProtectors>;
  className?: string;
  style?: CSSProperties;
  onChange?: (snapshot: DamageSnapshot) => void;
}
```

All props are optional.
The sequence uses 6–64 known DNA bases.
`seed` controls repeatable random choices.
The three `initial*` props supply settings at mount.
Later changes to those props do not update the active lab.
A change to `sequence` or `seed` recreates the sample with the original initial settings.
Reset uses those same settings and the current sequence and seed.
Reset keeps the pause state and selected mechanism.

`onChange` receives damage readouts, the sequence, exposures, protectors, and species context.
The snapshot does not contain atom coordinates or a complete event history.
The callback receives the initial state and changed serialized snapshots.
Animation samples occur about every 180 milliseconds, and pointer samples occur about every 100 milliseconds.

## Damage engine

Import the damage functions and types from `@esmirnov.ai/dna-mutation-explorer/playground`.
The engine changes a mutable `DamageWorld` and needs no React.

```ts
import {
  createDamageLab,
  pulseDamage,
  takeDamageSnapshot,
} from "@esmirnov.ai/dna-mutation-explorer/playground";

const world = createDamageLab(800, 420, {
  seed: 42,
  species: "bare",
  exposures: { uv: 0, oxidants: 0 },
});

world.dna.paused = true;
pulseDamage(world, "uv");
console.log(takeDamageSnapshot(world).dimers);
```

`DamageLabOptions` accepts `sequence`, `seed`, `species`, partial `exposures`, and partial `protectors`.
The default species is `"ecoli"`.
The engine uses the copy utility's sequence, seed, and dimension rules.

| Function | Result |
| --- | --- |
| `createDamageLab(width, height, options?)` | Return a new `DamageWorld`. |
| `resizeDamageLab(world, width, height)` | Resize DNA and exposure-particle coordinates. |
| `stepDamageLab(world, elapsed)` | Advance model motion, exposure particles, and automatic repair. |
| `setDamageExposures(world, patch)` | Change selected exposure levels. |
| `setDnaProtectors(world, patch)` | Change selected protector levels. |
| `setDamageSpecies(world, id)` | Change repair context without a new sample. |
| `pulseDamage(world, effect?, point?)` | Apply or emit one direct action and return whether the action was accepted. |
| `repairDamageAt(world, x, y)` | Remove a nearby lesion marker and return whether repair succeeded. |
| `getDamageMetrics(world)` | Return damage counts and cumulative event counters. |
| `takeDamageSnapshot(world)` | Return detached readouts, sequence, species, and control values. |

`point` uses `{ x, y }` in model pixels.
Without a point, exposure pulses choose a site with the seeded model.
The default effect is `world.selectedEffect`.
The initial selected effect is `"uv"`.
An accepted pulse does not guarantee a new lesion.
Filters, antioxidants, site eligibility, and existing markers can prevent a new marker.

UV, X-ray, and oxidant pulses normally emit particles.
Their impacts change the damage state after the particles arrive.
While paused, those pulses apply their impacts immediately.
Heat and electric pulses change geometry or motion without chemical lesion markers.
Manual repair works on Bare DNA as an external repair action.

Positive steps are limited to 1/30 second.
Paused, nonfinite, and nonpositive steps do not advance the state.
Manual pulse and repair actions remain direct commands.

## Exposure and protector values

The setters accept partial objects.
Finite levels are bounded to 0–1, except `electric`, which is bounded to −1–1.
The setters ignore nonfinite or nonnumeric fields.
These values do not represent physical units or calibrated biological probabilities.
The React controls show simulated particles per second for UV, X-rays, and oxidants.
Other strengths use the 0–1 model scale, and the electric field also shows its direction.

| Exposure | Default |
| --- | --- |
| `uv` | 0.25 |
| `xray` | 0 |
| `heat` | 0.12 |
| `oxidants` | 0.15 |
| `electric` | 0 |

Positive `electric` points right.
The negatively charged DNA receives force in the opposite direction.

| Protector | Default |
| --- | --- |
| `antioxidants` | 0.1 |
| `uvFilter` | 0 |
| `xrayShield` | 0 |
| `repair` | 0.35 |
| `repairLight` | 0 |

`DEFAULT_DAMAGE_EXPOSURES` and `DEFAULT_DNA_PROTECTORS` export those defaults.
`SPECIES_PROFILES` exports the qualitative contexts `"bare"`, `"ecoli"`, `"human"`, and `"deinococcus"`.
An unknown species at creation causes a `TypeError`.
An unknown ID passed to `setDamageSpecies` is ignored.
A valid species change keeps existing DNA, lesions, and control values.
It resets the automatic repair budgets.

## Damage snapshots and records

```ts
interface DamageSnapshot {
  activeLesions: number;
  dimers: number;
  singleBreaks: number;
  doubleBreaks: number;
  oxidizedBases: number;
  openPairs: number;
  repaired: number;
  neutralized: number;
  blocked: number;
  created: number;
  species: SpeciesId;
  sequence: string;
  exposures: DamageExposures;
  protectors: DnaProtectors;
}
```

The active counts describe current lesion markers.
`created`, `repaired`, `neutralized`, and `blocked` are cumulative counters.
`created` includes marker conversion from single-strand to double-strand breaks.
It is not a count of absorbed radiation particles.
`sequence` keeps the ordinary DNA letters unchanged by lesion formation.
The sequence-analysis core does not interpret these damage markers.

Lesion kinds are `"dimer"`, `"ssb"`, `"dsb"`, and `"oxidized"`.
Each `DamageLesion` stores an ID, kind, zero-based index, strand, and creation time.
Strand 0 is the upper strand, and strand 1 is its partner.
A dimer joins indices `index` and `index + 1` on that strand.
A strand break is at the bond after `index`.
Nearby opposite-strand breaks within one bond become one double-strand-break marker.

The entry also exports `ExposureKind`, `DamageEffect`, `SpeciesId`, `LesionKind`, `DamageExposures`, and `DnaProtectors`.
Other types are `SpeciesProfile`, `DamageParticle`, `DamageEvent`, `DamageMetrics`, `DamageLabOptions`, and `DamageWorld`.
`DamageEffect` adds `"antioxidants"` and `"repair"` to the five exposure kinds.

## Copy utility: React component

The React entry exports `DnaPlayground` and the `DnaPlaygroundProps` type.
The component uses a continuous canvas with internal simulation state.

```ts
interface DnaPlaygroundProps {
  sequence?: string;
  seed?: number;
  className?: string;
  style?: CSSProperties;
  onChange?: (snapshot: DnaSnapshot) => void;
}
```

| Prop | Purpose |
| --- | --- |
| `sequence` | Supply 6–64 DNA bases from `A`, `C`, `G`, and `T`. |
| `seed` | Supply a seed for the model's random choices. |
| `className` | Add a class to the component root. |
| `style` | Add styles to the component root. |
| `onChange` | Receive a snapshot of the sequence and model readouts. |

All props are optional.
The default synthetic sequence has 24 bases.
The playground accepts known DNA bases only.
The sequence-analysis core has separate input rules.
Pause and reduced motion stop the animated copy process, but copy actions still complete immediately.

A change to `sequence` or `seed` recreates the sample.
Reset restores the current props and keeps the pause state.
Without a supplied seed, the component keeps one seed for the current mount.
The `sequence` prop is a reset input, not a controlled live sequence.

`onChange` sends the initial state and changed serialized snapshots.
Animation updates occur about every 180 milliseconds.
Pointer samples occur about every 90 milliseconds.
Invalid sequence input shows an error and disables the controls.

## Playground snapshots

Import `DnaSnapshot` from `@esmirnov.ai/dna-mutation-explorer/playground`.
Snapshots contain sequence data and readouts, without canvas coordinates.

```ts
interface DnaSnapshot {
  basePairs: number;
  copied: number;
  mismatches: number;
  changes: number;
  openPairs: number;
  generation: number;
  sequence: string;
  copySequence: string | null;
  copyComplete: boolean;
}
```

`sequence` contains the upper strand of the current parent.
`copySequence` contains the planned upper strand of the daughter, or is `null` before a copy exists.
That string can include positions that the animation does not yet show.
`copyComplete` distinguishes a complete copy from a partial copy.
The original ancestry baseline stays in the engine state between generations.

| Readout | Meaning |
| --- | --- |
| `basePairs` | Number of base pairs in the parent. |
| `copied` | Number of visible daughter positions. |
| `mismatches` | Visible daughter bases that do not complement their old partners. |
| `changes` | Current parent bases that differ from the original baseline. |
| `openPairs` | Visible parent and daughter pairs with model openness greater than 0.15. |
| `generation` | Number of successful next-generation actions. |

`changes` includes deliberate parent edits and retained changes in the tracked branch.
It does not count only inherited events.

## Headless playground

The playground entry exports the engine functions and its state types.
The engine has no React or DOM dependency.
It changes the supplied mutable state.
Use the [model guide](MODEL.md) for the copy, mismatch, repair, and branch rules.

```ts
import {
  createDnaPlayground,
  startDnaCopy,
  completeDnaCopy,
  advanceDnaGeneration,
  getDnaMetrics,
} from "@esmirnov.ai/dna-mutation-explorer/playground";

const world = createDnaPlayground(800, 420, { seed: 42 });
startDnaCopy(world, true);
completeDnaCopy(world);
console.log(getDnaMetrics(world).mismatches); // 1

advanceDnaGeneration(world);
console.log(getDnaMetrics(world).changes); // 1
console.log(getDnaMetrics(world).mismatches); // 0
```

### Creation and time

| Function | Result |
| --- | --- |
| `createDnaPlayground(width, height, options?)` | Return a new mutable `DnaPlayground`. |
| `resizeDnaPlayground(world, width, height)` | Resize positions and release the held base. |
| `stepDnaPlayground(world, elapsed)` | Advance motion and copy progress with elapsed seconds. |
| `getDnaMetrics(world)` | Return the current readouts. |
| `complementBase(base)` | Return the canonical partner for one DNA base. |

`options` accepts `sequence` and `seed`.
`DEFAULT_DNA_SEQUENCE` is `ATGGAATTTGCTTGGCAAGGTCCT`.
The default seed is 42.
The engine removes sequence whitespace and converts letters to uppercase.
It rejects ambiguous bases, RNA bases, FASTA headers, and lengths outside 6–64 bases.

Dimensions must be finite positive numbers.
The engine bounds each dimension to 120–16,384 model pixels.
The seed must be finite and is converted to an unsigned 32-bit integer.
The same seed, actions, and time steps produce the same state.

Each positive time step is limited to 1/30 second.
Pause, nonfinite elapsed values, and nonpositive elapsed values do not advance the state.
`copyProgress` measures base-pair progress.
The default `copySpeed` is 8 base pairs per model second.
That speed does not represent a biological reaction rate.

### Pointer and geometry

| Function | Result |
| --- | --- |
| `duplexGeometry(world, kind)` | Return visible base-pair geometry for `"parent"` or `"daughter"`. |
| `nearestDnaBase(world, x, y)` | Return `{ kind, index, side, distance }`, or `null` without a nearby base. |
| `beginDnaGrab(world, x, y)` | Start a grab and return `true`, or return `false` without a nearby base. |
| `moveDnaPointer(world, x, y)` | Move the pointer and the held base. |
| `releaseDnaGrab(world)` | Release the held base. |
| `unzipDnaAt(world, x, y)` | Open nearby pairs and return whether a base was found. |
| `mutateDnaAt(world, x, y)` | Change a permitted base and return whether the edit succeeded. |

Coordinates use model pixels.
Base indices are zero-based.
`side: 0` identifies the upper strand, and `side: 1` identifies its partner.
The partner array uses aligned antiparallel order.

Unzip changes geometry without a sequence edit.
Mutate changes both bases of a parent pair.
On the daughter, Mutate changes only the new upper strand.
The engine rejects mutation during an active copy and mutation of the daughter old partner.

### Copy and ancestry

| Function | Result |
| --- | --- |
| `startDnaCopy(world, withError = false)` | Start a daughter copy and return whether it started. |
| `completeDnaCopy(world)` | Complete an active copy immediately and return whether it completed. |
| `repairDnaCopy(world)` | Correct visible new-strand mismatches and return the repair count. |
| `advanceDnaGeneration(world)` | Select the completed daughter's upper strand and return whether the generation advanced. |

An active copy blocks another copy request.
A new copy replaces the previous completed daughter.
`withError: true` introduces one wrong new base at an interior position.
The daughter stores its old partner independently of later source edits.

`completeDnaCopy` does not change node positions, velocities, physical time, or the seed.
Use it for a headless copy while the world is paused.
The React component calls it for paused or reduced-motion copy actions.

Repair compares visible new bases with their stored old partners.
It does not compare the copy with the ancestry baseline.
The next-generation action needs a complete copy.
It keeps the new upper strand and supplies its complementary partner.
The original baseline stays the same.

### Playground types

The entry exports `DnaBase`, `DnaBrush`, `DuplexKind`, `DnaNode`, `DnaDuplex`, and `DnaPlayground`.
It also exports `DnaGeometry`, `DnaMetrics`, `DnaSnapshot`, and `DnaPlaygroundOptions`.
`DnaBrush` is `"grab"`, `"unzip"`, or `"mutate"`.
`DuplexKind` is `"parent"` or `"daughter"`.
`DnaDuplex` contains `bases`, `partners`, `nodes`, and the visible-position count `copied`.
`DnaGeometry` contains the paired positions, letters, openness, mismatch flag, and baseline-change flag.

## Edit type

```ts
type CodingEdit = {
  start: number;
  deleteCount: number;
  insert: string;
};
```

| Field | Meaning |
| --- | --- |
| `start` | Zero-based position in the normalized reference sequence. |
| `deleteCount` | Number of reference bases to remove. |
| `insert` | Bases to insert at `start` after removal. |

The position and deletion count must be nonnegative integers.
The edit cannot remove bases outside the reference sequence.
An insertion can use position `reference.length`.
The core normalizes the inserted bases with the same rules as the reference sequence.

## Sequence functions

### `normalizeDna(sequence)`

Return an uppercase DNA string without whitespace.
Accept the DNA IUPAC alphabet: `ACGTRYSWKMBDHVN`.
Reject other characters and sequences with more than 30,000 bases.

### `transcribeDna(sequence)`

Normalize the DNA string and replace `T` with `U`.
The input is the coding strand.
The function does not complement or reverse the sequence.

### `translateDna(sequence)`

Return a `Translation` object.
Translation starts at base zero with genetic code table 1.

```ts
type Translation = {
  dna: string;
  rna: string;
  protein: string;
  codons: Codon[];
  trailingBases: string;
  stopIndex: number | null;
  warnings: string[];
};

type Codon = {
  index: number;
  start: number;
  dna: string;
  rna: string;
  aminoAcid: string;
  aminoAcidName: string;
  isStop: boolean;
  afterStop: boolean;
};
```

`Codon.index` is a zero-based codon index.
`Codon.start` is a zero-based base position.
`stopIndex` is the first known stop codon index, or `null`.
`protein` includes that stop as `*` and ends there.
`codons` also includes complete codons after that stop.

Ambiguous codons give `X`.
`trailingBases` contains the final one or two bases that do not form a complete codon.
See the [model guide](MODEL.md) for interpretation limits.

## Edit analysis

### `analyzeCodingEdit(sequence, edit)`

Apply one edit to the normalized reference sequence.
Return the reference translation, edited translation, and sequence consequences.

```ts
type CodingAnalysis = {
  reference: Translation;
  edited: Translation;
  edit: CodingEdit;
  consequence: Consequence;
  effects: Consequence[];
  summary: string;
  affectedCodon: number;
  lengthDelta: number;
  frameshift: boolean;
  warnings: string[];
};
```

`edit` contains the normalized insertion string.
`affectedCodon` is a zero-based codon index at the edit position.
`lengthDelta` equals the inserted length minus the deletion count.
`effects` can describe more than one consequence.
Use `summary` and `warnings` with the primary `consequence` label.

The `frameshift` flag shows a non-multiple-of-three length change in the translated region.
The protein letters can stay the same within a short sequence.
A length change outside the translated region does not set this flag.

| Consequence | Meaning |
| --- | --- |
| `no-change` | The normalized DNA sequence stays the same. |
| `synonymous` | The translated amino-acid sequence stays the same. |
| `missense` | A substitution changes an amino acid. |
| `stop-gained` | The edit introduces a known stop in the translated sequence. |
| `stop-lost` | The edit removes a known reference stop. |
| `frameshift` | The edit changes the reading frame in the translated region. |
| `in-frame-insertion` | The insertion preserves the downstream reading frame. |
| `in-frame-deletion` | The deletion preserves the downstream reading frame. |
| `in-frame-delins` | The replacement preserves the downstream reading frame. |
| `untranslated` | The edit changes DNA outside the translated region in this model. |
| `uncertain` | The supplied sequence does not support a definite consequence. |

## Position maps

### `mapEditedToReference(position, edit)`

Return the reference position for an edited position.
Return `null` for a position inside the inserted span.

### `mapReferenceToEdited(position, edit)`

Return the edited position for a reference position.
Return `null` for a position inside the deleted span.

Both functions use zero-based positions.
They also map endpoint coordinates.
The functions reject negative, noninteger, or unsafe integer positions.
They also reject an unsafe integer result.
The functions do not receive a sequence length.
The caller must enforce the sequence boundary.

A replacement has a deleted span and an inserted span.
The maps do not pair replacement bases.

## Errors

Invalid sequence characters or field types cause a `TypeError`.
Invalid positions, deletion counts, or sequence lengths cause a `RangeError`.
The core does not clamp an invalid edit to the reference sequence.
Catch these errors in a custom interface.
`MutationExplorer` shows input errors in the page.
Input errors open the custom-sequence disclosure automatically.

## Constants

| Export | Meaning |
| --- | --- |
| `CODON_TABLE` | Standard-code map from the 64 DNA codons to amino-acid symbols. |
| `AMINO_ACID_NAMES` | Names for amino-acid symbols, the stop symbol, and the unknown symbol. |
| `MAX_SEQUENCE_LENGTH` | Maximum normalized sequence length: 30,000 bases. |

## Advanced React component

The React entry exports `MutationExplorer`, `MutationExplorerProps`, `SYNTHETIC_SEQUENCE`, `EXAMPLE_EDITS`, and the `ExampleEdit` type.

```ts
interface ExampleEdit {
  id: string;
  label: string;
  description: string;
  edit: CodingEdit;
}
```

`EXAMPLE_EDITS` is a readonly array of `ExampleEdit` objects.

| Prop | Type | Purpose |
| --- | --- | --- |
| `sequence` | `string` | Controlled reference sequence. |
| `defaultSequence` | `string` | Initial reference sequence for internal state. |
| `edit` | `CodingEdit` | Controlled edit. |
| `defaultEdit` | `CodingEdit` | Initial edit for internal state. |
| `onSequenceChange` | `(sequence: string) => void` | Receive a reference sequence change. |
| `onEditChange` | `(edit: CodingEdit) => void` | Receive an edit change. |
| `onAnalysisChange` | `(analysis: CodingAnalysis \| null) => void` | Receive an analysis, or `null` for invalid input. |
| `showChallenges` | `boolean` | Show guided challenges. The default is `true`. |
| `onChallengeComplete` | `(id: string) => void` | Receive a completed challenge ID. |
| `className` | `string` | Add a class to the component root. |
| `style` | `CSSProperties` | Add styles to the component root. |

All props are optional.
Without sequence props, the component uses a synthetic example.
That example starts with `{ start: 4, deleteCount: 0, insert: "" }`.
The interface highlights base 5 without a mutation.
With a custom sequence and no edit props, the component starts with `{ start: 0, deleteCount: 0, insert: "" }`.
The interface calls this state "No edit".

The sequence and edit can use controlled state independently.
The example buttons restore the synthetic sequence before they apply the selected edit.
"Reset example" restores `defaultSequence` and `defaultEdit`.
Without `defaultEdit`, it uses the initial edit rule.
"Reset mutation" removes the current edit and keeps the reference sequence.

The mouse tools emit the existing `CodingEdit` type through `onEditChange`.
Each tool action makes one trial against the unchanged reference sequence.
A new action replaces the previous trial.
The component does not accumulate mouse edits.
The public props stay the same in version 0.3.0.

The chain preview shows the first 24 protein symbols and the full amino-acid count.
The sequence comparison and export include the rest.

The component loads a challenge after an explicit "Start challenge" action.
`onChallengeComplete` fires once for each completed ID per mounted component.
The reset controls and presets keep completed IDs for that session.
A reload or remount resets progress and callback history.
See the [teaching guide](TEACHING.md) for tooltip controls and the codon reference.

## Lessons

The lessons entry has no React dependency.
It exports `CHALLENGES`, `evaluateChallenge`, `SYNTHETIC_SEQUENCE`, and `EXAMPLE_EDITS`.
It also exports the `Challenge`, `ChallengeEvaluation`, and `ExampleEdit` types.

```ts
interface Challenge {
  id: string;
  title: string;
  goal: string;
  explanation: string;
  hints: readonly string[];
  sequence: string;
  initialEdit: CodingEdit;
  targetProtein?: string;
}

interface ChallengeEvaluation {
  completed: boolean;
  feedback: string;
}
```

`CHALLENGES` is a readonly array of eight challenges.
`targetProtein` omits the stop symbol.
The initial edit uses zero-based reference coordinates.
Each challenge starts with a no-op edit at position zero.

### `evaluateChallenge(id, analysis)`

Evaluate a result against the rules for one challenge.
Use `analyzeCodingEdit` with that challenge's reference sequence.
The return value contains a completion flag and feedback text.
The function does not store progress or call React callbacks.

An unknown ID or a different reference gives `completed: false` with feedback.
The completion rules compare actual sequence outputs.
See the [teaching guide](TEACHING.md) for an example and challenge limits.
