export type DnaBase = "A" | "C" | "G" | "T";
export type DnaBrush = "grab" | "unzip" | "mutate";
export type DuplexKind = "parent" | "daughter";

export interface DnaNode {
  x: number; y: number; vx: number; vy: number; phase: number;
  open: number; openTime: number;
}

export interface DnaDuplex {
  /** Upper strand, in 5-prime to 3-prime order. */
  bases: DnaBase[];
  /** Opposite strand in aligned, antiparallel order. */
  partners: DnaBase[];
  nodes: DnaNode[];
  /** Visible synthesized positions. All parent positions are visible. */
  copied: number;
}

export interface DnaPlayground {
  width: number; height: number; time: number; seed: number; generation: number;
  /** Internal field layout. Copy worlds use the linear layout by default. */
  layout?: "wave" | "linear";
  /** Broken parent backbone bonds between positions i and i + 1. */
  breaks?: number[];
  baseline: DnaBase[];
  parent: DnaDuplex;
  daughter: DnaDuplex | null;
  copying: boolean; copyProgress: number; copySpeed: number;
  /** A single scheduled error position, or null for an accurate copy. */
  errorAt: number | null;
  paused: boolean;
  held: { kind: DuplexKind; index: number; offsetX: number; offsetY: number } | null;
  pointer: { x: number; y: number; down: boolean; active: boolean };
  message: string;
  selected: { kind: DuplexKind; index: number };
}

export interface DnaGeometry {
  index: number;
  a: { x: number; y: number; z: number };
  b: { x: number; y: number; z: number };
  base: DnaBase; partner: DnaBase;
  open: number; mismatch: boolean; changed: boolean;
}

export interface DnaMetrics {
  basePairs: number; copied: number; mismatches: number; changes: number;
  openPairs: number; generation: number;
}

export interface DnaSnapshot extends DnaMetrics {
  sequence: string;
  copySequence: string | null;
  copyComplete: boolean;
}

export interface DnaPlaygroundOptions {
  sequence?: string;
  seed?: number;
}
