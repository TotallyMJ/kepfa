// A month's jar holds its skies as a pile: each photo folded into a triangle, each note rolled into a scroll,
// settled by real physics (Matter.js, loaded from js/vendor) against the jar's inside, lid included.
// The same pile is drawn still on the Months shelf and in share images, and live on a month's page,
// where tilting the phone rolls it about.

import { INTERIOR } from './jar.js';

const M = () => window.Matter;

// Sizes in the jar photo's coordinates (the jar is 746 wide).
const T = 200;                          // folded triangle: base T, height T, like the photo's last fold
const TOP = 330, BOTTOM = 1296;         // where pieces can be, under the lid
const USABLE = 360000;                  // inside area pieces can fill, loosely packed
// The rolled-paper colours, in the same order as --roll on .paper-0 … .paper-4 in css/style.css.
export const ROLLS = ['#ECE2CD', '#F2E8C4', '#E0E7EB', '#F1DDD0', '#E2E6D2'];

/** Each sky's note paper, fixed by its id (paper-N in CSS, ROLLS[N] on a canvas). */
export const paperIndex = (id) => [...id].reduce((a, c) => a + c.charCodeAt(0), 0) % ROLLS.length;

/** A rolled note is as long as the slip was tall (one more line of writing, a longer roll) and fatter with more paper. */
export function scrollSize(note) {
  const lines = Math.min(4, Math.ceil(note.length / 18));
  return { len: 150 + lines * 38, thick: 28 + Math.min(note.length, 80) / 8 };
}

/** A small seeded random, so a month's pile comes out the same every time. */
function seeded(str) {
  let seed = [...str].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 233280, 7);
  return () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
}

// ---------- the pieces ----------

const TRI = [{ x: -T / 2, y: T / 3 }, { x: T / 2, y: T / 3 }, { x: 0, y: (-T * 2) / 3 }];
/** A photo may lean away from the screen: squashed along one direction, and sometimes turned over to its paper back. */
const squash = (p, { axis, k }) => {
  const c = Math.cos(axis), s = Math.sin(axis);
  const u = (p.x * c + p.y * s) * k, v = -p.x * s + p.y * c;
  return { x: u * c - v * s, y: u * s + v * c };
};

function piecesFor(skies, rnd) {
  const out = [];
  for (const sky of skies) {
    const lean = { axis: rnd() * Math.PI, k: rnd() < 0.35 ? 0.25 + rnd() * 0.45 : 0.75 + rnd() * 0.25, back: rnd() < 0.22 };
    out.push({ kind: 'tri', sky, lean, verts: TRI.map((p) => squash(p, lean)) });
    if (sky.note) out.push({ kind: 'scroll', sky, ...scrollSize(sky.note), roll: ROLLS[paperIndex(sky.id)] });
  }
  // A full month gets smaller pieces, so everything still fits under the lid.
  const need = out.reduce((a, p) => a + (p.kind === 'tri' ? (T * T * p.lean.k) / 2 : p.len * p.thick), 0);
  const scale = Math.min(1, Math.sqrt(USABLE / Math.max(need, 1)));
  return { pieces: out, scale };
}

function walls() {
  const { Bodies } = M();
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', INTERIOR);
  const len = path.getTotalLength(), out = [];
  for (let d = 0; d < len; d += 30) {
    const a = path.getPointAtLength(d), b = path.getPointAtLength(Math.min(len, d + 30));
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    // Pushed outwards, so the inside face of each segment lies on the jar's outline.
    out.push(Bodies.rectangle((a.x + b.x) / 2 + Math.sin(ang) * 20, (a.y + b.y) / 2 - Math.cos(ang) * 20, 34, 40, { isStatic: true, angle: ang, friction: 0.6 }));
  }
  return out;
}

function bodyFor(p, scale, x, y, angle) {
  const { Bodies, Body } = M();
  const opts = { friction: p.kind === 'tri' ? 0.5 : 0.3, frictionAir: 0.02, restitution: 0.12, density: 0.001, sleepThreshold: 40 };
  const b = p.kind === 'tri'
    ? Bodies.fromVertices(x, y, [p.verts.map((v) => ({ x: v.x * scale, y: v.y * scale }))], opts)
    : Bodies.rectangle(x, y, p.len * scale, p.thick * scale, { ...opts, chamfer: { radius: (p.thick * scale) / 3 } });
  // fromVertices recentres on the centroid; ours are already centred there, so drawing needs no offset.
  Body.setAngle(b, angle);
  b.plugin = { ...p, scale };
  return b;
}

/** A world with the jar's walls and these pieces, either dropped in one by one or placed as given. */
function world(pieces, scale, rnd, placed) {
  const { Engine, Composite } = M();
  const engine = Engine.create({ gravity: { x: 0, y: 1, scale: 0.0024 }, enableSleeping: true });
  Composite.add(engine.world, walls());
  const bodies = [];
  if (placed) {
    placed.forEach((p) => bodies.push(bodyFor(p, p.scale, p.x, p.y, p.angle)));
    Composite.add(engine.world, bodies);
    return { engine, bodies };
  }
  // In the order they were kept: dropped in at the top, a moment apart, then all of it left to settle.
  for (const p of pieces) {
    const b = bodyFor(p, scale, 300 + rnd() * 490, TOP + 60, rnd() * Math.PI * 2);
    bodies.push(b);
    Composite.add(engine.world, b);
    for (let i = 0; i < 18; i++) M().Engine.update(engine, 1000 / 60);
  }
  for (let i = 0; i < 160; i++) M().Engine.update(engine, 1000 / 60);
  return { engine, bodies };
}

const snapshot = (bodies) => bodies.map((b) => ({ ...b.plugin, x: b.position.x, y: b.position.y, angle: b.angle }));

// Without the physics library: a plain arrangement in rows, so jars still show what's in them.
function rows(pieces, scale) {
  return pieces.map((p, i) => ({ ...p, scale, x: 280 + (i % 4) * 160, y: BOTTOM - 90 - Math.floor(i / 4) * 140, angle: (i % 2) * Math.PI }));
}

const piles = new Map();
/** The settled pile for these skies (oldest first), computed once and kept. */
export function pileFor(skies) {
  const key = skies.map((s) => `${s.id}:${s.note ? s.note.length : 0}`).join('|');
  if (!piles.has(key)) {
    const rnd = seeded(key);
    const { pieces, scale } = piecesFor(skies, rnd);
    piles.set(key, M() ? snapshot(world(pieces, scale, rnd).bodies) : rows(pieces, scale));
  }
  return piles.get(key);
}

// ---------- thumbnails ----------

const thumbs = new Map();
/** Load the thumbnails a pile needs; resolves when they're ready. Drawing before then shows each sky's colour. */
export function loadThumbs(skies) {
  return Promise.all(skies.map((s) => {
    if (!thumbs.has(s.id)) thumbs.set(s.id, createImageBitmap(s.thumb).then((bmp) => { thumbs.set(s.id, bmp); return bmp; }, () => null));
    return thumbs.get(s.id);
  }));
}
export const forgetThumb = (id) => thumbs.delete(id);
const thumbOf = (sky) => { const t = thumbs.get(sky.id); return t && !(t instanceof Promise) ? t : null; };

// ---------- drawing (in the jar photo's coordinates) ----------

function outline(ctx, verts) {
  ctx.beginPath();
  verts.forEach((v, i) => (i ? ctx.lineTo(v.x, v.y) : ctx.moveTo(v.x, v.y)));
  ctx.closePath();
}

function drawTri(ctx, p) {
  const { lean, sky } = p;
  const verts = p.verts;
  outline(ctx, verts);
  ctx.shadowColor = 'rgba(30, 28, 25, .35)';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 5;
  ctx.fillStyle = lean.back ? '#EDE6D8' : sky.palette?.[0]?.hex || '#8A9BB0';
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.save();
  ctx.clip();
  // The photo (or the paper back) foreshortened the same way as the outline.
  const c = Math.cos(lean.axis), s = Math.sin(lean.axis);
  ctx.transform(c, s, -s, c, 0, 0);
  ctx.transform(lean.k, 0, 0, 1, 0, 0);
  ctx.transform(c, -s, s, c, 0, 0);
  const img = lean.back ? null : thumbOf(sky);
  if (lean.back) {
    ctx.fillStyle = 'rgba(120, 100, 70, .06)';
    for (let y = -T; y < T; y += 6) ctx.fillRect(-T, y, 2 * T, 1);
  } else if (img) {
    const k = Math.max(T / img.width, T / img.height);
    ctx.drawImage(img, -img.width * k / 2, -T * 2 / 3 + (T - img.height * k) / 2, img.width * k, img.height * k);
  }
  if (!lean.back) {
    // The fold: one half a little darker.
    ctx.fillStyle = 'rgba(0, 0, 0, .12)';
    ctx.beginPath(); ctx.moveTo(0, T / 3); ctx.lineTo(T / 2, T / 3); ctx.lineTo(0, (-T * 2) / 3); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  // Leaning away from the light: darker the more it leans. And a fine paper edge.
  outline(ctx, verts);
  ctx.fillStyle = `rgba(20, 18, 15, ${(1 - lean.k) * 0.35})`;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, .5)';
  ctx.lineWidth = 3;
  ctx.stroke();
}

/** The rolled note: shaded like a tube, three turns of red thread and a small bow. */
function drawScroll(ctx, { len, thick, roll }) {
  const r = thick / 3;
  ctx.shadowColor = 'rgba(30, 28, 25, .3)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = roll;
  ctx.beginPath(); ctx.roundRect(-len / 2, -thick / 2, len, thick, r); ctx.fill();
  ctx.shadowColor = 'transparent';
  const g = ctx.createLinearGradient(0, -thick / 2, 0, thick / 2);
  g.addColorStop(0, 'rgba(110, 90, 60, .3)');
  g.addColorStop(0.55, 'rgba(255, 250, 240, .35)');
  g.addColorStop(1, 'rgba(110, 90, 60, .32)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.roundRect(-len / 2, -thick / 2, len, thick, r); ctx.fill();
  ctx.strokeStyle = '#B3261E';
  ctx.lineWidth = 3;
  for (const dx of [-9, 0, 9]) { ctx.beginPath(); ctx.moveTo(dx - 4, -thick / 2); ctx.lineTo(dx + 4, thick / 2); ctx.stroke(); }
  ctx.lineWidth = 2.4;
  ctx.beginPath(); ctx.ellipse(-8, -thick / 2 - 3, 7, 4.5, -0.5, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(8, -thick / 2 - 3, 7, 4.5, 0.5, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#B3261E';
  ctx.beginPath(); ctx.arc(0, -thick / 2, 4, 0, Math.PI * 2); ctx.fill();
}

/** Draw a pile (from pileFor, or a live one) inside the jar. The caller has clipped to the jar's inside. */
export function drawPile(ctx, pile) {
  for (const p of pile) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.scale(p.scale, p.scale);
    if (p.kind === 'tri') drawTri(ctx, p); else drawScroll(ctx, p);
    ctx.restore();
  }
}

// ---------- live: tilt the phone, shake the jar, tap a piece ----------

/**
 * Run a month's pile live. Gravity starts straight down; `tilt(gamma, beta)` points it the way the phone leans.
 * @param draw   called with the current pile each frame something moves
 * @returns { tilt, shake, at(x, y) → the sky under that point, stop }
 */
export function livePile(skies, draw) {
  const pile = pileFor(skies);
  if (!M()) { draw(pile); return { tilt() {}, shake() {}, at: () => null, stop() {} }; }
  const { Engine, Body, Sleeping, Query, Composite } = M();
  const { engine, bodies } = world(null, 1, null, pile);
  let raf = 0, running = true;
  const frame = () => {
    if (!running) return;
    if (!bodies.every((b) => b.isSleeping)) {
      Engine.update(engine, 1000 / 60);
      draw(snapshot(bodies));
    }
    raf = requestAnimationFrame(frame);
  };
  draw(snapshot(bodies));
  raf = requestAnimationFrame(frame);
  const wake = () => bodies.forEach((b) => Sleeping.set(b, false));
  return {
    tilt(gamma, beta) {
      const gx = Math.sin((gamma * Math.PI) / 180), gy = Math.sin((beta * Math.PI) / 180);
      if (Math.abs(gx - engine.gravity.x) + Math.abs(gy - engine.gravity.y) < 0.03) return;
      engine.gravity.x = gx;
      engine.gravity.y = gy;
      wake();
    },
    shake() {
      wake();
      for (const b of bodies) Body.applyForce(b, b.position, { x: (Math.random() - 0.5) * 0.25 * b.mass, y: -0.25 * b.mass * Math.random() });
    },
    at(x, y) {
      const hit = Query.point(bodies, { x, y })[0];
      return hit ? hit.plugin.sky : null;
    },
    stop() { running = false; cancelAnimationFrame(raf); Composite.clear(engine.world); },
  };
}
