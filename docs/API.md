# API

## Exports

Import the core from `dna-mutation-explorer` or `dna-mutation-explorer/core`.
Import the visual component from `dna-mutation-explorer/react`.
Import the component stylesheet from `dna-mutation-explorer/styles.css`.

The core has no React dependency.
All core functions are synchronous.
The core also exports the `AminoAcid`, `CodingEdit`, `Codon`, `Translation`, `Consequence`, and `CodingAnalysis` types.

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
The supplied React component shows input errors in the page.

## Constants

| Export | Meaning |
| --- | --- |
| `CODON_TABLE` | Standard-code map from the 64 DNA codons to amino-acid symbols. |
| `AMINO_ACID_NAMES` | Names for amino-acid symbols, the stop symbol, and the unknown symbol. |
| `MAX_SEQUENCE_LENGTH` | Maximum normalized sequence length: 30,000 bases. |

## React component

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
| `className` | `string` | Add a class to the component root. |
| `style` | `CSSProperties` | Add styles to the component root. |

All props are optional.
Without sequence props, the component uses a synthetic example.
That example starts with `{ start: 4, deleteCount: 1, insert: "C" }`.
With a custom sequence and no edit props, the component starts with `{ start: 0, deleteCount: 0, insert: "" }`.
The interface calls this state "No edit".

The sequence and edit can use controlled state independently.
The example buttons restore the synthetic sequence before they apply the selected edit.
Reset restores `defaultSequence` and `defaultEdit`.
Without `defaultEdit`, Reset uses the initial edit rule.
