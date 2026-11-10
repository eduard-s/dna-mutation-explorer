import { MAX_SEQUENCE_LENGTH, type CodingEdit } from "../core/index.js";

export type DirectTool = "swap" | "cut-base" | "cut-codon" | "insert";
export type DnaBase = "A" | "C" | "G" | "T";

/** Create one trial against the original sequence, without committing a new reference. */
export function directEdit(sequence: string, current: CodingEdit, tool: DirectTool, position: number, base: DnaBase = "A"): CodingEdit | null {
  if (!Number.isInteger(position) || position < 0 || position > sequence.length) return null;
  if (tool === "insert") return sequence.length < MAX_SEQUENCE_LENGTH ? { start: position, deleteCount: 0, insert: base } : null;
  if (position === sequence.length) return null;
  if (tool === "cut-base") return { start: position, deleteCount: 1, insert: "" };
  if (tool === "cut-codon") {
    const start = Math.floor(position / 3) * 3;
    return start + 3 <= sequence.length ? { start, deleteCount: 3, insert: "" } : null;
  }
  const letters = "ACGT";
  const previous = current.start === position && current.deleteCount === 1 && current.insert.length === 1
    ? current.insert : sequence[position];
  return { start: position, deleteCount: 1, insert: letters[(letters.indexOf(previous) + 1) % 4] };
}
