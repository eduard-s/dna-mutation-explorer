"use client";

import { useEffect, useId, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { advanceDnaGeneration, beginDnaGrab, completeDnaCopy, createDnaPlayground, duplexGeometry, getDnaMetrics,
  moveDnaPointer, mutateDnaAt, nearestDnaBase, releaseDnaGrab, repairDnaCopy, resizeDnaPlayground,
  startDnaCopy, stepDnaPlayground, unzipDnaAt } from "../playground/engine.js";
import { DEFAULT_DNA_RENDER_THEME, renderDnaPlayground, type DnaRenderTheme } from "../playground/render.js";
import type { DnaBrush, DnaMetrics, DnaPlayground as World, DnaSnapshot } from "../playground/types.js";

export interface DnaPlaygroundProps {
  sequence?: string;
  seed?: number;
  className?: string;
  style?: CSSProperties;
  onChange?: (snapshot: DnaSnapshot) => void;
}

const EMPTY_METRICS: DnaMetrics = { basePairs: 0, copied: 0, mismatches: 0, changes: 0, openPairs: 0, generation: 0 };
const brushHints: Record<DnaBrush, string> = {
  grab: "Drag a strand to stretch and bend the DNA.",
  unzip: "Drag over the pairs to separate the strands. The pairs reconnect after you release them.",
  mutate: "Tap a base to change its letter. Tap again to try another letter."
};

function ToolIcon({ tool }: { tool: DnaBrush }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true">{tool === "grab"
    ? <><path d="M8 12V6a1.5 1.5 0 0 1 3 0v5-7a1.5 1.5 0 0 1 3 0v7-5a1.5 1.5 0 0 1 3 0v6-3a1.5 1.5 0 0 1 3 0v6c0 4-3 6-7 6-2 0-3-1-4-2l-4-5a1.5 1.5 0 0 1 2-2l2 2" /></>
    : tool === "unzip" ? <><path d="M7 3v5c0 4-4 7-4 13M17 3v5c0 4 4 7 4 13M7 5h10M7 8h10M6 12l3 2m9-2-3 2M4 17l3 1m13-1-3 1" /></>
      : <><path d="M7 4c0 7 10 9 10 16M17 4c0 7-10 9-10 16M9 6h6M8 18h8" /><circle cx="12" cy="12" r="3" /><path d="m18 7 3-3m-1 5 2-2" /></>}</svg>;
}

function Info({ label, text }: { label: string; text: string }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const host = useRef<HTMLSpanElement>(null);
  const popup = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const element = popup.current;
    if (element && typeof element.showPopover === "function" && !element.matches(":popover-open")) element.showPopover();
    const place = () => {
      const button = host.current?.querySelector("button");
      if (!button || !element) return;
      const rect = button.getBoundingClientRect();
      const width = Math.min(280, innerWidth - 24);
      element.style.width = `${width}px`;
      element.style.left = `${Math.max(12, Math.min(rect.left, innerWidth - width - 12))}px`;
      const height = element.getBoundingClientRect().height;
      element.style.top = `${rect.bottom + height + 10 < innerHeight ? rect.bottom + 6 : Math.max(12, rect.top - height - 6)}px`;
    };
    const outside = (event: PointerEvent) => { if (!host.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    place();
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      if (element && typeof element.hidePopover === "function" && element.matches(":popover-open")) element.hidePopover();
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);
  return <span className="dnap-info" ref={host}><button type="button" aria-label={`Explain ${label}`} aria-expanded={open}
    aria-controls={id} aria-describedby={open ? id : undefined} onClick={() => setOpen(value => !value)}>
    <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7" /><path d="M10 9v5M10 5.6v.3" /></svg>
  </button><span ref={popup} id={id} role="tooltip" popover="manual" hidden={!open} className="dnap-tooltip">{text}</span></span>;
}

function readTheme(element: HTMLElement): DnaRenderTheme {
  const computed = getComputedStyle(element);
  return Object.fromEntries(Object.entries(DEFAULT_DNA_RENDER_THEME).map(([name, fallback]) =>
    [name, computed.getPropertyValue(`--dnap-${name}`).trim() || fallback])) as unknown as DnaRenderTheme;
}

export function DnaPlayground({ sequence, seed, className = "", style, onChange }: DnaPlaygroundProps) {
  const id = useId();
  const root = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const world = useRef<World | null>(null);
  const stableSeed = useRef<number | null>(null);
  const callback = useRef(onChange);
  callback.current = onChange;
  const theme = useRef<DnaRenderTheme>({ ...DEFAULT_DNA_RENDER_THEME });
  const brushRef = useRef<DnaBrush>("grab");
  const [brush, setBrush] = useState<DnaBrush>("grab");
  const [ready, setReady] = useState(false);
  const [paused, setPaused] = useState(false);
  const [metrics, setMetrics] = useState<DnaMetrics>({ ...EMPTY_METRICS });
  const [copyComplete, setCopyComplete] = useState(false);
  const [copying, setCopying] = useState(false);
  const [selection, setSelection] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const input = useRef<{ down: boolean; lastMutation: string | null }>({ down: false, lastMutation: null });
  const actions = useRef({ draw: () => {}, publish: (_force = true) => {}, toggle: () => {}, reset: () => {}, copy: (_error: boolean) => {},
    repair: () => {}, generation: () => {} });

  useEffect(() => {
    setReady(false);
    setError("");
    const surface = canvas.current;
    const wrapper = stage.current;
    if (!surface || !wrapper) return;
    const ctx = surface.getContext("2d");
    if (!ctx) { setError("This browser cannot show the DNA canvas."); return; }
    if (stableSeed.current === null) stableSeed.current = seed ?? crypto.getRandomValues(new Uint32Array(1))[0];
    let state: World;
    try { state = createDnaPlayground(Math.max(240, wrapper.clientWidth), Math.max(360, wrapper.clientHeight), { sequence, seed: seed ?? stableSeed.current }); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "The DNA sequence is invalid."); world.current = null; return; }
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    state.paused = motion.matches;
    setPaused(state.paused);
    world.current = state;
    theme.current = readTheme(root.current!);
    let frame = 0, last = 0, published = 0, lastPointerPublish = 0, lastSnapshot = "", visible = true;
    surface.dataset.playground = "dna";
    function draw() { renderDnaPlayground(ctx!, state, theme.current, brushRef.current); }
    function publish(force = true) {
      const now = performance.now();
      if (!force && now - lastPointerPublish < 90) return;
      lastPointerPublish = now;
      const measured = getDnaMetrics(state);
      const complete = Boolean(state.daughter && !state.copying && state.daughter.copied === state.parent.bases.length);
      setMetrics(previous => (Object.keys(measured) as Array<keyof DnaMetrics>).every(key => previous[key] === measured[key]) ? previous : measured);
      setCopyComplete(complete);
      setCopying(state.copying);
      setMessage(state.message);
      const duplex = state.selected.kind === "parent" ? state.parent : state.daughter;
      const index = state.selected.index;
      setSelection(duplex?.bases[index] && duplex.partners[index]
        ? `${state.selected.kind === "parent" ? "DNA" : "Copy"} pair ${index + 1}: ${duplex.bases[index]} · ${duplex.partners[index]}` : "Select a base pair");
      surface!.dataset.copying = String(state.copying);
      surface!.dataset.generation = String(measured.generation);
      const snapshot: DnaSnapshot = { ...measured, sequence: state.parent.bases.join(""), copySequence: state.daughter?.bases.join("") ?? null, copyComplete: complete };
      const key = JSON.stringify(snapshot);
      if (key !== lastSnapshot) { lastSnapshot = key; callback.current?.(snapshot); }
    }
    function stop() { cancelAnimationFrame(frame); frame = 0; last = 0; surface!.dataset.running = "false"; }
    function tick(time: number) {
      frame = 0;
      if (state.paused || document.hidden || !visible) { stop(); return; }
      stepDnaPlayground(state, last ? Math.min((time - last) / 1000, 1 / 30) : 1 / 60);
      last = time;
      draw();
      if (time - published > 180) { publish(); published = time; }
      frame = requestAnimationFrame(tick);
    }
    function run() {
      if (!frame && !state.paused && visible && !document.hidden) {
        last = 0;
        surface!.dataset.running = "true";
        frame = requestAnimationFrame(tick);
      }
    }
    function invalidate() { draw(); publish(); run(); }
    function clearPointer() { releaseDnaGrab(state); state.pointer.active = false; input.current = { down: false, lastMutation: null }; surface!.dataset.dragging = "false"; }
    function resize() {
      const width = Math.max(240, wrapper!.clientWidth), height = Math.max(360, wrapper!.clientHeight);
      const ratio = Math.min(devicePixelRatio || 1, 1.75);
      clearPointer();
      surface!.width = Math.round(width * ratio);
      surface!.height = Math.round(height * ratio);
      ctx!.setTransform(ratio, 0, 0, ratio, 0, 0);
      resizeDnaPlayground(state, width, height);
      draw();
    }
    actions.current = {
      draw, publish,
      toggle: () => { state.paused = !state.paused; setPaused(state.paused); if (state.paused) stop(); else run(); invalidate(); },
      reset: () => {
        const wasPaused = state.paused;
        clearPointer();
        state = createDnaPlayground(state.width, state.height, { sequence, seed: seed ?? stableSeed.current! });
        state.paused = wasPaused;
        world.current = state;
        invalidate();
      },
      copy: withError => {
        clearPointer();
        if (startDnaCopy(state, withError)) {
          if (state.paused || motion.matches) completeDnaCopy(state);
          invalidate();
        }
      },
      repair: () => { clearPointer(); repairDnaCopy(state); invalidate(); },
      generation: () => { clearPointer(); if (advanceDnaGeneration(state)) invalidate(); }
    };
    function visibility() { if (document.hidden) { clearPointer(); stop(); } else run(); }
    function motionChange() { if (motion.matches) { clearPointer(); state.paused = true; setPaused(true); stop(); invalidate(); } }
    const sizeObserver = new ResizeObserver(resize);
    sizeObserver.observe(wrapper);
    const intersection = new IntersectionObserver(entries => {
      visible = entries[0]?.isIntersecting ?? true;
      if (visible) { draw(); run(); } else { clearPointer(); stop(); }
    }, { rootMargin: "40px" });
    intersection.observe(wrapper);
    document.addEventListener("visibilitychange", visibility);
    motion.addEventListener("change", motionChange);
    resize();
    publish();
    run();
    setReady(true);
    return () => {
      stop();
      clearPointer();
      world.current = null;
      sizeObserver.disconnect();
      intersection.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      motion.removeEventListener("change", motionChange);
    };
  }, [sequence, seed]);

  useEffect(() => { if (root.current) { theme.current = readTheme(root.current); actions.current.draw(); } }, [className, style]);

  const chooseBrush = (next: DnaBrush) => { brushRef.current = next; setBrush(next); actions.current.draw(); };
  const location = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  const selectAt = (x: number, y: number) => {
    const state = world.current;
    if (!state) return null;
    const hit = nearestDnaBase(state, x, y);
    if (hit) state.selected = { kind: hit.kind, index: hit.index };
    return hit;
  };
  const applyBrush = (x: number, y: number) => {
    const state = world.current;
    if (!state) return;
    const hit = selectAt(x, y);
    if (brushRef.current === "unzip") unzipDnaAt(state, x, y);
    if (brushRef.current === "mutate" && hit) {
      const key = `${hit.kind}-${hit.index}-${hit.side}`;
      if (key !== input.current.lastMutation) { mutateDnaAt(state, x, y); input.current.lastMutation = key; }
    }
  };
  const pointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const state = world.current;
    if (!state || event.button !== 0) return;
    const point = location(event);
    event.currentTarget.focus({ preventScroll: true });
    selectAt(point.x, point.y);
    input.current = { down: true, lastMutation: null };
    moveDnaPointer(state, point.x, point.y);
    state.pointer.down = true;
    state.pointer.active = true;
    if (brushRef.current === "grab") beginDnaGrab(state, point.x, point.y);
    else applyBrush(point.x, point.y);
    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.dataset.dragging = "true";
    actions.current.draw();
    actions.current.publish();
  };
  const pointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const state = world.current;
    if (!state) return;
    const point = location(event);
    moveDnaPointer(state, point.x, point.y);
    state.pointer.active = true;
    if (!state.held) selectAt(point.x, point.y);
    if (input.current.down && brushRef.current !== "grab") applyBrush(point.x, point.y);
    if (state.paused || input.current.down) actions.current.draw();
    actions.current.publish(false);
  };
  const pointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (world.current) { releaseDnaGrab(world.current); world.current.pointer.down = false; }
    input.current = { down: false, lastMutation: null };
    event.currentTarget.dataset.dragging = "false";
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    actions.current.draw();
    actions.current.publish();
  };

  return <section className={`dnap-playground ${className}`.trim()} style={style} ref={root} aria-label="Interactive DNA playground">
    <div className="dnap-toolbar"><div className="dnap-brushes" role="group" aria-label="DNA tools">
      {(["grab", "unzip", "mutate"] as const).map(tool => <button type="button" key={tool} disabled={!ready} aria-pressed={brush === tool}
        title={brushHints[tool]} onClick={() => chooseBrush(tool)}><ToolIcon tool={tool} />{tool === "grab" ? "Grab" : tool === "unzip" ? "Unzip" : "Mutate"}</button>)}
    </div><div className="dnap-view-actions"><button type="button" disabled={!ready} onClick={() => actions.current.toggle()} aria-label={paused ? "Resume motion" : "Pause motion"}>
      <svg viewBox="0 0 24 24" aria-hidden="true">{paused ? <path d="m9 5 10 7-10 7Z" /> : <path d="M8 5v14M16 5v14" />}</svg>{paused ? "Resume" : "Pause"}</button>
      <button type="button" disabled={!ready} onClick={() => actions.current.reset()}>Reset</button></div></div>
    <p className="dnap-tool-hint" id={`${id}-tool-hint`}>{brushHints[brush]}</p>
    <div className="dnap-stage" ref={stage}>
      <canvas ref={canvas} role="application" tabIndex={0} aria-label="DNA strands. Drag to bend the DNA. Use Unzip or Mutate to change a pair."
        aria-describedby={`${id}-tool-hint ${id}-keys`} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp}
        onPointerCancel={pointerUp} onLostPointerCapture={() => {
          if (world.current) releaseDnaGrab(world.current);
          input.current = { down: false, lastMutation: null };
          if (canvas.current) canvas.current.dataset.dragging = "false";
        }} onPointerLeave={() => { if (world.current && !input.current.down) { world.current.pointer.active = false; actions.current.draw(); } }}
        onBlur={() => { if (world.current) { releaseDnaGrab(world.current); world.current.pointer.active = false; actions.current.draw(); }
          input.current = { down: false, lastMutation: null }; if (canvas.current) canvas.current.dataset.dragging = "false"; }}
        onKeyDown={event => {
          const state = world.current;
          if (!state) return;
          const key = event.key.toLowerCase();
          if (["g", "u", "m"].includes(key)) { event.preventDefault(); chooseBrush(key === "g" ? "grab" : key === "u" ? "unzip" : "mutate"); }
          if (event.key === "Enter") { event.preventDefault(); actions.current.toggle(); }
          if (event.key === "Escape") { releaseDnaGrab(state); actions.current.draw(); }
          if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
            event.preventDefault();
            if (state.held) moveDnaPointer(state, state.pointer.x + (event.key === "ArrowLeft" ? -18 : event.key === "ArrowRight" ? 18 : 0),
              state.pointer.y + (event.key === "ArrowUp" ? -18 : event.key === "ArrowDown" ? 18 : 0));
            else {
              if (event.key === "ArrowUp") state.selected.kind = "parent";
              if (event.key === "ArrowDown" && state.daughter?.copied) state.selected.kind = "daughter";
              const count = state.selected.kind === "daughter" ? state.daughter?.copied ?? 0 : state.parent.bases.length;
              state.selected.index = Math.max(0, Math.min(count - 1, state.selected.index + (event.key === "ArrowLeft" ? -1 : event.key === "ArrowRight" ? 1 : 0)));
              const point = duplexGeometry(state, state.selected.kind)[state.selected.index];
              if (point) moveDnaPointer(state, point.a.x, point.a.y);
            }
            state.pointer.active = true;
            actions.current.draw(); actions.current.publish();
          }
          if (event.key === " ") {
            event.preventDefault();
            const point = duplexGeometry(state, state.selected.kind)[state.selected.index];
            if (!point) return;
            if (brushRef.current === "grab") {
              if (state.held) releaseDnaGrab(state); else beginDnaGrab(state, point.a.x, point.a.y);
            } else if (brushRef.current === "unzip") unzipDnaAt(state, point.a.x, point.a.y);
            else mutateDnaAt(state, point.a.x, point.a.y);
            actions.current.draw(); actions.current.publish();
          }
        }} />
      {error && <p className="dnap-error" role="alert">{error}</p>}
    </div>
    <p className="dnap-key-help" id={`${id}-keys`}>Arrow keys select a pair. Space applies the tool. In Grab, Space holds or releases a strand, and arrows pull it. Enter pauses.</p>
    <div className="dnap-copy-actions" role="group" aria-label="Copy and repair DNA">
      <button type="button" disabled={!ready || copying} onClick={() => actions.current.copy(false)}>Copy DNA</button>
      <button type="button" disabled={!ready || copying} onClick={() => actions.current.copy(true)}>Copy with mistake</button>
      <button type="button" disabled={!ready || metrics.mismatches === 0} onClick={() => actions.current.repair()}>Repair copy</button>
      <button type="button" disabled={!ready || !copyComplete} onClick={() => actions.current.generation()}>Next generation</button>
    </div>
    <div className="dnap-readouts"><div className="dnap-selected"><span>{ready ? selection : "Select a base pair"}</span>
      <Info label="selected pair" text="A pairs with T. C pairs with G. A mismatch in the new copy has a clay ring." /></div>
      <dl><div><dt>Copied bases<Info label="copied bases" text="The new strand grows one base at a time. The new copy combines an original strand with a new strand." /></dt><dd>{ready ? `${metrics.copied} / ${metrics.basePairs}` : "..."}</dd></div>
        <div><dt>Mismatches<Info label="mismatches" text="A mismatch has the wrong partner in the new copy. Repair copy restores the partner from the original strand." /></dt><dd>{ready ? metrics.mismatches : "..."}</dd></div>
        <div><dt>Sequence changes<Info label="sequence changes" text="These source bases differ from the original sample. The count includes your source edits and changes from a tracked descendant." /></dt><dd>{ready ? metrics.changes : "..."}</dd></div>
        <div><dt>Generation</dt><dd>{ready ? metrics.generation : "..."}</dd></div></dl></div>
    <p className="dnap-message" role="status" aria-live="polite">{message}</p>
    <p className="dnap-model-note">Synthetic DNA. The model illustrates base pairing, copying, repair, and inheritance.</p>
  </section>;
}
