"use client";

import { useEffect, useId, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { beginDnaGrab, duplexGeometry, moveDnaPointer, nearestDnaBase, releaseDnaGrab } from "../playground/engine.js";
import { DEFAULT_DAMAGE_EXPOSURES, DEFAULT_DNA_PROTECTORS, MAX_EXPOSURE_PARTICLES_PER_SECOND, SPECIES_PROFILES, createDamageLab, getDamageMetrics,
  pulseDamage, repairDamageAt, resizeDamageLab, setDamageExposures, setDamageSpecies, setDnaProtectors,
  stepDamageLab, takeDamageSnapshot } from "../playground/damage.js";
import { DEFAULT_DNA_RENDER_THEME, renderDnaDamage, type DnaRenderTheme } from "../playground/render.js";
import { ATOMIC_EXPLANATIONS, renderAtomicMechanism } from "../playground/atomic-render.js";
import type { DamageEffect, DamageExposures, DamageMetrics, DamageSnapshot, DamageWorld, DnaProtectors, SpeciesId } from "../playground/damage-types.js";

export interface DnaDamageLabProps {
  sequence?: string;
  seed?: number;
  initialSpecies?: SpeciesId;
  initialExposures?: Partial<DamageExposures>;
  initialProtectors?: Partial<DnaProtectors>;
  className?: string;
  style?: CSSProperties;
  onChange?: (snapshot: DamageSnapshot) => void;
}

type Brush = "grab" | "expose" | "repair";
const effectNames: Record<DamageEffect, string> = { uv: "UV light", xray: "X-rays", heat: "Heat", oxidants: "Oxidants", electric: "Electric field", antioxidants: "Antioxidants", repair: "Repair" };
const effectDescriptions = Object.fromEntries(Object.entries(ATOMIC_EXPLANATIONS).map(([key, value]) => [key, value.description])) as Record<DamageEffect, string>;
const brushHints: Record<Brush, string> = {
  grab: "Drag the molecule to bend and stretch it. Select a factor to see its molecular mechanism.",
  expose: "Drag over the DNA to apply the selected factor.",
  repair: "Drag over a damaged base or backbone bond to repair it."
};
const EMPTY: DamageMetrics = { activeLesions: 0, dimers: 0, singleBreaks: 0, doubleBreaks: 0, oxidizedBases: 0, openPairs: 0, repaired: 0, neutralized: 0, blocked: 0, created: 0 };

function ToolIcon({ tool }: { tool: Brush }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true">{tool === "grab"
    ? <><path d="M8 12V6a1.5 1.5 0 0 1 3 0v5-7a1.5 1.5 0 0 1 3 0v7-5a1.5 1.5 0 0 1 3 0v6-3a1.5 1.5 0 0 1 3 0v6c0 4-3 6-7 6-2 0-3-1-4-2l-4-5a1.5 1.5 0 0 1 2-2l2 2" /></>
    : tool === "expose" ? <><path d="m3 3 6 6m-5 2h6V5m3 10 3-2 2 4 3-1M10 18l3 3m2-15 3-3M4 19l3-3" /><circle cx="12" cy="12" r="2" /></>
      : <><path d="m4 20 7-7m2-2 5-5m-4-3a5 5 0 0 0 7 7M5 15l4 4M3 21l2-2" /><path d="M3 4h5M5.5 1.5v5" /></>}</svg>;
}

function DamageLegend() {
  return <div className="dnad-legend" aria-label="Damage field symbols">
    <span><svg viewBox="0 0 24 20" aria-hidden="true"><circle cx="6" cy="10" r="4" /><circle cx="18" cy="10" r="4" /><path d="M9 8h6M9 12h6" /></svg>Dimer link</span>
    <span><svg viewBox="0 0 24 20" aria-hidden="true"><path d="M1 10h7m8 0h7" /><circle cx="8" cy="10" r="2" /><circle cx="16" cy="10" r="2" /></svg>Strand break</span>
    <span><svg viewBox="0 0 24 20" aria-hidden="true"><circle cx="12" cy="10" r="6" strokeDasharray="2 3" /><circle cx="17" cy="5" r="2" /></svg>Oxidized base</span>
    <span><svg viewBox="0 0 24 20" aria-hidden="true"><circle cx="10" cy="11" r="4" /><circle cx="16" cy="5" r="1.5" className="dnad-legend-dot" /></svg>Reactive oxygen</span>
    <span><svg viewBox="0 0 24 20" aria-hidden="true"><path d="M1 10c3-12 5 12 8 0s5 12 8 0 5 12 6 0" /></svg>Radiation</span>
  </div>;
}

function describeLevel(value: number, signed: boolean, maxParticleRate?: number, zeroLabel = "Off") {
  if (value === 0) return { text: zeroLabel, announcement: zeroLabel };
  if (maxParticleRate !== undefined) {
    const rate = (value * maxParticleRate).toFixed(2);
    return { text: `${rate} particles/s`, announcement: `${rate} simulated particles per second` };
  }

  const strength = Math.abs(value).toFixed(2);
  if (signed) {
    const direction = value < 0 ? "Left" : "Right";
    return { text: `${direction} · ${strength}`, announcement: `Field points ${direction.toLowerCase()}, strength ${strength} on the model scale` };
  }

  const level = value === 1 ? "Max" : value >= .67 ? "High" : value >= .34 ? "Medium" : "Low";
  return { text: `${level} · ${strength}`, announcement: `${level}, ${strength} on the model scale` };
}

function Range({ id, label, value, signed = false, disabled = false, hint, active = false, maxParticleRate, zeroLabel, onSelect, onChange }: {
  id: string; label: string; value: number; signed?: boolean; disabled?: boolean; hint: string; active?: boolean;
  maxParticleRate?: number; zeroLabel?: string;
  onSelect: () => void; onChange: (value: number) => void;
}) {
  const shown = Math.round(value * 100) / 100;
  const level = describeLevel(shown, signed, maxParticleRate, zeroLabel);
  return <div className="dnad-range">
    <button type="button" className="dnad-factor" aria-pressed={active} title={hint} onClick={onSelect}>{label}</button>
    <input id={id} type="range" min={signed ? -1 : 0} max={1} step={.01} value={shown} disabled={disabled}
      aria-label={label} aria-describedby={`${id}-hint`} aria-valuetext={level.announcement} title={hint}
      style={{ "--dnad-progress": `${(signed ? (shown + 1) / 2 : shown) * 100}%` } as CSSProperties}
      onChange={event => onChange(event.currentTarget.valueAsNumber)} />
    <output htmlFor={id}>{level.text}</output>
    <span className="dnad-sr-only" id={`${id}-hint`}>{hint}</span>
  </div>;
}

function readTheme(element: HTMLElement): DnaRenderTheme {
  const computed = getComputedStyle(element);
  return Object.fromEntries(Object.entries(DEFAULT_DNA_RENDER_THEME).map(([key, fallback]) =>
    [key, computed.getPropertyValue(`--dnad-${key}`).trim() || fallback])) as unknown as DnaRenderTheme;
}

export function DnaDamageLab({ sequence, seed, initialSpecies = "ecoli", initialExposures, initialProtectors,
  className = "", style, onChange }: DnaDamageLabProps) {
  const id = useId();
  const defaults = useRef({ species: initialSpecies, exposures: { ...initialExposures }, protectors: { ...initialProtectors } });
  const root = useRef<HTMLElement>(null), stage = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null);
  const atomicStage = useRef<HTMLDivElement>(null), atomicCanvas = useRef<HTMLCanvasElement>(null);
  const world = useRef<DamageWorld | null>(null);
  const theme = useRef<DnaRenderTheme>({ ...DEFAULT_DNA_RENDER_THEME });
  const stableSeed = useRef<number | null>(null);
  const callback = useRef(onChange); callback.current = onChange;
  const brushRef = useRef<Brush>("grab"), effectRef = useRef<DamageEffect>("uv");
  const gesture = useRef({ down: false, lastKey: "", lastTime: 0 });
  const rememberedRepair = useRef(initialProtectors?.repair && initialProtectors.repair > 0 ? initialProtectors.repair : DEFAULT_DNA_PROTECTORS.repair);
  const [brush, setBrush] = useState<Brush>("grab"), [effect, setEffect] = useState<DamageEffect>("uv");
  const [ready, setReady] = useState(false), [paused, setPaused] = useState(false), [error, setError] = useState("");
  const [species, setSpecies] = useState<SpeciesId>(initialSpecies);
  const [exposures, setExposures] = useState<DamageExposures>({ ...DEFAULT_DAMAGE_EXPOSURES, ...initialExposures });
  const [protectors, setProtectors] = useState<DnaProtectors>({ ...DEFAULT_DNA_PROTECTORS, ...initialProtectors });
  const [metrics, setMetrics] = useState<DamageMetrics>({ ...EMPTY });
  const [message, setMessage] = useState(""), [selection, setSelection] = useState("");
  const profile = SPECIES_PROFILES.find(item => item.id === species) ?? SPECIES_PROFILES[0];
  const actions = useRef({ draw: () => {}, publish: (_force = true) => {}, toggle: () => {}, reset: () => {}, pulse: () => {},
    exposure: (_values: Partial<DamageExposures>) => {}, protection: (_values: Partial<DnaProtectors>) => {}, species: (_value: SpeciesId) => {} });

  useEffect(() => {
    setReady(false); setError("");
    const surface = canvas.current, field = stage.current, atomic = atomicCanvas.current, atomicField = atomicStage.current;
    if (!surface || !field || !atomic || !atomicField) return;
    const ctx = surface.getContext("2d"), atomCtx = atomic.getContext("2d");
    if (!ctx || !atomCtx) { setError("This browser cannot show the molecular canvases."); return; }
    if (stableSeed.current === null) stableSeed.current = seed ?? crypto.getRandomValues(new Uint32Array(1))[0];
    const options = () => ({ ...defaults.current, sequence, seed: seed ?? stableSeed.current! });
    let state: DamageWorld;
    try { state = createDamageLab(Math.max(240, field.clientWidth), Math.max(360, field.clientHeight), options()); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "The DNA sample is invalid."); world.current = null; return; }
    world.current = state;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    state.dna.paused = motion.matches; setPaused(state.dna.paused);
    theme.current = readTheme(root.current!);
    let frame = 0, last = 0, published = 0, pointerPublished = 0, lastSnapshot = "", visible = true;
    function draw() {
      renderDnaDamage(ctx!, state, theme.current);
      renderAtomicMechanism(atomCtx!, atomicField!.clientWidth, atomicField!.clientHeight, state, effectRef.current, theme.current);
    }
    function publish(force = true) {
      const now = performance.now();
      if (!force && now - pointerPublished < 100) return;
      pointerPublished = now;
      const measured = getDamageMetrics(state);
      setMetrics(previous => (Object.keys(measured) as Array<keyof DamageMetrics>).every(key => previous[key] === measured[key]) ? previous : measured);
      setExposures(previous => (Object.keys(state.exposures) as Array<keyof DamageExposures>).every(key => previous[key] === state.exposures[key]) ? previous : { ...state.exposures });
      setProtectors(previous => (Object.keys(state.protectors) as Array<keyof DnaProtectors>).every(key => previous[key] === state.protectors[key]) ? previous : { ...state.protectors });
      setSpecies(state.species); setMessage(state.message);
      const index = state.dna.selected.index;
      setSelection(`Pair ${index + 1}: ${state.dna.parent.bases[index]} · ${state.dna.parent.partners[index]}`);
      surface!.dataset.lesions = String(measured.activeLesions);
      surface!.dataset.effect = effectRef.current;
      const snapshot = takeDamageSnapshot(state), key = JSON.stringify(snapshot);
      if (key !== lastSnapshot) { lastSnapshot = key; callback.current?.(snapshot); }
    }
    function stop() { cancelAnimationFrame(frame); frame = 0; last = 0; surface!.dataset.running = "false"; }
    function tick(time: number) {
      frame = 0;
      if (state.dna.paused || !visible || document.hidden) { stop(); return; }
      stepDamageLab(state, last ? Math.min((time - last) / 1000, 1 / 30) : 1 / 60);
      last = time; draw();
      if (time - published > 180) { publish(); published = time; }
      frame = requestAnimationFrame(tick);
    }
    function run() { if (!frame && !state.dna.paused && visible && !document.hidden) { last = 0; surface!.dataset.running = "true"; frame = requestAnimationFrame(tick); } }
    function clearPointer() { releaseDnaGrab(state.dna); state.dna.pointer.active = false; gesture.current = { down: false, lastKey: "", lastTime: 0 }; surface!.dataset.dragging = "false"; }
    function invalidate() { draw(); publish(); run(); }
    function resize() {
      clearPointer();
      const width = Math.max(240, field!.clientWidth), height = Math.max(360, field!.clientHeight);
      const ratio = Math.min(devicePixelRatio || 1, 1.75), atomRatio = Math.min(ratio, 1.5);
      surface!.width = Math.round(width * ratio); surface!.height = Math.round(height * ratio); ctx!.setTransform(ratio, 0, 0, ratio, 0, 0);
      atomic!.width = Math.round(atomicField!.clientWidth * atomRatio); atomic!.height = Math.round(atomicField!.clientHeight * atomRatio); atomCtx!.setTransform(atomRatio, 0, 0, atomRatio, 0, 0);
      resizeDamageLab(state, width, height); draw();
    }
    actions.current = {
      draw, publish,
      toggle: () => { state.dna.paused = !state.dna.paused; setPaused(state.dna.paused); if (state.dna.paused) stop(); else run(); invalidate(); },
      reset: () => {
        const wasPaused = state.dna.paused; clearPointer(); state = createDamageLab(state.dna.width, state.dna.height, options());
        state.dna.paused = wasPaused; state.selectedEffect = effectRef.current; world.current = state; invalidate();
      },
      pulse: () => { pulseDamage(state, effectRef.current); invalidate(); },
      exposure: values => { setDamageExposures(state, values); invalidate(); },
      protection: values => { setDnaProtectors(state, values); invalidate(); },
      species: value => { setDamageSpecies(state, value); invalidate(); }
    };
    function visibility() { if (document.hidden) { clearPointer(); stop(); } else run(); }
    function motionChange() { if (motion.matches) { clearPointer(); state.dna.paused = true; setPaused(true); stop(); invalidate(); } }
    const sizes = new ResizeObserver(resize); sizes.observe(field); sizes.observe(atomicField);
    const observer = new IntersectionObserver(entries => { visible = entries[0]?.isIntersecting ?? true; if (visible) { draw(); run(); } else { clearPointer(); stop(); } }, { rootMargin: "80px" });
    observer.observe(root.current!);
    document.addEventListener("visibilitychange", visibility); motion.addEventListener("change", motionChange);
    resize(); publish(); run(); setReady(true);
    return () => { stop(); clearPointer(); sizes.disconnect(); observer.disconnect(); document.removeEventListener("visibilitychange", visibility); motion.removeEventListener("change", motionChange); world.current = null; };
  }, [sequence, seed]);

  useEffect(() => { if (root.current) { theme.current = readTheme(root.current); actions.current.draw(); } }, [className, style]);
  const selectEffect = (next: DamageEffect) => { effectRef.current = next; setEffect(next); if (world.current) world.current.selectedEffect = next; actions.current.draw(); };
  const chooseBrush = (next: Brush) => { brushRef.current = next; setBrush(next); if (next === "repair") selectEffect("repair"); actions.current.draw(); };
  const expose = (key: keyof DamageExposures, value: number) => { selectEffect(key); actions.current.exposure({ [key]: value }); };
  const protect = (key: keyof DnaProtectors, value: number, mechanism: DamageEffect) => { selectEffect(mechanism); actions.current.protection({ [key]: value }); };
  const coordinates = (event: ReactPointerEvent<HTMLCanvasElement>) => { const rect = event.currentTarget.getBoundingClientRect(); return { x: event.clientX - rect.left, y: event.clientY - rect.top }; };
  const selectAt = (x: number, y: number) => {
    const state = world.current; if (!state) return null;
    const hit = nearestDnaBase(state.dna, x, y); if (hit) state.dna.selected = { kind: hit.kind, index: hit.index }; return hit;
  };
  const applyBrush = (x: number, y: number) => {
    const state = world.current; if (!state) return;
    if (brushRef.current === "repair") {
      const key = `repair-${Math.round(x / 12)}-${Math.round(y / 12)}`, now = performance.now();
      if (gesture.current.lastKey === key && now - gesture.current.lastTime < 150) return;
      gesture.current.lastKey = key; gesture.current.lastTime = now;
      repairDamageAt(state, x, y);
      return;
    }
    const hit = selectAt(x, y); if (!hit) return;
    const key = `${brushRef.current}-${effectRef.current}-${hit.index}`, now = performance.now();
    if (gesture.current.lastKey === key && now - gesture.current.lastTime < 150) return;
    gesture.current.lastKey = key; gesture.current.lastTime = now;
    if (brushRef.current === "expose") pulseDamage(state, effectRef.current, { x, y });
  };
  const pointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const state = world.current; if (!state || event.button !== 0) return;
    const point = coordinates(event); event.currentTarget.focus({ preventScroll: true });
    gesture.current = { down: true, lastKey: "", lastTime: 0 };
    const hit = selectAt(point.x, point.y); moveDnaPointer(state.dna, point.x, point.y); state.dna.pointer.down = true;
    if (brushRef.current === "grab") {
      beginDnaGrab(state.dna, point.x, point.y);
      const lesion = hit && state.lesions.find(item => item.index === hit.index);
      if (lesion) selectEffect(lesion.kind === "dimer" ? "uv" : lesion.kind === "oxidized" ? "oxidants" : "xray");
    } else applyBrush(point.x, point.y);
    event.currentTarget.setPointerCapture(event.pointerId); event.currentTarget.dataset.dragging = "true";
    actions.current.draw(); actions.current.publish();
  };
  const pointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const state = world.current; if (!state) return; const point = coordinates(event);
    moveDnaPointer(state.dna, point.x, point.y); if (!state.dna.held) selectAt(point.x, point.y);
    if (gesture.current.down && brushRef.current !== "grab") applyBrush(point.x, point.y);
    if (state.dna.paused || gesture.current.down) actions.current.draw(); actions.current.publish(false);
  };
  const release = () => { if (world.current) { releaseDnaGrab(world.current.dna); world.current.dna.pointer.active = false; } gesture.current = { down: false, lastKey: "", lastTime: 0 }; if (canvas.current) canvas.current.dataset.dragging = "false"; };

  const range = (key: keyof DamageExposures, label: string, hint: string) => <Range id={`${id}-${key}`} label={label} value={exposures[key]} signed={key === "electric"}
    maxParticleRate={key === "uv" || key === "xray" || key === "oxidants" ? MAX_EXPOSURE_PARTICLES_PER_SECOND[key] : undefined}
    zeroLabel={key === "heat" ? "Baseline" : undefined}
    hint={hint} active={effect === key} disabled={!ready} onSelect={() => selectEffect(key)} onChange={value => expose(key, value)} />;
  const protector = (key: keyof DnaProtectors, label: string, hint: string, mechanism: DamageEffect, disabled = false) => <Range id={`${id}-${key}`} label={label} value={protectors[key]}
    hint={hint} active={effect === mechanism} disabled={!ready || disabled} onSelect={() => selectEffect(mechanism)} onChange={value => protect(key, value, mechanism)} />;

  return <section className={`dnad-lab ${className}`.trim()} style={style} ref={root} aria-label="DNA damage and protection lab">
    <div className="dnad-grid">
      <div className="dnad-field">
        <div className="dnad-toolbar"><div role="group" aria-label="Molecular tools" className="dnad-brushes">
          {(["grab", "expose", "repair"] as const).map(tool => <button key={tool} type="button" disabled={!ready} aria-pressed={brush === tool}
            title={brushHints[tool]} onClick={() => chooseBrush(tool)}><ToolIcon tool={tool} />{tool === "grab" ? "Grab" : tool === "expose" ? "Expose" : "Repair"}</button>)}
        </div><div className="dnad-view-actions"><button type="button" disabled={!ready} aria-label={paused ? "Resume motion" : "Pause motion"} onClick={() => actions.current.toggle()}>
          <svg viewBox="0 0 24 24" aria-hidden="true">{paused ? <path d="m9 5 10 7-10 7Z" /> : <path d="M8 5v14M16 5v14" />}</svg></button>
          <button type="button" disabled={!ready} onClick={() => actions.current.reset()}>Reset</button></div></div>
        <p className="dnad-tool-hint" id={`${id}-tool`}>{brushHints[brush]}</p>
        <div className="dnad-stage" ref={stage}><canvas ref={canvas} role="application" tabIndex={0} data-brush={brush}
          aria-label="DNA damage field. Drag to bend the molecule. Expose adds the selected factor. Repair corrects a nearby lesion."
          aria-describedby={`${id}-tool ${id}-keys`} onPointerDown={pointerDown} onPointerMove={pointerMove}
          onPointerUp={event => { release(); if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); actions.current.draw(); actions.current.publish(); }}
          onPointerCancel={release} onLostPointerCapture={release} onBlur={release}
          onPointerLeave={() => { if (!gesture.current.down && world.current) { world.current.dna.pointer.active = false; actions.current.draw(); } }}
          onKeyDown={event => {
            const state = world.current; if (!state) return; const dna = state.dna, key = event.key.toLowerCase();
            if (["g", "e", "r"].includes(key)) { event.preventDefault(); chooseBrush(key === "g" ? "grab" : key === "e" ? "expose" : "repair"); }
            if (event.key === "Enter") { event.preventDefault(); actions.current.toggle(); }
            if (event.key === "Escape") release();
            if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
              event.preventDefault();
              if (dna.held) moveDnaPointer(dna, dna.pointer.x + (event.key === "ArrowLeft" ? -18 : event.key === "ArrowRight" ? 18 : 0), dna.pointer.y + (event.key === "ArrowUp" ? -18 : event.key === "ArrowDown" ? 18 : 0));
              else dna.selected.index = Math.max(0, Math.min(dna.parent.bases.length - 1, dna.selected.index + (event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1)));
              actions.current.draw(); actions.current.publish();
            }
            if (event.key === " ") {
              event.preventDefault(); const point = duplexGeometry(dna, "parent")[dna.selected.index]; if (!point) return;
              if (brushRef.current === "grab") { if (dna.held) releaseDnaGrab(dna); else beginDnaGrab(dna, point.a.x, point.a.y); }
              else if (brushRef.current === "expose") pulseDamage(state, effectRef.current, point.a);
              else {
                const next = duplexGeometry(dna, "parent")[dna.selected.index + 1];
                const targets = [point.a, point.b];
                if (next) targets.push(
                  { x: (point.a.x + next.a.x) / 2, y: (point.a.y + next.a.y) / 2, z: 0 },
                  { x: (point.b.x + next.b.x) / 2, y: (point.b.y + next.b.y) / 2, z: 0 }
                );
                targets.some(target => repairDamageAt(state, target.x, target.y));
              }
              actions.current.draw(); actions.current.publish();
            }
          }} />{error && <p className="dnad-error" role="alert">{error}</p>}</div>
        <div className="dnad-field-footer"><button type="button" disabled={!ready} onClick={() => actions.current.pulse()}>Pulse {effectNames[effect]}</button>
          <span>{ready ? selection : "Select a base pair"}</span></div>
        <p className="dnad-message" role="status" aria-live="polite">{message}</p>
        <span className="dnad-sr-only" id={`${id}-keys`}>Arrows select a base pair. Space applies the tool. In Grab, Space holds or releases the DNA, and arrows pull it. Enter pauses. G selects Grab. E selects Expose. R selects Repair.</span>
      </div>

      <div className="dnad-controls dnad-controls-left">
        <fieldset><legend>Radiation</legend>
          {range("uv", "UV light", "UV can form a bond between nearby T or C bases on the same strand.")}
          {range("xray", "X-rays", "Ionizing radiation can damage bases and break the DNA backbone.")}</fieldset>
        <fieldset><legend>Heat</legend>{range("heat", "Thermal motion", "Heat increases motion and opens base pairs. An open pair is not a backbone break.")}</fieldset>
        <fieldset><legend>Electric field</legend>{range("electric", "Field strength", "The field points left or right. Negatively charged DNA moves in the opposite direction.")}</fieldset>
      </div>

      <div className="dnad-controls dnad-controls-right">
        <fieldset><legend>Chemistry</legend>{range("oxidants", "Oxidants", "Reactive oxygen species can oxidize guanine bases.")}</fieldset>
        <fieldset><legend>Protection</legend>
          {protector("antioxidants", "Antioxidants", "Antioxidants can neutralize reactive particles before they damage DNA.", "antioxidants")}
          {protector("uvFilter", "UV filter", "The filter reduces the UV exposure that reaches the DNA.", "uv")}
          {protector("xrayShield", "X-ray shield", "Shielding reduces the X-ray exposure that reaches the DNA.", "xray")}
          <div className="dnad-repair-switch"><button type="button" className="dnad-factor" aria-pressed={effect === "repair"} onClick={() => selectEffect("repair")}>Cell repair</button>
            <label><input type="checkbox" aria-label="Cell repair" disabled={!ready || species === "bare"} checked={species !== "bare" && protectors.repair > 0}
              onChange={event => { if (protectors.repair > 0) rememberedRepair.current = protectors.repair; protect("repair", event.target.checked ? rememberedRepair.current : 0, "repair"); }} />{species === "bare" ? "Absent" : protectors.repair > 0 ? "On" : "Off"}</label></div>
          {protector("repairLight", "Repair light", profile.photolyase ? "Repair light supports photolyase, an enzyme that can reverse UV dimers." : "This cell context has no photolyase. Its repair-light setting has no effect.", "repair", !profile.photolyase)}
        </fieldset>
        <fieldset><legend>Cell context</legend><label className="dnad-species" htmlFor={`${id}-species`}>Species<select id={`${id}-species`} value={species} disabled={!ready}
          onChange={event => actions.current.species(event.target.value as SpeciesId)}>{SPECIES_PROFILES.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <p className="dnad-species-note">{profile.description}</p></fieldset>
      </div>

      <div className="dnad-field-key"><DamageLegend /></div>
      <section className="dnad-readouts" aria-labelledby={`${id}-readouts`}><h2 id={`${id}-readouts`}>Readouts</h2><dl>
        {([ ["Active lesions", metrics.activeLesions], ["UV dimers", metrics.dimers], ["Single breaks", metrics.singleBreaks], ["Double breaks", metrics.doubleBreaks],
          ["Oxidized bases", metrics.oxidizedBases], ["Open pairs", metrics.openPairs], ["Repaired", metrics.repaired], ["Radicals stopped", metrics.neutralized] ] as const).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{ready ? value : "..."}</dd></div>)}
      </dl></section>

      <section className="dnad-atomic" aria-labelledby={`${id}-atomic-title`}><header><h2 id={`${id}-atomic-title`}>Inside the molecule</h2><span>{effectNames[effect]}</span></header>
        <p className="dnad-atomic-caption">Slow-motion mechanism sketch</p>
        <div className="dnad-atomic-stage" ref={atomicStage}><canvas ref={atomicCanvas} role="img" aria-label={`${effectNames[effect]} molecular mechanism. ${effectDescriptions[effect]}`} /></div>
        <p className="dnad-atomic-title">{ATOMIC_EXPLANATIONS[effect].title}</p>
        <p>{effectDescriptions[effect]}</p>
        <ol className="dnad-atomic-stages">{ATOMIC_EXPLANATIONS[effect].stages.map((stage, index) => <li key={stage}><span>{index + 1}</span>{stage}</li>)}</ol></section>
    </div>
    <p className="dnad-model-note">Particle rates count simulated emissions. Other strengths use a 0–1 model scale. Real doses and health risk are outside the model.</p>
  </section>;
}
