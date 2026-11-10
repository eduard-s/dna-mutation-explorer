import { translateDna, type CodingAnalysis, type CodingEdit } from "../core/index.js";

export const SYNTHETIC_SEQUENCE = "ATGGAATTTGCTTGGCAAGGTCCTAACGACTACAAAGAGGCTTTCGGTAAGTAA";

export interface ExampleEdit {
  id: string;
  label: string;
  description: string;
  edit: CodingEdit;
}

export const EXAMPLE_EDITS: readonly ExampleEdit[] = [
  { id: "synonymous", label: "Same protein", description: "GAA and GAG both encode glutamate.", edit: { start: 5, deleteCount: 1, insert: "G" } },
  { id: "missense", label: "One amino acid", description: "GAA becomes GCA. Alanine replaces glutamate.", edit: { start: 4, deleteCount: 1, insert: "C" } },
  { id: "stop", label: "Early stop", description: "TGG becomes TGA. Translation stops at this codon.", edit: { start: 14, deleteCount: 1, insert: "A" } },
  { id: "delete-one", label: "Delete 1 base", description: "A one-base deletion changes the downstream codon groups.", edit: { start: 6, deleteCount: 1, insert: "" } },
  { id: "delete-three", label: "Delete 3 bases", description: "A three-base deletion removes one codon and keeps the frame.", edit: { start: 6, deleteCount: 3, insert: "" } }
];

export interface Challenge {
  id: string;
  title: string;
  goal: string;
  explanation: string;
  hints: readonly string[];
  sequence: string;
  initialEdit: CodingEdit;
  /** Target proteins omit the terminal stop symbol. */
  targetProtein?: string;
}

export interface ChallengeEvaluation {
  completed: boolean;
  feedback: string;
}

const damagedSequence = SYNTHETIC_SEQUENCE.slice(0, 6) + "C" + SYNTHETIC_SEQUENCE.slice(6);
const missingStopSequence = SYNTHETIC_SEQUENCE.slice(0, -3) + "CAA";
const ambiguousSequence = SYNTHETIC_SEQUENCE.slice(0, 6) + "NNN" + SYNTHETIC_SEQUENCE.slice(9);
const resolvedSequence = SYNTHETIC_SEQUENCE.slice(0, 6) + "GCT" + SYNTHETIC_SEQUENCE.slice(9);
const proteinLetters = (protein: string): string => protein.replace(/\*$/, "");
const targetProtein = proteinLetters(translateDna(SYNTHETIC_SEQUENCE).protein);

function challenge(data: Omit<Challenge, "initialEdit">): Challenge {
  return Object.freeze({
    ...data,
    hints: Object.freeze([...data.hints]),
    initialEdit: Object.freeze({ start: 0, deleteCount: 0, insert: "" }),
  });
}

/** Array order sets the lesson order. Each task starts without an edit. */
export const CHALLENGES: readonly Challenge[] = Object.freeze([
  challenge({
    id: "synonymous",
    title: "Change DNA, keep the protein",
    goal: "Change one base before the terminal stop. Keep the amino-acid sequence and the stop.",
    explanation: "A codon has three DNA bases. Several codons can encode the same amino acid.",
    hints: [
      "Find codon 2 at bases 4–6. Its DNA is GAA, which encodes glutamate.",
      "GAG also encodes glutamate. Only the third base differs.",
      "Replace base 6 with G. The codon changes from GAA to GAG.",
    ],
    sequence: SYNTHETIC_SEQUENCE,
    targetProtein,
  }),
  challenge({
    id: "missense",
    title: "Change one amino acid",
    goal: "Change one codon before the terminal stop. Keep the frame and change exactly one amino acid.",
    explanation: "A base replacement can change the amino acid that a codon encodes. The later codon groups can stay the same.",
    hints: [
      "Find GAA at bases 4–6. It encodes glutamate.",
      "GCA encodes alanine. Compare GAA with GCA.",
      "Replace base 5 with C. The codon changes from GAA to GCA.",
    ],
    sequence: SYNTHETIC_SEQUENCE,
  }),
  challenge({
    id: "early-stop",
    title: "Add an early stop",
    goal: "Change one DNA base to create a stop before the terminal stop.",
    explanation: "TAA, TAG, and TGA are stop codons in the standard genetic code. A stop ends translation in this model.",
    hints: [
      "Find codon 5 at bases 13–15. TGG encodes tryptophan.",
      "TGA is a stop codon. Compare its last base with TGG.",
      "Replace base 15 with A. TGG becomes TGA.",
    ],
    sequence: SYNTHETIC_SEQUENCE,
  }),
  challenge({
    id: "delete-one",
    title: "Shift the frame",
    goal: "Delete one base before the terminal stop. Change the downstream codon groups.",
    explanation: "Translation reads groups of three bases. A one-base deletion can change every later group until a stop ends translation.",
    hints: [
      "Find TTT at bases 7–9. It encodes phenylalanine.",
      "Delete one T. Compare the later groups of three.",
      "Delete base 7. Keep the inserted sequence empty.",
    ],
    sequence: SYNTHETIC_SEQUENCE,
  }),
  challenge({
    id: "delete-three",
    title: "Remove one complete codon",
    goal: "Delete three bases that form one codon. Keep the other amino acids and the terminal stop.",
    explanation: "A three-base deletion keeps the downstream reading frame. A deletion at codon boundaries removes one amino acid.",
    hints: [
      "Find codon 3 at bases 7–9. Its DNA is TTT.",
      "Delete all three T bases. Compare this result with the one-base deletion.",
      "Delete bases 7–9. Keep the inserted sequence empty.",
    ],
    sequence: SYNTHETIC_SEQUENCE,
  }),
  challenge({
    id: "repair-frame",
    title: "Repair the frame",
    goal: "Remove one extra base. Restore the original DNA and the target protein.",
    explanation: "This sample has one extra C before the original third codon. The analysis compares your repair with this damaged reference. A successful repair can still have a frameshift label.",
    hints: [
      "The original DNA starts with ATG GAA TTT GCT.",
      "The damaged sample has C at base 7, between GAA and TTT.",
      "Delete base 7. The result must match the original DNA exactly.",
    ],
    sequence: damagedSequence,
    targetProtein,
  }),
  challenge({
    id: "restore-stop",
    title: "Restore the stop",
    goal: "Replace the final CAA codon with a stop. Keep all earlier amino acids.",
    explanation: "The final CAA encodes glutamine, so this sample has no stop. This task restores a stop signal. It does not predict protein function.",
    hints: [
      "Find codon 18 at bases 52–54. Its DNA is CAA.",
      "TAA, TAG, and TGA are the standard stop codons.",
      "Replace base 52 with T. CAA becomes TAA.",
    ],
    sequence: missingStopSequence,
    targetProtein,
  }),
  challenge({
    id: "resolve-ambiguity",
    title: "Resolve an unknown codon",
    goal: "Replace NNN at bases 7–9 with GCT. Get alanine and remove X from the edited protein.",
    explanation: "N can represent A, C, G, or T. The model uses X for an ambiguous codon. The consequence can stay uncertain because the reference codon is unknown, even when the edited codon is known.",
    hints: [
      "Find NNN in codon 3. It appears as X in the reference protein.",
      "GCT encodes alanine in the standard genetic code.",
      "Replace bases 7–9 with GCT. Keep all other bases.",
    ],
    sequence: ambiguousSequence,
    targetProtein: proteinLetters(translateDna(resolvedSequence).protein),
  }),
]);

function differences(reference: string, edited: string): number[] {
  if (reference.length !== edited.length) return [];
  const positions: number[] = [];
  for (let position = 0; position < reference.length; position++) {
    if (reference[position] !== edited[position]) positions.push(position);
  }
  return positions;
}

function deletionPositions(reference: string, edited: string, count: number): number[] {
  if (reference.length - edited.length !== count) return [];
  const positions: number[] = [];
  for (let start = 0; start + count <= reference.length; start++) {
    if (reference.slice(0, start) + reference.slice(start + count) === edited) positions.push(start);
  }
  return positions;
}

const feedback: Readonly<Record<string, { success: string; retry: string }>> = {
  synonymous: {
    success: "One DNA base changes. The amino-acid sequence and the terminal stop stay the same.",
    retry: "Change exactly one base before the stop. Keep the complete protein sequence. Try a hint for GAA.",
  },
  missense: {
    success: "One codon changes one amino acid. The frame and the terminal stop stay the same.",
    retry: "Change one codon before the stop. Keep exactly one amino-acid difference and no new stop.",
  },
  "early-stop": {
    success: "One DNA base creates an earlier stop. Translation ends before the reference terminal stop.",
    retry: "Replace one base to create an earlier stop. Try a hint for TGG.",
  },
  "delete-one": {
    success: "One base is deleted before the stop. The downstream codon groups change.",
    retry: "Delete exactly one base before the terminal stop. Do not replace or insert other bases.",
  },
  "delete-three": {
    success: "One complete codon is deleted. The other amino acids and the terminal stop stay in frame.",
    retry: "Delete one complete codon before the stop. Keep the other amino acids and the terminal stop.",
  },
  "repair-frame": {
    success: "The original DNA and protein are restored. The frame-change label compares this repair with the damaged reference.",
    retry: "Remove the extra C. Restore the original DNA exactly, not just its amino-acid sequence.",
  },
  "restore-stop": {
    success: "The final codon stops translation. All earlier amino acids stay the same.",
    retry: "Change only the final CAA codon to a stop. Keep every earlier DNA base.",
  },
  "resolve-ambiguity": {
    success: "GCT encodes alanine, and the edited protein has no X. The consequence stays uncertain because the reference codon was NNN.",
    retry: "Replace only NNN at bases 7–9 with GCT. Keep every other DNA base.",
  },
};

/** The evaluator compares actual sequences. Equivalent edit descriptions can give the same result. */
export function evaluateChallenge(id: string, analysis: CodingAnalysis): ChallengeEvaluation {
  const current = CHALLENGES.find(item => item.id === id);
  if (!current) return { completed: false, feedback: "This challenge is not available." };
  if (analysis.reference.dna !== current.sequence) {
    return { completed: false, feedback: "Use the challenge sample before you try an edit." };
  }
  if (analysis.reference.dna === analysis.edited.dna) {
    return { completed: false, feedback: `Start with an edit. ${current.goal}` };
  }
  if (/[^ACGT]/.test(analysis.edited.dna)) {
    return { completed: false, feedback: "Use known DNA bases for this task: A, C, G, and T." };
  }
  const reference = analysis.reference;
  const edited = analysis.edited;
  const changedBases = differences(reference.dna, edited.dna);
  const stopStart = reference.stopIndex === null ? reference.codons.length * 3 : reference.stopIndex * 3;
  const sameStop = edited.stopIndex === reference.stopIndex;
  let completed = false;
  switch (id) {
    case "synonymous":
      completed = reference.dna.length === edited.dna.length && changedBases.length === 1 && changedBases[0]! < stopStart &&
        reference.protein === edited.protein && sameStop;
      break;
    case "missense": {
      const changedCodons = new Set(changedBases.map(position => Math.floor(position / 3)));
      const aminoChanges = differences(reference.protein, edited.protein);
      completed = reference.dna.length === edited.dna.length && changedCodons.size === 1 &&
        changedBases.every(position => position < stopStart) && aminoChanges.length === 1 &&
        aminoChanges[0]! < (reference.stopIndex ?? reference.protein.length) && sameStop;
      break;
    }
    case "early-stop":
      completed = reference.dna.length === edited.dna.length && changedBases.length === 1 &&
        reference.stopIndex !== null && edited.stopIndex !== null && edited.stopIndex < reference.stopIndex &&
        changedBases[0]! >= edited.stopIndex * 3 && changedBases[0]! < (edited.stopIndex + 1) * 3;
      break;
    case "delete-one":
      completed = deletionPositions(reference.dna, edited.dna, 1).some(position => position < stopStart) &&
        analysis.frameshift && reference.protein !== edited.protein;
      break;
    case "delete-three":
      completed = !analysis.frameshift && reference.stopIndex !== null && edited.stopIndex === reference.stopIndex - 1 &&
        deletionPositions(reference.dna, edited.dna, 3).some(position => {
          const index = position / 3;
          return position % 3 === 0 && position < stopStart &&
            edited.protein === reference.protein.slice(0, index) + reference.protein.slice(index + 1);
        });
      break;
    case "repair-frame":
      completed = edited.dna === SYNTHETIC_SEQUENCE && proteinLetters(edited.protein) === targetProtein;
      break;
    case "restore-stop":
      completed = edited.dna.length === SYNTHETIC_SEQUENCE.length &&
        edited.dna.slice(0, -3) === SYNTHETIC_SEQUENCE.slice(0, -3) &&
        edited.stopIndex === SYNTHETIC_SEQUENCE.length / 3 - 1 && proteinLetters(edited.protein) === targetProtein;
      break;
    case "resolve-ambiguity":
      completed = edited.dna === resolvedSequence && proteinLetters(edited.protein) === current.targetProtein;
      break;
  }
  return { completed, feedback: completed ? feedback[id]!.success : feedback[id]!.retry };
}
