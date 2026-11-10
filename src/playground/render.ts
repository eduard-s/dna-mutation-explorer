import { duplexGeometry } from "./engine.js";
import type { DnaBase, DnaBrush, DnaGeometry, DnaPlayground, DuplexKind } from "./types.js";
import type { DamageLesion, DamageWorld } from "./damage-types.js";

export interface DnaRenderTheme {
  surface: string;
  paper: string;
  ink: string;
  accent: string;
  sage: string;
  clay: string;
}

export const DEFAULT_DNA_RENDER_THEME: Readonly<DnaRenderTheme> = Object.freeze({
  surface: "#DFE5DC", paper: "#EFF2ED", ink: "#303832", accent: "#785448", sage: "#6F897C", clay: "#A67769"
});

type Point = { x: number; y: number; z: number };
type Strand = "a" | "b";
const colors: Record<DnaBase, string> = { A: "#B79671", T: "#90A185", C: "#829D9F", G: "#B58D87" };
const sprites = new Map<string, HTMLCanvasElement>();
const mix = (a: Point, b: Point, t: number): Point => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });

function shade(color: string, multiplier: number) {
  if (!/^#[\da-f]{6}$/i.test(color)) return multiplier < 1 ? "#526357" : "#E7ECE1";
  return `rgb(${[1, 3, 5].map(start => Math.min(255, Math.round(parseInt(color.slice(start, start + 2), 16) * multiplier))).join(",")})`;
}

function atomSprite(ctx: CanvasRenderingContext2D, color: string) {
  const stored = sprites.get(color);
  if (stored) return stored;
  const canvas = ctx.canvas.ownerDocument.createElement("canvas");
  canvas.width = 56;
  canvas.height = 56;
  const paint = canvas.getContext("2d")!;
  const gradient = paint.createRadialGradient(19, 15, 1, 29, 29, 24);
  gradient.addColorStop(0, "#EFF2E8");
  gradient.addColorStop(.24, color);
  gradient.addColorStop(.75, shade(color, .86));
  gradient.addColorStop(1, shade(color, .6));
  paint.fillStyle = gradient;
  paint.beginPath();
  paint.arc(28, 28, 23, 0, Math.PI * 2);
  paint.fill();
  paint.strokeStyle = shade(color, .67);
  paint.lineWidth = .8;
  paint.stroke();
  paint.fillStyle = "rgba(241,246,234,.48)";
  paint.beginPath();
  paint.ellipse(19, 16, 5, 2.7, -.6, 0, Math.PI * 2);
  paint.fill();
  if (sprites.size > 32) sprites.clear();
  sprites.set(color, canvas);
  return canvas;
}

function atom(ctx: CanvasRenderingContext2D, point: Point, radius: number, color: string) {
  ctx.drawImage(atomSprite(ctx, color), point.x - radius, point.y - radius, radius * 2, radius * 2);
}

function curve(ctx: CanvasRenderingContext2D, previous: Point, a: Point, b: Point, next: Point) {
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.bezierCurveTo(a.x + (b.x - previous.x) / 6, a.y + (b.y - previous.y) / 6,
    b.x - (next.x - a.x) / 6, b.y - (next.y - a.y) / 6, b.x, b.y);
}

function baseHalf(ctx: CanvasRenderingContext2D, endpoint: Point, inside: Point, letter: DnaBase, label: boolean, selected: boolean, theme: DnaRenderTheme) {
  const middle = mix(endpoint, inside, .65);
  const depth = .87 + Math.max(-1, Math.min(1, endpoint.z)) * .13;
  ctx.lineWidth = 6.2 * depth;
  ctx.strokeStyle = colors[letter];
  ctx.beginPath();
  ctx.moveTo(endpoint.x, endpoint.y);
  ctx.lineTo(inside.x, inside.y);
  ctx.stroke();
  atom(ctx, mix(endpoint, inside, .16), 3.6 * depth, "#A7B49E");
  if (!label) return;
  const radius = selected ? 9.2 : 7.7;
  ctx.fillStyle = colors[letter];
  ctx.beginPath();
  ctx.arc(middle.x, middle.y, radius * depth, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = selected ? theme.accent : shade(colors[letter], .76);
  ctx.lineWidth = selected ? 1.3 : .65;
  ctx.stroke();
  ctx.fillStyle = theme.ink;
  ctx.font = `${selected ? "700 12" : "700 10"}px "Courier New", monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(letter, middle.x, middle.y + .4);
}

function pair(ctx: CanvasRenderingContext2D, geometry: DnaGeometry, selected: boolean, labels: boolean, theme: DnaRenderTheme) {
  const { a, b } = geometry;
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  if (length < 9) {
    if (selected) {
      ctx.globalAlpha = 1;
      ctx.fillStyle = theme.ink;
      ctx.font = '700 12px "Courier New", monospace';
      ctx.textAlign = "center";
      ctx.fillText(`${geometry.base} · ${geometry.partner}`, (a.x + b.x) / 2, Math.min(a.y, b.y) - 17);
    }
    return;
  }
  const open = Math.max(0, Math.min(1, geometry.open));
  const arm = Math.min(length * .42, 28 - open * 6);
  const leftInside = mix(a, b, arm / length);
  const rightInside = mix(a, b, 1 - arm / length);
  ctx.globalAlpha = selected ? 1 : .85;
  baseHalf(ctx, a, leftInside, geometry.base, labels, selected, theme);
  baseHalf(ctx, b, rightInside, geometry.partner, labels, selected, theme);
  if (open < .45) {
    ctx.strokeStyle = geometry.mismatch ? theme.accent : "#7F8B7A";
    ctx.lineWidth = geometry.mismatch ? 1.35 : .8;
    ctx.setLineDash(geometry.mismatch ? [3, 4] : [1, 2.8]);
    ctx.beginPath();
    ctx.moveTo(leftInside.x, leftInside.y);
    ctx.lineTo(rightInside.x, rightInside.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

function changeMarker(ctx: CanvasRenderingContext2D, geometry: DnaGeometry, theme: DnaRenderTheme) {
  if (geometry.mismatch || geometry.changed) {
    const { a, b } = geometry;
    ctx.strokeStyle = geometry.mismatch ? theme.accent : theme.sage;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = .85;
    for (const point of [a, b]) {
      ctx.beginPath();
      ctx.arc(point.x, point.y, geometry.mismatch ? 12 : 10, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (geometry.mismatch) {
      const center = mix(a, b, .5);
      ctx.beginPath();
      ctx.moveTo(center.x - 3.5, center.y - 3.5);
      ctx.lineTo(center.x + 3.5, center.y + 3.5);
      ctx.moveTo(center.x + 3.5, center.y - 3.5);
      ctx.lineTo(center.x - 3.5, center.y + 3.5);
      ctx.stroke();
    }
  }
}

function railColor(kind: DuplexKind, strand: Strand, theme: DnaRenderTheme) {
  if (kind === "daughter") return strand === "a" ? theme.clay : theme.sage;
  return strand === "a" ? theme.sage : "#809697";
}

function rails(ctx: CanvasRenderingContext2D, geometry: DnaGeometry[], kind: DuplexKind, front: boolean, theme: DnaRenderTheme,
  onlyStrand?: Strand, firstIndex = 0, opacity = 1, broken?: ReadonlySet<string>) {
  for (const strand of ["a", "b"] as const) {
    if (onlyStrand && strand !== onlyStrand) continue;
    const at = (index: number) => geometry[Math.max(0, Math.min(geometry.length - 1, index))][strand];
    const color = railColor(kind, strand, theme);
    for (let index = Math.max(0, firstIndex - 1); index < geometry.length - 1; index++) {
      if (broken?.has(`${kind}-${strand}-${index}`)) continue;
      const a = at(index), b = at(index + 1);
      if (((a.z + b.z) / 2 >= 0) !== front) continue;
      ctx.globalAlpha = (front ? .92 : .42) * opacity;
      curve(ctx, at(index - 1), a, b, at(index + 2));
      ctx.strokeStyle = color;
      ctx.lineWidth = front ? 4.2 : 2.6;
      ctx.stroke();
      ctx.strokeStyle = "#E7EDE0";
      ctx.globalAlpha *= .6;
      ctx.lineWidth = .7;
      ctx.stroke();
      ctx.globalAlpha = (front ? .92 : .43) * opacity;
      atom(ctx, mix(a, b, .5), front ? 3.3 : 2.6, strand === "a" ? "#A9B79F" : "#B7AA96");
    }
    for (let index = firstIndex; index < geometry.length; index++) {
      const point = at(index);
      if ((point.z >= 0) !== front) continue;
      ctx.globalAlpha = (front ? 1 : .45) * opacity;
      const terminal = index === 0 || index === geometry.length - 1;
      atom(ctx, point, (6.2 + point.z * 1.1) * (terminal ? 1.14 : 1), color);
      if (terminal) {
        ctx.globalAlpha *= .5;
        ctx.strokeStyle = color;
        ctx.lineWidth = .8;
        ctx.beginPath();
        ctx.arc(point.x, point.y, 9, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }
}

function label(ctx: CanvasRenderingContext2D, geometry: DnaGeometry[], text: string, theme: DnaRenderTheme) {
  if (!geometry.length) return;
  const center = geometry.reduce((value, point) => value + (point.a.x + point.b.x) / 2, 0) / geometry.length;
  const top = Math.max(25, Math.min(...geometry.map(point => Math.min(point.a.y, point.b.y))) - 28);
  ctx.globalAlpha = .7;
  ctx.fillStyle = theme.ink;
  ctx.font = '12px "Courier New", monospace';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, center, top);
}

function renderScene(ctx: CanvasRenderingContext2D, world: DnaPlayground, theme: DnaRenderTheme, brush: DnaBrush, lesions: readonly DamageLesion[] = [], sourceLabel = "DNA to copy") {
  ctx.clearRect(0, 0, world.width, world.height);
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const samples = (["parent", "daughter"] as const).map(kind => ({ kind, geometry: duplexGeometry(world, kind) })).filter(sample => sample.geometry.length > 0);
  const template = world.copying && world.daughter ? duplexGeometry({ ...world,
    daughter: { ...world.daughter, copied: world.daughter.bases.length } }, "daughter") : [];
  const spacing = world.width / Math.max(1, world.parent.bases.length);
  const broken = new Set<string>();
  for (const lesion of lesions) {
    if (lesion.kind === "ssb" || lesion.kind === "dsb") {
      broken.add(`parent-${lesion.strand === 0 ? "a" : "b"}-${lesion.index}`);
      if (lesion.kind === "dsb") broken.add(`parent-${lesion.strand === 0 ? "b" : "a"}-${lesion.index}`);
    }
  }
  if (template.length) rails(ctx, template, "daughter", false, theme, "b", world.daughter!.copied, .55);
  for (const sample of samples) rails(ctx, sample.geometry, sample.kind, false, theme, undefined, 0, 1, broken);
  for (const sample of samples) {
    for (const item of sample.geometry) {
      const selected = world.selected.kind === sample.kind && world.selected.index === item.index;
      pair(ctx, item, selected, spacing > 23 || selected || (spacing > 13 && item.index % 2 === 0), theme);
    }
  }
  if (template.length) rails(ctx, template, "daughter", true, theme, "b", world.daughter!.copied, .55);
  for (const sample of samples) rails(ctx, sample.geometry, sample.kind, true, theme, undefined, 0, 1, broken);
  for (const sample of samples) {
    for (const point of sample.geometry) changeMarker(ctx, point, theme);
    if (sample.kind === "parent" || !template.length) label(ctx, sample.geometry, sample.kind === "parent" ? sourceLabel : "New copy", theme);
    const selected = sample.geometry.find(point => world.selected.kind === sample.kind && world.selected.index === point.index);
    if (selected) {
      ctx.globalAlpha = .45;
      ctx.strokeStyle = theme.accent;
      ctx.lineWidth = .9;
      for (const point of [selected.a, selected.b]) {
        ctx.beginPath();
        ctx.arc(point.x, point.y, 14, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }
  if (template.length) label(ctx, template, "New copy", theme);
  if (world.copying) {
    const daughter = samples.find(sample => sample.kind === "daughter")?.geometry;
    const last = daughter?.[daughter.length - 1];
    if (last) {
      const center = mix(last.a, last.b, .5);
      ctx.globalAlpha = .8;
      ctx.strokeStyle = theme.clay;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(center.x, center.y, 21, -.6, Math.PI * 1.3);
      ctx.stroke();
      atom(ctx, { x: center.x + 17, y: center.y - 11, z: 1 }, 5, theme.clay);
    }
  }
  if (world.pointer.active && brush !== "grab") {
    ctx.globalAlpha = .22;
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 4]);
    ctx.beginPath();
    ctx.arc(world.pointer.x, world.pointer.y, brush === "unzip" ? 27 : 18, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

/** Draw the source duplex and the visible prefix of its copy. */
export function renderDnaPlayground(ctx: CanvasRenderingContext2D, world: DnaPlayground, theme: DnaRenderTheme = DEFAULT_DNA_RENDER_THEME, brush: DnaBrush = "grab") {
  renderScene(ctx, world, theme, brush);
}

function lesionPoint(point: DnaGeometry, strand: 0 | 1): Point {
  return mix(point.a, point.b, strand === 0 ? .27 : .73);
}

function damageMarks(ctx: CanvasRenderingContext2D, world: DamageWorld, theme: DnaRenderTheme) {
  const geometry = duplexGeometry(world.dna, "parent");
  for (const lesion of world.lesions) {
    const current = geometry[lesion.index], next = geometry[lesion.index + 1];
    if (!current) continue;
    ctx.globalAlpha = .95;
    if (lesion.kind === "dimer" && next) {
      const a = lesionPoint(current, lesion.strand), b = lesionPoint(next, lesion.strand);
      const dx = b.x - a.x, dy = b.y - a.y, length = Math.max(1, Math.hypot(dx, dy));
      const nx = -dy / length * 2, ny = dx / length * 2;
      ctx.strokeStyle = theme.accent;
      ctx.lineWidth = 2.2;
      for (const sign of [-1, 1]) {
        ctx.beginPath(); ctx.moveTo(a.x + nx * sign, a.y + ny * sign); ctx.lineTo(b.x + nx * sign, b.y + ny * sign); ctx.stroke();
      }
      for (const point of [a, b]) {
        ctx.beginPath(); ctx.arc(point.x, point.y, 11, 0, Math.PI * 2); ctx.strokeStyle = theme.clay; ctx.lineWidth = 1.3; ctx.stroke();
      }
    } else if ((lesion.kind === "ssb" || lesion.kind === "dsb") && next) {
      const strands = lesion.kind === "dsb" ? ["a", "b"] as const : [lesion.strand === 0 ? "a" : "b"] as const;
      for (const strand of strands) {
        const a = current[strand], b = next[strand];
        const left = mix(a, b, .32), right = mix(a, b, .68);
        ctx.strokeStyle = theme.clay; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(left.x, left.y); ctx.moveTo(right.x, right.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        atom(ctx, left, 4.7, theme.clay); atom(ctx, right, 4.7, theme.clay);
        const center = mix(a, b, .5);
        ctx.strokeStyle = theme.accent; ctx.lineWidth = 1.1;
        ctx.beginPath(); ctx.arc(center.x, center.y, 10, -.5, 2.6); ctx.stroke();
      }
    } else if (lesion.kind === "oxidized") {
      const point = lesionPoint(current, lesion.strand);
      ctx.strokeStyle = theme.accent; ctx.lineWidth = 1.5; ctx.setLineDash([2, 3]);
      ctx.beginPath(); ctx.arc(point.x, point.y, 13, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      const angle = world.dna.time * .35 + lesion.index;
      atom(ctx, { x: point.x + Math.cos(angle) * 15, y: point.y + Math.sin(angle) * 15, z: 1 }, 4.5, theme.clay);
    }
  }
}

function damageParticles(ctx: CanvasRenderingContext2D, world: DamageWorld, theme: DnaRenderTheme) {
  for (const particle of world.particles) {
    const opacity = Math.max(0, Math.min(1, (particle.life - particle.age) / .4));
    if (!opacity) continue;
    ctx.globalAlpha = opacity * (particle.absorbed ? .35 : .8);
    if (particle.kind === "uv" || particle.kind === "xray") {
      ctx.globalAlpha = opacity * (particle.absorbed ? .35 : .96);
      const speed = Math.max(1, Math.hypot(particle.vx, particle.vy));
      const ux = particle.vx / speed, uy = particle.vy / speed;
      ctx.strokeStyle = particle.kind === "uv" ? theme.accent : "#567985";
      ctx.lineWidth = particle.kind === "uv" ? 1.8 : 1.5;
      ctx.beginPath();
      for (let index = 0; index <= 24; index++) {
        const distance = index * 1.7, wave = Math.sin(index * .75) * 3.4;
        const x = particle.x - ux * distance - uy * wave, y = particle.y - uy * distance + ux * wave;
        if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
      atom(ctx, { x: particle.x, y: particle.y, z: 1 }, 3.2, particle.kind === "uv" ? theme.clay : "#8BA3AD");
    } else if (particle.kind === "radical") {
      ctx.globalAlpha = opacity * (particle.absorbed ? .35 : .94);
      atom(ctx, { x: particle.x, y: particle.y, z: 1 }, 5, particle.absorbed ? theme.sage : theme.clay);
      ctx.strokeStyle = particle.absorbed ? theme.sage : theme.accent; ctx.lineWidth = 1.1;
      ctx.beginPath(); ctx.arc(particle.x, particle.y, 7.5, .3, 4.6); ctx.stroke();
      ctx.fillStyle = theme.accent; ctx.beginPath(); ctx.arc(particle.x + 5, particle.y - 5, 1.8, 0, Math.PI * 2); ctx.fill();
    } else if (particle.kind === "electron") {
      ctx.fillStyle = "#668691"; ctx.beginPath(); ctx.arc(particle.x, particle.y, 2.6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#668691"; ctx.lineWidth = .8; ctx.beginPath(); ctx.moveTo(particle.x - 3, particle.y - 5); ctx.lineTo(particle.x + 3, particle.y - 5); ctx.stroke();
    } else {
      atom(ctx, { x: particle.x, y: particle.y, z: 1 }, 5.6, theme.sage);
    }
  }
}

/** Draw damage on the corresponding bases and backbone bonds. */
export function renderDnaDamage(ctx: CanvasRenderingContext2D, world: DamageWorld, theme: DnaRenderTheme = DEFAULT_DNA_RENDER_THEME) {
  renderScene(ctx, world.dna, theme, "grab", world.lesions, "DNA sample");
  ctx.save();
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  damageMarks(ctx, world, theme);
  damageParticles(ctx, world, theme);
  if (Math.abs(world.exposures.electric) > .03) {
    const direction = Math.sign(world.exposures.electric);
    ctx.globalAlpha = .35; ctx.strokeStyle = theme.accent; ctx.lineWidth = 1;
    for (const fraction of [.27, .5, .73]) {
      const x = world.dna.width * fraction, y = world.dna.height - 22;
      ctx.beginPath(); ctx.moveTo(x - direction * 20, y); ctx.lineTo(x + direction * 20, y);
      ctx.moveTo(x + direction * 15, y - 4); ctx.lineTo(x + direction * 20, y); ctx.lineTo(x + direction * 15, y + 4); ctx.stroke();
    }
  }
  ctx.restore();
}
