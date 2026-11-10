import type { DamageEffect, DamageWorld } from "./damage-types.js";
import { DEFAULT_DNA_RENDER_THEME, type DnaRenderTheme } from "./render.js";
import { SPECIES_PROFILES } from "./damage.js";

export const ATOMIC_EXPLANATIONS: Readonly<Record<DamageEffect, { title: string; description: string; stages: readonly string[] }>> = Object.freeze({
  uv: { title: "UV: an excited electron can start a new bond", description: "Ultraviolet (UV) light can excite electrons in neighboring C or T bases. Some excited pairs form abnormal covalent bonds on the same strand.", stages: ["UV absorbed", "Electron excitation", "Neighboring bases join"] },
  xray: { title: "X-rays: ionization and reactive water", description: "An X-ray can eject an electron. Reactive products from water can then damage a base or break the DNA backbone.", stages: ["Water absorbs energy", "Electron ejected", "Reactive products reach DNA"] },
  heat: { title: "Heat: more motion, separated strands", description: "Heat changes base pairing and stacking stability. The strands can separate while their covalent backbones remain intact.", stages: ["Thermal motion", "Pairing becomes unstable", "Strands separate"] },
  oxidants: { title: "Oxidants: a base changes chemically", description: "Reactive oxygen can oxidize a DNA base. The marker records that chemical lesion while the sequence letters remain unchanged.", stages: ["Reactive oxygen", "Reaction at a base", "Oxidized base"] },
  electric: { title: "Electric field: force on a charged backbone", description: "DNA carries negative charge. A uniform field moves the backbone. This field model has no automatic ionization or chemical damage.", stages: ["Electric field", "Force on negative charge", "DNA moves"] },
  antioxidants: { title: "Antioxidants: intercept a radical", description: "Radical scavengers react with reactive oxygen before it reaches DNA. This diagram shows one possible hydrogen-transfer reaction.", stages: ["Reactive radical", "Scavenger reacts", "Radical intercepted"] },
  repair: { title: "Repair: remove or reverse a lesion", description: "Repair enzymes act on damaged DNA. This diagram shows replacement from an intact template. The model combines several repair pathways.", stages: ["Lesion recognized", "Damaged patch removed", "Template guides repair"] }
});

type Point = { x: number; y: number };
const mechanismClocks = new WeakMap<DamageWorld, { effect: DamageEffect; start: number; pulse: number | null; lastActivity: number }>();
const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * clamp(t);

function text(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, color: string, size = 11, align: CanvasTextAlign = "center") {
  ctx.fillStyle = color;
  ctx.font = `${size}px Arial, Helvetica, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  const available = ctx.canvas.width / Math.max(.01, ctx.getTransform().a) - 20;
  if (align === "center" && ctx.measureText(value).width > available) {
    const words = value.split(" "); let first = "";
    while (words.length && ctx.measureText(`${first} ${words[0]}`).width < available) first += `${first ? " " : ""}${words.shift()}`;
    ctx.fillText(first, x, y - size * .6); ctx.fillText(words.join(" "), x, y + size * .6);
  } else ctx.fillText(value, x, y);
}
function bond(ctx: CanvasRenderingContext2D, a: Point, b: Point, color: string, width = 2, dashed = false, double = false) {
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dashed ? [3, 4] : []);
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len * 2, ny = dx / len * 2;
  for (const sign of double ? [-1, 1] : [0]) {
    ctx.beginPath(); ctx.moveTo(a.x + nx * sign, a.y + ny * sign); ctx.lineTo(b.x + nx * sign, b.y + ny * sign); ctx.stroke();
  }
  ctx.setLineDash([]);
}
function atom(ctx: CanvasRenderingContext2D, p: Point, symbol: string, color: string, radius = 9) {
  const glow = ctx.createRadialGradient(p.x - radius * .3, p.y - radius * .4, 1, p.x, p.y, radius);
  glow.addColorStop(0, "#EFF2ED"); glow.addColorStop(.45, color); glow.addColorStop(1, color);
  ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(p.x, p.y, radius, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#536356"; ctx.lineWidth = .6; ctx.stroke();
  text(ctx, symbol, p.x, p.y + .5, "#303832", Math.min(11, radius + 2));
}
function cloud(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string, excited = 0) {
  ctx.save(); ctx.fillStyle = color;
  for (let layer = 3; layer > 0; layer--) {
    ctx.globalAlpha = .025 + excited * .018;
    ctx.beginPath(); ctx.ellipse(x, y, radius * (1 + layer * .15 + excited * .25), radius * (.52 + layer * .1 + excited * .16), -.15, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}
function electron(ctx: CanvasRenderingContext2D, x: number, y: number, theme: DnaRenderTheme, radius = 5) {
  ctx.save(); ctx.shadowBlur = 8; ctx.shadowColor = theme.sage; ctx.fillStyle = theme.sage;
  ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  text(ctx, "−", x, y - .5, theme.paper, 11);
}
function photon(ctx: CanvasRenderingContext2D, from: Point, to: Point, phase: number, theme: DnaRenderTheme, label: string) {
  const t = clamp(phase); const dx = to.x - from.x, dy = to.y - from.y, len = Math.hypot(dx, dy) || 1;
  const cx = lerp(from.x, to.x, t), cy = lerp(from.y, to.y, t);
  ctx.strokeStyle = theme.accent; ctx.lineWidth = 1.6; ctx.beginPath();
  for (let i = 0; i <= 36; i++) {
    const along = (i / 36 - .5) * 55, offset = Math.sin(i / 36 * Math.PI * 6) * 4;
    const x = cx + dx / len * along - dy / len * offset, y = cy + dy / len * along + dx / len * offset;
    if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
  }
  ctx.stroke(); text(ctx, label, cx, cy - 16, theme.accent, 10);
}
function arrow(ctx: CanvasRenderingContext2D, a: Point, b: Point, color: string) {
  bond(ctx, a, b, color, 1.5);
  const angle = Math.atan2(b.y - a.y, b.x - a.x);
  ctx.strokeStyle = color; ctx.beginPath();
  ctx.moveTo(b.x - Math.cos(angle - .45) * 7, b.y - Math.sin(angle - .45) * 7); ctx.lineTo(b.x, b.y);
  ctx.lineTo(b.x - Math.cos(angle + .45) * 7, b.y - Math.sin(angle + .45) * 7); ctx.stroke();
}

/** A labelled two-dimensional thymine skeleton, not an electronic-structure calculation. */
function thymine(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number, mirror: boolean, reduced: boolean, theme: DnaRenderTheme) {
  const points = Array.from({ length: 6 }, (_, i) => ({ x: cx + Math.sin(i / 3 * Math.PI) * radius * (mirror ? -1 : 1), y: cy - Math.cos(i / 3 * Math.PI) * radius }));
  const symbols = ["C", "C", "C", "N", "C", "N"];
  for (let i = 0; i < 6; i++) bond(ctx, points[i], points[(i + 1) % 6], theme.ink, 1.1, false, !reduced && i === 1);
  for (const index of [0, 4]) {
    const p = points[index]; const o = { x: cx + (p.x - cx) * 1.68, y: cy + (p.y - cy) * 1.68 };
    bond(ctx, p, o, theme.ink, .8, false, true); atom(ctx, o, "O", theme.clay, 7);
  }
  points.forEach((p, index) => atom(ctx, p, symbols[index], symbols[index] === "N" ? "#829D9F" : "#AAB49E", 6));
  bond(ctx, points[1], { x: points[1].x, y: points[1].y - 17 }, theme.ink, 1);
  text(ctx, "CH₃", points[1].x, points[1].y - 23, theme.ink, 9);
  text(ctx, "T base", cx, cy + radius + 27, theme.ink, 11);
  return [points[1], points[2]];
}
function drawUv(ctx: CanvasRenderingContext2D, w: number, h: number, phase: number, active: boolean, shielded: boolean, theme: DnaRenderTheme) {
  const r = w < 420 ? 23 : 29, gap = Math.min(68, w * .18), y = h * .48;
  const formed = active && !shielded && phase > .62;
  cloud(ctx, w * .5 - gap, y, r * 1.2, theme.accent, active && phase > .25 && phase < .65 ? 1 : 0);
  cloud(ctx, w * .5 + gap, y, r * 1.2, theme.accent, active && phase > .25 && phase < .65 ? 1 : 0);
  const left = thymine(ctx, w * .5 - gap, y, r, false, formed, theme);
  const right = thymine(ctx, w * .5 + gap, y, r, true, formed, theme);
  if (active && phase < .38) photon(ctx, { x: 20, y: 25 }, { x: w * .5 - gap, y }, phase / .38, theme, "UV");
  if (shielded) {
    bond(ctx, { x: w * .18, y: 14 }, { x: w * .18, y: h * .6 }, theme.sage, 7);
    text(ctx, "Filter absorbs UV", w * .5, h - 23, theme.sage);
  } else if (formed) {
    const growth = clamp((phase - .62) / .15);
    left.forEach((p, i) => bond(ctx, p, { x: lerp(p.x, right[i].x, growth), y: lerp(p.y, right[i].y, growth) }, theme.accent, 3));
    text(ctx, "New bonds on the same strand", w * .5, h - 23, theme.accent);
  } else text(ctx, active && phase > .25 ? "Electron energy increases" : "Neighboring bases on one strand", w * .5, h - 23, theme.ink);
  const ex = w - 24, ground = y + 30, excited = y - 28;
  bond(ctx, { x: ex - 9, y: ground }, { x: ex + 9, y: ground }, theme.sage, 1);
  bond(ctx, { x: ex - 9, y: excited }, { x: ex + 9, y: excited }, theme.accent, 1);
  const lift = active && !shielded ? Math.sin(clamp((phase - .22) / .4) * Math.PI) : 0;
  electron(ctx, ex, lerp(ground, excited, lift), theme, 4);
  text(ctx, "e−", ex, ground + 15, theme.ink, 9);
}

function water(ctx: CanvasRenderingContext2D, x: number, y: number, theme: DnaRenderTheme, removeH = 0) {
  const oxygen = { x, y }, hydrogen1 = { x: x - 24, y: y + 22 }, hydrogen2 = { x: x + 24 + removeH * 25, y: y + 22 + removeH * 15 };
  cloud(ctx, x, y + 6, 40, theme.sage, 0);
  bond(ctx, oxygen, hydrogen1, theme.ink, 3); atom(ctx, hydrogen1, "H", theme.paper, 8);
  if (removeH < .7) bond(ctx, oxygen, hydrogen2, theme.ink, 3 * (1 - removeH));
  atom(ctx, oxygen, "O", theme.clay, 14);
  if (removeH < 1) atom(ctx, hydrogen2, removeH > .6 ? "H+" : "H", theme.paper, 8);
  if (removeH > .5) { ctx.fillStyle = theme.accent; ctx.beginPath(); ctx.arc(x + 16, y - 12, 2.5, 0, Math.PI * 2); ctx.fill(); }
}
function tinyBackbone(ctx: CanvasRenderingContext2D, x: number, y: number, theme: DnaRenderTheme, broken = false) {
  const elements = ["P", "O", "C", "C", "C", "O", "P"];
  for (let i = 0; i < elements.length; i++) {
    const p = { x: x + i * 17, y: y + Math.sin(i) * 9 };
    if (i && !(broken && i === 3)) bond(ctx, { x: x + (i - 1) * 17, y: y + Math.sin(i - 1) * 9 }, p, theme.ink, 3);
    atom(ctx, p, elements[i], elements[i] === "P" ? theme.sage : elements[i] === "O" ? theme.clay : "#AAB49E", 7);
  }
}
function drawXray(ctx: CanvasRenderingContext2D, w: number, h: number, p: number, active: boolean, shielded: boolean, scavenged: boolean, theme: DnaRenderTheme) {
  const x = w * .33, y = h * .43;
  const ionized = active && !shielded && p > .28;
  water(ctx, x, y, theme, ionized ? clamp((p - .4) / .35) : 0);
  text(ctx, ionized && p > .7 ? "Reactive water product" : "Water molecule", x, y + 67, theme.ink);
  if (active && p < .32) photon(ctx, { x: 15, y: 25 }, { x, y }, p / .32, theme, "X-ray");
  if (ionized) {
    const distance = clamp((p - .28) / .35);
    electron(ctx, x + 17 + distance * Math.min(115, w * .27), y - 18 - Math.sin(distance * Math.PI) * 35, theme);
    text(ctx, "Ejected electron", w * .7, 27, theme.sage, 10);
  }
  tinyBackbone(ctx, w * (w < 350 ? .57 : .61), y + 35, theme, ionized && p > .83 && !scavenged);
  if (ionized && p > .65) {
    const t = clamp((p - .65) / .25);
    const rx = lerp(x + 24, scavenged ? w * .53 : w * .73, t), ry = lerp(y - 10, y + 26, t);
    if (!(scavenged && t > .9)) { atom(ctx, { x: rx, y: ry }, "OH", theme.clay, 10); text(ctx, "•", rx + 11, ry - 8, theme.accent, 16); }
    if (scavenged) { cloud(ctx, w * .53, y + 25, 26, theme.sage, t); text(ctx, "Scavenger", w * .52, y + 69, theme.sage, 10); }
  }
  if (shielded) { bond(ctx, { x: w * .13, y: 10 }, { x: w * .13, y: h - 30 }, theme.sage, 8); text(ctx, "Shield absorbs the X-ray", w * .5, h - 20, theme.sage); }
  else text(ctx, scavenged && ionized && p > .83 ? "ROS intercepted; direct X-ray damage remains possible" : ionized && p > .83 ? "A reactive product can break the backbone" : "Ionization is one route to DNA damage", w * .5, h - 20, theme.ink);
}
function drawHeat(ctx: CanvasRenderingContext2D, w: number, h: number, time: number, amount: number, theme: DnaRenderTheme) {
  const separation = 45 + amount * 45;
  const wobble = (offset: number) => Math.sin(time * (5 + amount * 12) + offset) * amount * 7;
  for (let row = 0; row < 3; row++) {
    const y = h * (.22 + row * .21), left = { x: w * .5 - separation + wobble(row), y }, right = { x: w * .5 + separation + wobble(row + 2), y: y + wobble(row + 3) };
    atom(ctx, left, row % 2 ? "N" : "O", row % 2 ? "#829D9F" : theme.clay, 12);
    const hydrogen = { x: left.x + 21, y: left.y }; bond(ctx, left, hydrogen, theme.ink, 2); atom(ctx, hydrogen, "H", theme.paper, 7);
    atom(ctx, right, row % 2 ? "O" : "N", row % 2 ? theme.clay : "#829D9F", 12);
    ctx.globalAlpha = 1 - amount * .9; bond(ctx, hydrogen, right, theme.sage, 1, true); ctx.globalAlpha = 1;
    cloud(ctx, left.x, left.y, 30, theme.sage); cloud(ctx, right.x, right.y, 30, theme.sage);
  }
  text(ctx, "Pairing + stacking become less stable", w * .5, h - 21, theme.ink);
}
function drawOxidation(ctx: CanvasRenderingContext2D, w: number, h: number, p: number, active: boolean, scavenged: boolean, theme: DnaRenderTheme) {
  const x = w * .43, y = h * .48, r = w < 420 ? 23 : 29;
  const ring = Array.from({ length: 6 }, (_, i) => ({ x: x + Math.sin(i * Math.PI / 3) * r, y: y - Math.cos(i * Math.PI / 3) * r }));
  const symbols = ["C", "C", "C", "N", "C", "N"];
  ring.forEach((point, i) => { bond(ctx, point, ring[(i + 1) % 6], theme.ink, 1, false, i === 1 || i === 3); atom(ctx, point, symbols[i], symbols[i] === "N" ? "#829D9F" : "#AAB49E", 6); });
  const five = [ring[2], { x: x + r * 1.65, y: y + r * .8 }, { x: x + r * 2.25, y }, { x: x + r * 1.65, y: y - r * .8 }, ring[1]];
    five.forEach((point, i) => { if (i < 4) bond(ctx, point, five[i + 1], theme.ink, 1, false, i === 2 && !(active && p > .7 && !scavenged));
    if (i > 0 && i < 4) atom(ctx, point, i === 2 ? "C" : "N", i === 2 ? "#AAB49E" : "#829D9F", 6); });
  const oxygen6 = { x, y: y - r * 1.7 }; bond(ctx, ring[0], oxygen6, theme.ink, 1, false, true); atom(ctx, oxygen6, "O", theme.clay, 7);
  const amino = { x: ring[4].x - 23, y: ring[4].y + 8 }; bond(ctx, ring[4], amino, theme.ink, 1); atom(ctx, amino, "N", "#829D9F", 6); text(ctx, "H₂", amino.x - 12, amino.y + 11, theme.ink, 8);
  cloud(ctx, x + r * .5, y, 54, theme.sage);
  text(ctx, "Guanine · selected atoms", x + r * .5, y + 65, theme.ink);
  const target = five[2];
  const rx = active ? lerp(w - 20, target.x + (scavenged ? 45 : 24), p / .7) : w - 20;
  if (!(scavenged && active && p > .7)) { atom(ctx, { x: rx, y: y - 12 }, "O", theme.clay, 12); text(ctx, "•", rx + 14, y - 25, theme.accent, 16); }
  if (scavenged && active) { cloud(ctx, target.x + 43, y - 10, 24, theme.sage, p); text(ctx, "Scavenger", w * .76, y - 57, theme.sage, 10); }
  if (active && p > .7 && !scavenged) {
    bond(ctx, target, { x: target.x + 24, y: target.y - 12 }, theme.accent, 1, false, true);
    atom(ctx, { x: target.x + 24, y: target.y - 12 }, "O", theme.clay, 8);
    ctx.strokeStyle = theme.accent; ctx.lineWidth = 1.5; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.ellipse(x + r * .6, y, r * 2.1, r * 1.5, 0, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
  }
  text(ctx, active && p > .7 ? scavenged ? "The scavenger intercepts reactive oxygen" : "Chemical lesion on a base" : "A reactive oxygen species approaches", w * .5, h - 21, theme.ink);
}
function drawElectric(ctx: CanvasRenderingContext2D, w: number, h: number, time: number, value: number, theme: DnaRenderTheme) {
  const direction = value < 0 ? -1 : 1;
  const drift = Math.sin(time * .7) * Math.abs(value) * 28;
  const x = w * .5 - drift * direction, y = h * .49;
  const oxygen = [{ x: x - 46, y }, { x: x + 46, y }, { x, y: y - 39 }, { x, y: y + 39 }];
  oxygen.forEach((o, index) => { bond(ctx, { x, y }, o, theme.ink, 2, false, index === 2); atom(ctx, o, index === 0 ? "O−" : "O", theme.clay, index === 0 ? 12 : 10); });
  atom(ctx, { x, y }, "P", theme.sage, 13); cloud(ctx, x - value * 10, y, 70, theme.sage, Math.abs(value));
  if (Math.abs(value) > .01) {
    arrow(ctx, { x: w * .5 - direction * 50, y: 20 }, { x: w * .5 + direction * 50, y: 20 }, theme.accent);
    text(ctx, "Electric field", w * .5, 39, theme.accent);
    arrow(ctx, { x: w * .5 + direction * 45, y: h - 45 }, { x: w * .5 - direction * 45, y: h - 45 }, theme.sage);
  }
  text(ctx, "Force on the negatively charged backbone", w * .5, h - 20, theme.ink);
}
function drawScavenger(ctx: CanvasRenderingContext2D, w: number, h: number, p: number, active: boolean, theme: DnaRenderTheme) {
  const y = h * .45, donor = { x: w * .3, y }, ox = { x: w * .69, y };
  cloud(ctx, donor.x, y, 43, theme.sage); atom(ctx, donor, "R", theme.sage, 20);
  const transfer = active ? clamp((p - .15) / .55) : 0;
  const hydrogen = { x: lerp(donor.x + 35, ox.x - 22, transfer), y: y + Math.sin(transfer * Math.PI) * -20 };
  if (transfer < .1) bond(ctx, donor, hydrogen, theme.ink, 2);
  if (transfer > .85) bond(ctx, hydrogen, ox, theme.ink, 2);
  atom(ctx, hydrogen, "H", theme.paper, 9);
  atom(ctx, ox, "O", theme.clay, 14); const oldH = { x: ox.x + 22, y: y + 22 }; bond(ctx, ox, oldH, theme.ink, 2); atom(ctx, oldH, "H", theme.paper, 8);
  if (transfer < .95) { text(ctx, "•", ox.x + 17, y - 15, theme.accent, 18); }
  else text(ctx, "•", donor.x + 20, y - 17, theme.sage, 18);
  text(ctx, "Scavenger", donor.x, y + 55, theme.sage);
  text(ctx, transfer > .95 ? "Water" : "OH radical", ox.x, y + 55, theme.ink);
  text(ctx, transfer > .95 ? "The scavenger reacts before the radical reaches DNA" : "One possible route: hydrogen transfer", w * .5, h - 22, theme.ink);
}
function drawRepair(ctx: CanvasRenderingContext2D, w: number, h: number, p: number, active: boolean, theme: DnaRenderTheme) {
  const start = w * .5 - 69, y = h * .48;
  for (let i = 0; i < 5; i++) {
    const x = start + i * 34, affected = i === 2;
    if (i) { bond(ctx, { x: x - 34, y }, { x, y }, theme.ink, 2); bond(ctx, { x: x - 34, y: y + 44 }, { x, y: y + 44 }, theme.ink, 2); }
    const removed = affected && active && p > .35 && p < .72;
    if (!removed) atom(ctx, { x, y }, affected && (!active || p < .35) ? "!" : "C", affected && (!active || p < .35) ? theme.clay : theme.sage, 10);
    atom(ctx, { x, y: y + 44 }, "G", "#B58D87", 9);
    bond(ctx, { x, y: y + 10 }, { x, y: y + 34 }, theme.sage, 1, true);
  }
  const ex = start + 68;
  if (active) {
    ctx.save(); ctx.fillStyle = theme.sage; ctx.globalAlpha = .16; ctx.beginPath(); ctx.ellipse(ex, y - 22, 49, 28, -.1, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    text(ctx, "Repair enzyme", ex, y - 25, theme.ink, 11);
  }
  if (active && p > .35 && p < .72) atom(ctx, { x: ex + (p - .35) * 100, y: y - (p - .35) * 130 }, "!", theme.clay, 9);
  text(ctx, !active ? "No active repair pathway in this setup" : p > .72 ? "An intact template guides replacement" : "A damaged patch is removed", w * .5, h - 20, theme.ink);
}

/** A slow schematic of a mechanism. It is not a quantum trajectory or a dose calculation. */
export function renderAtomicMechanism(ctx: CanvasRenderingContext2D, width: number, height: number, world: DamageWorld,
  effect: DamageEffect = world.selectedEffect, overrides: Partial<DnaRenderTheme> = {}) {
  const theme = { ...DEFAULT_DNA_RENDER_THEME, ...overrides };
  const time = world.dna.time;
  const species = SPECIES_PROFILES.find(item => item.id === world.species)!;
  const repairAmount = world.protectors.repair * species.repairFactor + (species.photolyase ? world.protectors.repairLight : 0);
  const amount = effect === "antioxidants" ? world.protectors.antioxidants : effect === "repair" ? repairAmount : Math.abs(world.exposures[effect]);
  const event = world.lastEvent?.effect === effect ? world.lastEvent : null;
  let clock = mechanismClocks.get(world);
  if (!clock || clock.effect !== effect) { clock = { effect, start: time, pulse: null, lastActivity: -Infinity }; mechanismClocks.set(world, clock); }
  const particlesActive = world.particles.some(particle => particle.age < particle.life && (particle.source === effect || effect === "antioxidants" && particle.kind === "scavenger"));
  if (particlesActive) clock.lastActivity = time;
  const eventRecent = event !== null && time - event.time < 6.2;
  const recent = (eventRecent && (effect !== "repair" || amount > .001 || Boolean(event?.externalRepair))) || time - clock.lastActivity < 6.2;
  const active = amount > .001 || Boolean(recent);
  if (amount <= .001 && recent && event && clock.pulse !== event.time) { clock.start = event.time; clock.pulse = event.time; }
  const phase = world.dna.paused ? active ? .87 : .04 : active ? (time - clock.start) * (.18 + amount * .12) % 1 : .04;
  const shielded = (effect === "uv" && world.protectors.uvFilter > .99) || (effect === "xray" && world.protectors.xrayShield > .99)
    || (eventRecent && event?.outcome === "shielded");
  const scavenged = world.protectors.antioxidants > .99 || world.lastEvent?.outcome === "neutralized" && time - world.lastEvent.time < 6.2;
  ctx.save(); ctx.clearRect(0, 0, width, height);
  const zoom = width < 420 ? 1.04 : 1.25;
  ctx.scale(zoom, zoom);
  const w = width / zoom, h = height / zoom;
  if (effect === "uv") drawUv(ctx, w, h, phase, active, Boolean(shielded), theme);
  else if (effect === "xray") drawXray(ctx, w, h, phase, active, Boolean(shielded), Boolean(scavenged), theme);
  else if (effect === "heat") drawHeat(ctx, w, h, time, amount, theme);
  else if (effect === "electric") drawElectric(ctx, w, h, time, world.exposures.electric, theme);
  else if (effect === "oxidants") drawOxidation(ctx, w, h, phase, active, Boolean(scavenged), theme);
  else if (effect === "antioxidants") drawScavenger(ctx, w, h, phase, active, theme);
  else drawRepair(ctx, w, h, phase, active, theme);
  ctx.restore();
}
