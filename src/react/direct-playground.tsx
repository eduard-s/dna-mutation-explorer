"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { AMINO_ACID_NAMES, MAX_SEQUENCE_LENGTH, type AminoAcid, type CodingAnalysis, type CodingEdit, type Translation } from "../core/index.js";
import { directEdit, type DirectTool, type DnaBase } from "./direct-edit.js";

const complements: Record<string, string> = { A: "T", T: "A", C: "G", G: "C", N: "N", R: "Y", Y: "R", S: "S", W: "W", K: "M", M: "K", B: "V", V: "B", D: "H", H: "D" };
const tools: { id: DirectTool; label: string; instruction: string }[] = [
  { id: "swap", label: "Swap a letter", instruction: "Click a DNA letter to change it. Click it again to try the next letter." },
  { id: "cut-base", label: "Cut one base", instruction: "Click a DNA letter to remove it. See how the three-letter groups change." },
  { id: "cut-codon", label: "Cut one codon", instruction: "Click a DNA letter to remove its complete three-letter group." },
  { id: "insert", label: "Add a base", instruction: "Choose a letter. Click a DNA letter to insert before it, or append at the end." }
];

function ProteinChain({ translation, reference, label, edited }: { translation: Translation; reference: Translation; label: string; edited?: boolean }) {
  const protein = translation.protein;
  const limit = 24;
  return <div className="dme-live-protein">
    <div><strong>{label}</strong><span>{protein.replace(/\*/g, "").length} amino acids</span></div>
    <ol className="dme-protein-chain" aria-label={`${label} sequence`}>
      {Array.from(protein.slice(0, limit)).map((letter, index) => <li key={index}
        className={`${letter === "*" ? "dme-protein-stop" : ""}${edited && reference.protein[index] !== letter ? " dme-protein-different" : ""}`}
        title={letter === "*" ? "Stop signal. No amino acid is added." : `${index + 1}: ${AMINO_ACID_NAMES[letter as AminoAcid]}`}>
        <span aria-label={letter === "*" ? "Stop signal" : `${index + 1}: ${AMINO_ACID_NAMES[letter as AminoAcid]}`}>{letter === "*" ? "STOP" : letter}</span>
      </li>)}
      {!protein && <li className="dme-protein-empty">No complete amino acid</li>}
    </ol>
    {protein.length > limit && <p className="dme-chain-limit">First {limit} symbols shown. The sequence comparison and export include the rest.</p>}
  </div>;
}

function codonName(translation: Translation, index: number) {
  const codon = translation.codons[index];
  return !codon ? "Incomplete codon" : codon.afterStop ? "After the stop" : codon.isStop ? "Stop signal" : codon.aminoAcidName;
}

export function DirectPlayground({ analysis, selected, consequence, onEdit }: {
  analysis: CodingAnalysis | null; selected: number; consequence: string; onEdit: (edit: CodingEdit) => void;
}) {
  const [tool, setTool] = useState<DirectTool>("swap");
  const [base, setBase] = useState<DnaBase>("A");
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(12);
  const [lastAction, setLastAction] = useState<{ reference: string; edit: CodingEdit; text: string } | null>(null);
  const container = useRef<HTMLDivElement>(null);
  const reference = analysis?.reference.dna ?? "";
  useEffect(() => {
    const element = container.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(entries => setSize(Math.max(3, Math.min(18, Math.floor((entries[0]?.contentRect.width ?? 600) / 48 / 3) * 3))));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => { setPage(Math.floor(selected / size)); }, [selected, size]);
  useEffect(() => { setLastAction(null); }, [reference]);
  const pages = Math.max(1, Math.ceil(reference.length / size));
  const safePage = Math.max(0, Math.min(page, pages - 1));
  const start = safePage * size;
  const visible = reference.slice(start, start + size);
  const activeTool = tools.find(item => item.id === tool)!;
  const hasEdit = Boolean(analysis && analysis.reference.dna !== analysis.edited.dna);
  const act = (position: number) => {
    if (!analysis) return;
    const next = directEdit(reference, analysis.edit, tool, position, base);
    if (!next) return;
    const text = tool === "swap" ? `Try base ${position + 1}: ${reference[position]} → ${next.insert}.`
      : tool === "insert" ? `Add ${base} ${position === reference.length ? "after the final base" : `before base ${position + 1}`}.`
      : `Remove ${next.deleteCount === 3 ? `bases ${next.start + 1}–${next.start + 3}` : `base ${position + 1}`}.`;
    setLastAction({ reference, edit: next, text });
    onEdit(next);
  };
  const codonIndex = Math.floor(selected / 3);
  const isNoChange = analysis?.consequence === "no-change";
  const acceptedAction = analysis && lastAction?.reference === reference && lastAction.edit.start === analysis.edit.start
    && lastAction.edit.deleteCount === analysis.edit.deleteCount && lastAction.edit.insert === analysis.edit.insert ? lastAction.text : "";
  return <section className="dme-direct" aria-label="Mouse DNA playground">
    <div className="dme-direct-heading"><div><h2>Change the DNA. Watch the protein.</h2>
      <p>A mutation is a change in DNA. Explore why one change can leave a protein unchanged, change an amino acid, or add a stop.</p></div>
      <button type="button" disabled={!analysis || !hasEdit} onClick={() => {
        setLastAction(null);
        onEdit({ start: Math.min(4, Math.max(0, reference.length - 1)), deleteCount: 0, insert: "" });
      }}>Reset mutation</button></div>
    <div className="dme-direct-tools" role="group" aria-label="Mouse tools">
      {tools.map(item => <button type="button" key={item.id} disabled={item.id === "insert" && reference.length >= MAX_SEQUENCE_LENGTH}
        aria-pressed={tool === item.id} onClick={() => setTool(item.id)}>{item.label}</button>)}
    </div>
    {tool === "insert" && <div className="dme-base-palette" role="group" aria-label="Base to add"><span>Add:</span>
      {(["A", "C", "G", "T"] as const).map(letter => <button type="button" key={letter} aria-pressed={base === letter}
        aria-label={`Add ${letter}`} onClick={() => setBase(letter)}>{letter}</button>)}
    </div>}
    <p className="dme-direct-instruction">{activeTool.instruction} Mouse, touch, Enter, and Space all use the same action.</p>
    {reference.length >= MAX_SEQUENCE_LENGTH && <p className="dme-direct-max">The reference has the maximum {MAX_SEQUENCE_LENGTH} bases. Use a shorter reference to insert a base.</p>}
    <div className="dme-direct-dna" ref={container}>
      <div className="dme-direct-caption"><span>DNA · click the large letters</span><span>A complete three-letter group encodes an amino acid or a stop.</span></div>
      {analysis && reference ? <>
        <div className="dme-mouse-ladder" style={{ "--dme-base-count": visible.length } as CSSProperties}>
          {Array.from(visible).map((letter, index) => {
            const position = start + index;
            const offset = Math.sin(index / 6 * Math.PI) * 12;
            const affected = hasEdit && position >= analysis.edit.start && position < analysis.edit.start + Math.max(1, analysis.edit.deleteCount);
            const replaced = affected && analysis.edit.deleteCount > 0 && analysis.edit.deleteCount === analysis.edit.insert.length;
            const removed = affected && analysis.edit.deleteCount > 0 && !analysis.edit.insert;
            const inserted = affected && analysis.edit.deleteCount === 0 && analysis.edit.insert;
            const displayedBase = replaced ? analysis.edit.insert[position - analysis.edit.start] : letter;
            const disabled = (tool === "cut-codon" && Math.floor(position / 3) * 3 + 3 > reference.length)
              || (tool === "insert" && reference.length >= MAX_SEQUENCE_LENGTH);
            return <div key={position} className={`dme-mouse-rung${Math.floor(position / 3) % 2 ? " dme-mouse-codon-alt" : ""}`}
              style={{ "--dme-base-y": `${offset}px` } as CSSProperties}>
              <span className={`dme-mouse-position${inserted ? " dme-mouse-insertion" : ""}`}>{inserted ? `+${inserted}` : position + 1}</span><span className="dme-mouse-bond" aria-hidden="true" />
              <button type="button" className={`dme-mouse-base${position === selected ? " dme-mouse-selected" : ""}${affected ? " dme-mouse-affected" : ""}${removed ? " dme-mouse-removed" : ""}`}
                disabled={disabled} aria-label={`${activeTool.label} at base ${position + 1}: ${letter}${replaced ? `, trial ${displayedBase}` : removed ? ", removed" : inserted ? `, insert ${inserted} before` : ""}`} onClick={() => act(position)}>{displayedBase}</button>
              <span className={`dme-mouse-complement${removed ? " dme-mouse-removed" : ""}`} aria-hidden="true">{complements[displayedBase] ?? "?"}</span>
            </div>;
          })}
        </div>
        <div className="dme-direct-pagination"><span>Original bases {start + 1}–{start + visible.length} of {reference.length}</span>
          <div><button type="button" aria-label="Previous DNA bases" disabled={safePage === 0} onClick={() => setPage(safePage - 1)}>Previous</button>
            <button type="button" aria-label="Next DNA bases" disabled={safePage === pages - 1} onClick={() => setPage(safePage + 1)}>Next</button>
            {tool === "insert" && safePage === pages - 1 && <button type="button" disabled={reference.length >= MAX_SEQUENCE_LENGTH} onClick={() => act(reference.length)}>Append {base}</button>}</div></div>
      </> : analysis ? <button type="button" onClick={() => onEdit({ start: 0, deleteCount: 0, insert: base })}>Add {base} to the empty DNA</button>
        : <p>Correct the custom sequence or edit to use the playground.</p>}
    </div>
    <div className="dme-direct-trial" role="status">{acceptedAction || (isNoChange && reference.length >= 6 && selected === 4
      ? "Try it: click the highlighted letter at base 5. See which protein letter changes." : "Choose a tool, then click a DNA letter.")}</div>
    <p className="dme-direct-limit">Try one edit at a time. Each click compares a new edit with the original DNA.</p>
    <div className="dme-result" role="status" aria-live="polite" aria-atomic="true"><div>
      <span className="dme-section-label">Your result</span><h2>{analysis ? consequence : "No result"}</h2>
      <p>{isNoChange ? "The two protein chains match. Change a DNA letter to compare them." : analysis?.summary ?? "Correct the custom sequence or edit to calculate a result."}</p>
      {analysis && <p className="dme-direct-codon"><code>{analysis.reference.dna.slice(codonIndex * 3, codonIndex * 3 + 3) || "···"} → {analysis.edited.dna.slice(codonIndex * 3, codonIndex * 3 + 3) || "···"}</code>
        <span>{codonName(analysis.reference, codonIndex)} → {codonName(analysis.edited, codonIndex)}</span></p>}
    </div></div>
    {analysis && <div className="dme-live-proteins">
      <ProteinChain translation={analysis.reference} reference={analysis.reference} label="Original protein" />
      <ProteinChain translation={analysis.edited} reference={analysis.reference} label="Your protein" edited />
      <p>Letters identify amino acids. STOP ends the chain. Clay marks a different symbol at the same position.</p>
    </div>}
  </section>;
}
