"use client";

import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";
import { analyzeCodingEdit, type CodingAnalysis, type CodingEdit, type Translation } from "../core/index.js";

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

export interface MutationExplorerProps {
  sequence?: string;
  defaultSequence?: string;
  edit?: CodingEdit;
  defaultEdit?: CodingEdit;
  onSequenceChange?: (sequence: string) => void;
  onEditChange?: (edit: CodingEdit) => void;
  onAnalysisChange?: (analysis: CodingAnalysis | null) => void;
  className?: string;
  style?: CSSProperties;
}

type EditMode = "none" | "replace" | "insert" | "delete";

const consequenceNames: Record<string, string> = {
  "no-change": "No change", synonymous: "Same protein sequence", missense: "Amino-acid change",
  "stop-gained": "Stop gained", "stop-lost": "Stop lost", frameshift: "Frameshift",
  "in-frame-insertion": "In-frame insertion", "in-frame-deletion": "In-frame deletion",
  "in-frame-delins": "In-frame replacement", untranslated: "Outside the translated region", uncertain: "Uncertain consequence"
};

const modeFor = (edit: CodingEdit): EditMode => edit.deleteCount === 0 && !edit.insert ? "none" : edit.deleteCount === 0 ? "insert" : !edit.insert ? "delete" : "replace";
const sameEdit = (a: CodingEdit, b: CodingEdit) => a.start === b.start && a.deleteCount === b.deleteCount && a.insert === b.insert;
const compact = (sequence: string) => sequence.replace(/\s/g, "").toUpperCase();
const complement: Record<string, string> = { A: "T", T: "A", C: "G", G: "C", R: "Y", Y: "R", S: "S", W: "W", K: "M", M: "K", B: "V", V: "B", D: "H", H: "D", N: "N" };

function download(name: string, text: string, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function fasta(name: string, sequence: string) {
  return `>${name}\n${sequence.match(/.{1,70}/g)?.join("\n") ?? ""}\n`;
}

function DnaHelix({ sequence, selected }: { sequence: string; selected: number }) {
  const id = useId();
  const start = Math.max(0, Math.min(sequence.length - 15, Math.floor(selected / 3) * 3 - 6));
  const visible = sequence.slice(start, start + 15);
  const points = Array.from({ length: 101 }, (_, i) => {
    const x = 24 + i * 8.52;
    const y = 75 + Math.sin(i / 100 * Math.PI * 4) * 38;
    return [x, y] as const;
  });
  const path = (mirror: boolean) => points.map(([x, y], i) => `${i ? "L" : "M"}${x},${mirror ? 150 - y : y}`).join(" ");
  return <figure className="dme-helix">
    <svg viewBox="0 0 900 150" aria-labelledby={id} role="img">
      <title id={id}>Reference DNA near the selected codon. The dark bases show the selected codon.</title>
      <path className="dme-backbone dme-backbone-far" d={path(true)} />
      <path className="dme-backbone" d={path(false)} />
      {Array.from(visible).map((base, index) => {
        const position = start + index;
        const x = 24 + (index + .5) / 15 * 852;
        const offset = Math.sin((index + .5) / 15 * Math.PI * 4) * 38;
        const active = Math.floor(position / 3) === Math.floor(selected / 3);
        return <g key={position} className={`dme-helix-base${active ? " dme-helix-selected" : ""}`}>
          <line x1={x} y1={75 - offset} x2={x} y2={75 + offset} />
          <circle className="dme-complement" cx={x} cy={75 - offset} r={11} />
          <circle cx={x} cy={75 + offset} r={13} />
          <text x={x} y={80 + offset}>{base}</text>
          {Math.abs(offset) > 15 && <text className="dme-complement-letter" x={x} y={79 - offset}>{complement[base] ?? "?"}</text>}
        </g>;
      })}
    </svg>
    <figcaption><span>Reference DNA · bases {visible ? start + 1 : 0}–{start + visible.length}</span><span>Selected codon {Math.floor(selected / 3) + 1}</span></figcaption>
  </figure>;
}

function SequenceTrack({ translation, reference, edit, edited, firstCodon, count, selected, onSelect }: {
  translation: Translation; reference: Translation; edit: CodingEdit; edited: boolean;
  firstCodon: number; count: number; selected: number; onSelect: (position: number) => void;
}) {
  const slots = Array.from({ length: count }, (_, index) => firstCodon + index);
  const editedSelected = !edited || selected <= edit.start ? selected
    : selected < edit.start + edit.deleteCount ? edit.start
    : selected + edit.insert.length - edit.deleteCount;
  const activeCodon = Math.floor(editedSelected / 3);
  const affected = Math.floor(edit.start / 3);
  const referenceCodonFor = (index: number) => {
    if (!edited || edit.deleteCount === edit.insert.length || index * 3 + 3 <= edit.start) return reference.codons[index];
    if (index * 3 >= edit.start + edit.insert.length) {
      const referenceStart = index * 3 - edit.insert.length + edit.deleteCount;
      if (referenceStart % 3 === 0) return reference.codons[referenceStart / 3];
    }
    return undefined;
  };
  const proteinState = (codon: Translation["codons"][number] | undefined) => !codon ? "absent" : codon.afterStop ? "untranslated" : codon.isStop ? "stop" : codon.aminoAcid;
  const isChanged = (index: number) => edited && translation.codons[index]?.dna !== referenceCodonFor(index)?.dna;
  const classFor = (index: number) => ["dme-codon", index === activeCodon ? "dme-codon-selected" : "", isChanged(index) ? "dme-codon-changed" : "", translation.codons[index]?.afterStop ? "dme-after-stop" : ""].filter(Boolean).join(" ");
  const mapPosition = (position: number) => {
    if (!edited || position < edit.start) return position;
    if (position < edit.start + edit.insert.length) return edit.start;
    return position - edit.insert.length + edit.deleteCount;
  };
  return <div className={`dme-track${edited ? " dme-track-edited" : ""}`}>
    <div className="dme-track-heading"><h3>{edited ? "Edited sequence" : "Reference sequence"}</h3><span>{translation.dna.length} bases · {translation.protein.replace(/\*/g, "").length} amino acids</span></div>
    <div className="dme-sequence-grid" style={{ "--dme-columns": count } as CSSProperties}>
      <span className="dme-row-label dme-position-label">Base</span>
      {slots.map(index => <span className="dme-position" key={`position-${index}`}>{index * 3 + 1}–{index * 3 + 3}</span>)}
      <span className="dme-row-label">DNA <small>5′ → 3′</small></span>
      {slots.map(index => {
        const codon = translation.codons[index];
        const bases = codon?.dna ?? translation.dna.slice(index * 3, index * 3 + 3);
        return <span key={`dna-${index}`} className={classFor(index)}>
          {Array.from({ length: 3 }, (_, local) => {
            const position = index * 3 + local;
            const base = bases[local];
            const removed = !edited && position >= edit.start && position < edit.start + edit.deleteCount;
            const inserted = edited && position >= edit.start && position < edit.start + edit.insert.length;
            return base ? <button key={local} type="button" className={`dme-base dme-base-${base}${removed ? " dme-base-removed" : ""}${inserted ? " dme-base-inserted" : ""}`}
              aria-label={`${edited ? "Edited" : "Reference"} base ${position + 1}: ${base}${removed ? ", replaced or deleted" : ""}${inserted ? ", inserted" : ""}`}
              aria-pressed={!edited && position === selected} onClick={() => onSelect(mapPosition(position))}>{base}</button>
              : <span key={local} className="dme-base dme-base-empty" aria-hidden="true">·</span>;
          })}
        </span>;
      })}
      <span className="dme-row-label">RNA <small>5′ → 3′</small></span>
      {slots.map(index => <button type="button" key={`rna-${index}`} className={`${classFor(index)} dme-rna`}
        disabled={index * 3 >= translation.dna.length} onClick={() => onSelect(mapPosition(index * 3))}
        aria-label={`${edited ? "Edited" : "Reference"} RNA codon ${index + 1}: ${(translation.codons[index]?.rna ?? translation.rna.slice(index * 3, index * 3 + 3)) || "absent"}`}>
        {(translation.codons[index]?.rna ?? translation.rna.slice(index * 3, index * 3 + 3)) || "···"}
      </button>)}
      <span className="dme-row-label">Protein</span>
      {slots.map(index => {
        const codon = translation.codons[index];
        const changed = edited && proteinState(codon) !== proteinState(referenceCodonFor(index));
        return <button type="button" key={`protein-${index}`} className={`${classFor(index)} dme-amino${changed ? " dme-amino-changed" : ""}${codon?.isStop ? " dme-stop" : ""}`}
          disabled={!codon} onClick={() => onSelect(mapPosition(index * 3))}
          aria-label={`${edited ? "Edited" : "Reference"} codon ${index + 1}: ${codon ? codon.afterStop ? "after the stop codon, not translated" : codon.isStop ? "stop" : codon.aminoAcidName : "incomplete or absent"}`}>
          <strong>{!codon ? "·" : codon.afterStop ? "—" : codon.isStop ? "*" : codon.aminoAcid}</strong>
          <small>{!codon ? "" : codon.afterStop ? "not read" : codon.isStop ? "Stop" : codon.aminoAcidName}</small>
        </button>;
      })}
    </div>
    {(edit.insert.length > 0 || edit.deleteCount > 0) && firstCodon <= affected && affected < firstCodon + count && <span className="dme-track-note">{edited
      ? edit.insert ? "Underlined bases show the inserted sequence." : "The deletion joins the bases at the edit position."
      : edit.deleteCount > 0 ? "Marked bases show the replaced or deleted sequence." : `The insertion starts before base ${edit.start + 1}.`}</span>}
  </div>;
}

export function MutationExplorer({ sequence: controlledSequence, defaultSequence = SYNTHETIC_SEQUENCE, edit: controlledEdit,
  defaultEdit: suppliedDefaultEdit, onSequenceChange, onEditChange, onAnalysisChange, className = "", style }: MutationExplorerProps) {
  const id = useId();
  const defaultEdit = suppliedDefaultEdit ?? (controlledSequence === undefined && defaultSequence === SYNTHETIC_SEQUENCE
    ? EXAMPLE_EDITS[1].edit : { start: 0, deleteCount: 0, insert: "" });
  const [internalSequence, setInternalSequence] = useState(defaultSequence);
  const [internalEdit, setInternalEdit] = useState<CodingEdit>({ ...defaultEdit });
  const sequence = controlledSequence ?? internalSequence;
  const edit = controlledEdit ?? internalEdit;
  const [mode, setMode] = useState<EditMode>(() => modeFor(edit));
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(6);
  const [exportMessage, setExportMessage] = useState("");
  const compare = useRef<HTMLDivElement>(null);
  const callback = useRef(onAnalysisChange);
  const lastEditRequest = useRef<{ edit: CodingEdit; mode: EditMode } | null>(null);
  callback.current = onAnalysisChange;
  const normalized = compact(sequence);
  const result = useMemo(() => {
    try { return { analysis: analyzeCodingEdit(sequence, edit), error: "" }; }
    catch (error) { return { analysis: null, error: error instanceof Error ? error.message : "The sequence or edit is invalid." }; }
  }, [sequence, edit.start, edit.deleteCount, edit.insert]);
  const analysis = result.analysis;
  useEffect(() => { callback.current?.(analysis); }, [analysis]);
  useEffect(() => {
    if (controlledEdit === undefined) return;
    const request = lastEditRequest.current;
    const acceptedMode = request && sameEdit(request.edit, edit) ? request.mode : modeFor(edit);
    if (mode !== acceptedMode) setMode(acceptedMode);
  });
  useEffect(() => {
    const element = compare.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(entries => {
      const width = entries[0]?.contentRect.width ?? 800;
      setPageSize(Math.max(3, Math.min(12, Math.floor((width - 84) / 66))));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => { setPage(Math.floor(Math.floor(edit.start / 3) / pageSize)); }, [edit.start, pageSize]);
  const totalCodons = Math.max(1, Math.ceil(Math.max(analysis?.reference.dna.length ?? normalized.length, analysis?.edited.dna.length ?? 0) / 3));
  const pageCount = Math.ceil(totalCodons / pageSize);
  const safePage = Math.min(page, pageCount - 1);
  const firstCodon = safePage * pageSize;
  const count = Math.min(pageSize, totalCodons - firstCodon);
  const selected = Math.max(0, Math.min(normalized.length, edit.start));
  const activeExample = normalized === SYNTHETIC_SEQUENCE ? EXAMPLE_EDITS.find(example => sameEdit(example.edit, edit)) : undefined;
  const updateEdit = (next: CodingEdit, nextMode = mode) => {
    lastEditRequest.current = { edit: next, mode: nextMode };
    if (controlledEdit === undefined) { setInternalEdit(next); setMode(nextMode); }
    onEditChange?.(next);
    setExportMessage("");
  };
  const updateSequence = (next: string) => {
    if (controlledSequence === undefined) setInternalSequence(next);
    onSequenceChange?.(next);
    if (mode === "none") updateEdit({ start: 0, deleteCount: 0, insert: "" }, "none");
    setExportMessage("");
  };
  const selectPosition = (position: number) => {
    const start = Math.max(0, Math.min(normalized.length - (mode === "insert" ? 0 : 1), position));
    updateEdit({ ...edit, start, deleteCount: Math.min(edit.deleteCount, Math.max(0, normalized.length - start)) });
  };
  const changeMode = (next: EditMode) => {
    setMode(next);
    if (next === "none") { updateEdit({ start: 0, deleteCount: 0, insert: "" }, next); return; }
    const start = Math.min(edit.start, Math.max(0, normalized.length - (next === "insert" ? 0 : 1)));
    updateEdit({ start, deleteCount: next === "insert" ? 0 : Math.min(Math.max(1, edit.deleteCount), normalized.length - start), insert: next === "delete" ? "" : edit.insert || "A" }, next);
  };
  const useExample = (example: ExampleEdit) => { setMode(modeFor(example.edit)); updateSequence(SYNTHETIC_SEQUENCE); updateEdit({ ...example.edit }, modeFor(example.edit)); };
  const reset = () => { setMode(modeFor(defaultEdit)); updateSequence(defaultSequence); updateEdit({ ...defaultEdit }, modeFor(defaultEdit)); setPage(0); };
  const exportResult = (format: "dna" | "protein" | "json") => {
    if (!analysis) return;
    if (format === "dna") download("edited-dna.fasta", fasta("edited-coding-dna", analysis.edited.dna));
    if (format === "protein") download("edited-protein.fasta", fasta("edited-protein", analysis.edited.protein.replace(/\*$/, "")));
    if (format === "json") download("coding-edit.json", `${JSON.stringify(analysis, null, 2)}\n`, "application/json");
    setExportMessage(`${format === "json" ? "Analysis" : format === "dna" ? "Edited DNA" : "Protein sequence"} export is ready.`);
  };
  return <section className={`dme-explorer ${className}`.trim()} style={style} aria-label="DNA mutation explorer">
    <div className="dme-examples">
      <span className="dme-section-label">Try an edit</span>
      <div className="dme-example-buttons">{EXAMPLE_EDITS.map(example => <button type="button" key={example.id}
        aria-pressed={activeExample?.id === example.id} onClick={() => useExample(example)}>{example.label}</button>)}</div>
      <p>{activeExample?.description ?? "Select a reference base to move the edit. Change the edit with the controls."}</p>
    </div>

    <div className="dme-comparison" ref={compare}>
      <div className="dme-comparison-heading"><h2>Sequence comparison</h2><span>Standard genetic code · frame starts at base 1</span></div>
      {analysis ? <>
        <DnaHelix sequence={analysis.reference.dna} selected={selected} />
        <SequenceTrack translation={analysis.reference} reference={analysis.reference} edit={analysis.edit} edited={false}
          firstCodon={firstCodon} count={count} selected={selected} onSelect={selectPosition} />
        <SequenceTrack translation={analysis.edited} reference={analysis.reference} edit={analysis.edit} edited={true}
          firstCodon={firstCodon} count={count} selected={selected} onSelect={selectPosition} />
        <div className="dme-window-controls">
          <span>Codons {firstCodon + 1}–{firstCodon + count} of {totalCodons}</span>
          <div><button type="button" onClick={() => setPage(Math.max(0, safePage - 1))} disabled={safePage === 0}>Previous</button>
            <button type="button" onClick={() => setPage(Math.min(pageCount - 1, safePage + 1))} disabled={safePage === pageCount - 1}>Next</button></div>
        </div>
      </> : <div className="dme-empty"><p>Correct the sequence or edit to compare the result.</p><p>DNA, RNA codons, and amino acids will appear here.</p></div>}
    </div>

    <div className="dme-workspace">
      <div className="dme-input-sequence">
        <label className="dme-section-label" htmlFor={`${id}-sequence`}>Reference coding DNA</label>
        <textarea id={`${id}-sequence`} spellCheck={false} autoCapitalize="characters" autoCorrect="off" rows={3} maxLength={65000}
          value={sequence} onChange={event => updateSequence(event.target.value)} aria-describedby={`${id}-sequence-note ${result.error ? `${id}-error` : ""}`} aria-invalid={Boolean(result.error)} />
        <p id={`${id}-sequence-note`}>{normalized === SYNTHETIC_SEQUENCE ? "Synthetic example. " : "Custom sequence. "}Enter coding-strand DNA in the 5′ → 3′ direction. Spaces and line breaks are allowed.</p>
        <button type="button" className="dme-text-button" onClick={reset}>Reset example</button>
      </div>
      <fieldset className="dme-edit-controls">
        <legend className="dme-section-label">Edit the sequence</legend>
        <label htmlFor={`${id}-type`}>Edit type<select id={`${id}-type`} value={mode} onChange={event => changeMode(event.target.value as EditMode)}>
          <option value="none">No edit</option><option value="replace">Replace bases</option><option value="insert">Insert bases</option><option value="delete">Delete bases</option>
        </select></label>
        <label htmlFor={`${id}-position`}>{mode === "none" ? "Selected base" : mode === "insert" ? "Insert before base" : "Start at base"}<input id={`${id}-position`} type="number" min={1}
          max={Math.max(1, normalized.length + (mode === "insert" ? 1 : 0))} step={1} value={edit.start + 1} disabled={!normalized.length && mode === "none"}
          onChange={event => updateEdit({ ...edit, start: Number(event.target.value) - 1 })} /></label>
        {mode !== "insert" && mode !== "none" && <label htmlFor={`${id}-count`}>{mode === "delete" ? "Bases to delete" : "Bases to replace"}<input id={`${id}-count`} type="number" min={1} step={1}
          max={Math.max(1, normalized.length - edit.start)} value={edit.deleteCount}
          onChange={event => updateEdit({ ...edit, deleteCount: Number(event.target.value) })} /></label>}
        {mode !== "delete" && mode !== "none" && <label htmlFor={`${id}-insert`}>New bases<input id={`${id}-insert`} type="text" spellCheck={false} autoCapitalize="characters" maxLength={30000}
          value={edit.insert} onChange={event => updateEdit({ ...edit, insert: event.target.value.toUpperCase() })} /></label>}
        <p className="dme-field-note">Positions start at 1. The edit uses reference positions.</p>
      </fieldset>
    </div>
    {result.error && <p className="dme-error" id={`${id}-error`} role="alert">{result.error}</p>}

    <div className="dme-result" role="status" aria-live="polite" aria-atomic="true">
      <div><span className="dme-section-label">Sequence consequence</span><h2>{analysis ? consequenceNames[analysis.consequence] ?? analysis.consequence : "No result"}</h2>
        <p>{analysis?.summary ?? "Correct the input to calculate a sequence consequence."}</p></div>
      {analysis && <dl><div><dt>Length change</dt><dd>{analysis.lengthDelta > 0 ? "+" : ""}{analysis.lengthDelta} bases</dd></div>
        <div><dt>Reference protein</dt><dd>{analysis.reference.protein.replace(/\*/g, "").length} amino acids</dd></div>
        <div><dt>Edited protein</dt><dd>{analysis.edited.protein.replace(/\*/g, "").length} amino acids</dd></div></dl>}
    </div>
    {analysis && analysis.warnings.length > 0 && <ul className="dme-notes">{analysis.warnings.map((warning, index) => <li key={`${warning}-${index}`}>{warning}</li>)}</ul>}
    <div className="dme-export"><span className="dme-section-label">Export</span><div>
      <button type="button" disabled={!analysis} onClick={() => exportResult("dna")}>DNA FASTA</button>
      <button type="button" disabled={!analysis} onClick={() => exportResult("protein")}>Protein FASTA</button>
      <button type="button" disabled={!analysis} onClick={() => exportResult("json")}>Analysis JSON</button>
    </div><span className="dme-export-status" role="status">{exportMessage}</span></div>
    <p className="dme-model-note">The model starts at the first base and stops at the first known stop codon. It does not search for genes.
      Ambiguous codons produce X. The result does not predict protein function.</p>
  </section>;
}
