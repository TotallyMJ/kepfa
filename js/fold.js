// Origami that carries a photo into its jar and back out: three folds down to a small triangle,
// a flip on the way in with a light trail, a ripple at the mouth, then one twist of the lid.

import { jarSvg, JAR_RATIO } from './jar.js';
import { whoosh, click } from './sound.js';

export const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const EASE = 'cubic-bezier(.55,0,.35,1)';
// Falling speeds up, rising slows down: together they read as gravity.
const GRAVITY = 'cubic-bezier(.55,.085,.68,.53)';
const RISE = 'cubic-bezier(.25,.46,.45,.94)';
// The same motion tokens as css/style.css (--ease-*, --t-*), for animations driven from JS.
export const MOTION = {
  out: 'cubic-bezier(.22,1,.36,1)',
  in: 'cubic-bezier(.55,0,1,.45)',
  spring: 'cubic-bezier(.34,1.56,.64,1)',
  quick: 220,
  move: 380,
  pop: 520,
  stagger: 70,
};
const SQUARE = 'polygon(0 0,0 100%,100% 100%)';     // while fold 1 lifts the top-right half away
const HALF = 'polygon(0 0,0 100%,50% 50%)';         // after fold 2
const QUARTER = 'polygon(0 0,0 50%,50% 50%)';       // after fold 3: the triangle that goes in

/**
 * @param href   photo URL (shown square-cropped while it's paper)
 * @param size   card size in CSS px; the jar sits underneath, slightly wider
 * @param state  'open' = photo out, jar empty and unlidded; 'kept' = photo in a lidded jar
 */
export function foldStage(href, size, state) {
  const s = Math.round(size);
  const jw = Math.round(s * 1.15);
  const jh = Math.round(jw * JAR_RATIO);
  const jarTop = Math.round(s * 1.07);

  const el = document.createElement('div');
  el.className = 'fold-stage';
  el.style.height = `${jarTop + jh}px`;
  const photo = `background-image:url('${href}')`;
  const card = (cls, inner) => `<div class="fold-card ${cls}" style="width:${s}px;height:${s}px;left:calc(50% - ${s / 2}px)">${inner}</div>`;
  el.innerHTML = `
    <div class="fold-jar" style="top:${jarTop}px;width:${jw}px">${jarSvg({ href })}</div>
    ${[1, 2, 3].map((i) => card(`fold-ghost fold-ghost-${i}`, '<div class="fold-piece"></div>')).join('')}
    ${card('fold-main', `
      <div class="fold-piece fold-base" style="${photo}"></div>
      <div class="fold-piece fold-f1" style="${photo}"></div>
      <div class="fold-piece fold-f2"></div>
      <div class="fold-piece fold-f3"></div>`)}`;

  const $ = (sel) => el.querySelector(sel);
  const main = $('.fold-main');
  const base = $('.fold-base');
  const f1 = $('.fold-f1');
  const f2 = $('.fold-f2');
  const f3 = $('.fold-f3');
  const ghosts = [...el.querySelectorAll('.fold-ghost')];
  const sky = $('.j-sky');
  const lid = $('.j-lid');
  const shine = $('.j-shine');
  const ripple = $('.j-ripple');
  const glow = $('.j-glow');
  const mouth = $('.j-mouth');
  const shineTravel = +shine.dataset.travel;

  // The last triangle's centre sits at (1/6, 1/3) of the card; that point flies to the jar's mouth.
  const inJar = `translate(${s / 3}px, ${jarTop + jh * 0.3 - s / 3}px) rotate(200deg) rotateY(180deg) scale(.24)`;
  const midAir = `translate(${s / 3}px, ${jarTop * 0.4}px) rotate(80deg) rotateY(90deg) scale(.55)`;

  // Once skipped, every remaining step resolves at once and the sequence lands on its final state.
  let skipped = false;
  const run = (node, frames, opts) => (skipped ? Promise.resolve()
    : node.animate(frames, { fill: 'forwards', ...opts }).finished.catch(() => {}));
  const skip = () => { skipped = true; el.getAnimations({ subtree: true }).forEach((a) => a.finish()); };
  const asPaper = (node, on) => node.classList.toggle('is-paper', on);

  /** 'open' = photo out, jar empty; 'filled' = photo in the jar, lid still off; 'kept' = lid on. */
  const show = (st) => {
    el.getAnimations({ subtree: true }).forEach((a) => a.cancel());
    const kept = st !== 'open';
    main.style.opacity = kept ? 0 : 1;
    main.style.transform = kept ? inJar : '';
    asPaper(base, kept);
    asPaper(f1, false);
    // Unfolded, the base shows the whole photo so no seam runs along the diagonal.
    base.style.clipPath = kept ? QUARTER : 'none';
    f1.hidden = kept;
    f2.hidden = true;
    f3.hidden = !kept;
    f1.style.transform = '';
    f3.style.transform = kept ? 'rotateX(180deg)' : '';
    sky.style.opacity = kept ? 1 : 0;
    lid.style.opacity = st === 'kept' ? 1 : 0;
    mouth.style.opacity = st === 'kept' ? 0 : 1;
  };
  show(state);

  const trail = (frames, duration) => !skipped && ghosts.forEach((g, i) => {
    g.animate(frames.map((f, k) => ({ ...f, opacity: k === 0 || k === frames.length - 1 ? 0 : 0.45 - i * 0.12 })),
      { duration, delay: (i + 1) * 35, easing: 'cubic-bezier(.45,0,.75,.5)' });
  });
  const energy = () => {
    if (skipped) return;
    ripple.animate([{ opacity: 0.9, transform: 'scale(.4)' }, { opacity: 0, transform: 'scale(1.35, 1.8)' }], { duration: 420, easing: 'cubic-bezier(.2,.7,.3,1)' });
    glow.animate([{ opacity: 0 }, { opacity: 0.35, offset: 0.25 }, { opacity: 0 }], { duration: 420, easing: 'ease-out' });
  };
  // The lid is a photo, so a twist reads as a sweep of light across the brass and a small tilt.
  const twist = (dir) => {
    if (!skipped) shine.animate([{ opacity: 1, transform: `translateX(${dir > 0 ? 0 : shineTravel}px)` }, { opacity: 1, transform: `translateX(${dir > 0 ? shineTravel : 0}px)` }], { duration: 180 });
    return run(lid, [{ transform: 'rotate(0)' }, { transform: `rotate(${dir * 1.5}deg)`, offset: 0.6 }, { transform: 'rotate(0)' }], { duration: 180 });
  };

  /** Drops on with gravity, bounces once, then screws down in one twist: light sweeps the brass, a click and a tiny buzz. */
  async function lidOn() {
    if (reduceMotion() || skipped) return show('kept');
    lid.style.opacity = 1;
    await run(lid, [
      { offset: 0, opacity: 0, transform: 'translateY(-420px) rotate(-6deg)', easing: GRAVITY },
      { offset: 0.1, opacity: 1 },
      { offset: 0.7, transform: 'translateY(-5px) rotate(-1deg)', easing: RISE },
      { offset: 0.85, transform: 'translateY(-25px) rotate(-1.5deg)', easing: GRAVITY },
      { offset: 1, opacity: 1, transform: 'translateY(-10px) rotate(0)' },
    ], { duration: 420 });
    mouth.style.opacity = 0;
    if (!skipped) shine.animate([{ opacity: 0, transform: 'translateX(0)' }, { opacity: 1, offset: 0.3 }, { opacity: 0, transform: `translateX(${shineTravel}px)` }], { duration: 340, easing: 'ease-in-out' });
    setTimeout(() => { if (!skipped) { click(); navigator.vibrate?.(15); } }, 120);
    await run(lid, [
      { transform: 'translateY(-10px) rotate(0)' },
      { transform: 'translateY(-10px) rotate(-4deg)', offset: 0.45, easing: 'cubic-bezier(.2,.9,.3,1.3)' },
      { transform: 'translateY(0) rotate(0)' },
    ], { duration: 260 });
    show('kept');
  }

  /** @param lid  false leaves the jar open (the keep screen closes it later with lidOn) */
  async function foldIn({ lid: withLid = true } = {}) {
    skipped = false;
    if (reduceMotion()) return show(withLid ? 'kept' : 'filled');
    // Fold 1: top-right half over the diagonal; its back is paper.
    base.style.clipPath = SQUARE;
    await run(f1, [{ transform: 'rotate3d(1,1,0,0deg)' }, { transform: 'rotate3d(1,1,0,90deg)' }], { duration: 140, easing: 'cubic-bezier(.6,0,1,1)' });
    asPaper(f1, true);
    await run(f1, [{ transform: 'rotate3d(1,1,0,90deg)' }, { transform: 'rotate3d(1,1,0,180deg)' }], { duration: 140, easing: 'cubic-bezier(0,0,.4,1)' });
    // Fold 2: the triangle in half.
    asPaper(base, true);
    f1.hidden = true;
    base.style.clipPath = HALF;
    f2.hidden = false;
    await run(f2, [{ transform: 'rotate3d(1,-1,0,0deg)' }, { transform: 'rotate3d(1,-1,0,-180deg)' }], { duration: 220, easing: EASE });
    // Fold 3: and in half again.
    f2.hidden = true;
    base.style.clipPath = QUARTER;
    f3.hidden = false;
    await run(f3, [{ transform: 'rotateX(0deg)' }, { transform: 'rotateX(180deg)' }], { duration: 200, easing: EASE });
    // Flip into the jar with a short light trail.
    const flight = [{ transform: 'none' }, { transform: midAir, offset: 0.45 }, { transform: inJar }];
    whoosh(false);
    trail(flight, 440);
    await run(main, flight.map((f, i) => ({ ...f, opacity: i === 2 ? 0 : 1 })), { duration: 440, easing: 'cubic-bezier(.45,0,.75,.5)' });
    energy();
    await run(sky, [{ opacity: 0, transform: 'scale(.7)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 220, easing: 'cubic-bezier(.2,.8,.3,1)' });
    if (withLid) await lidOn();
    else show('filled');
  }

  /** @param quick  the short version (~0.55s) for every open after the first: lid off, photo out already flat */
  async function foldOut({ quick = false } = {}) {
    // No reset here: a tap that lands before the first frame still skips.
    if (reduceMotion()) return show('open');
    show('kept');
    if (quick) {
      await run(lid, [{ transform: 'translateY(0)', opacity: 1 }, { transform: 'translateY(-200px) rotate(-6deg)', opacity: 0 }], { duration: 160, easing: 'cubic-bezier(.2,.7,.3,1)' });
      mouth.style.opacity = 1;
      sky.style.opacity = 0;
      f3.hidden = true;
      base.style.clipPath = 'none';
      asPaper(base, false);
      whoosh(true);
      await run(main, [{ transform: inJar, opacity: 0 }, { transform: 'none', opacity: 1 }], { duration: 380, easing: 'cubic-bezier(.2,.7,.3,1)' });
      return show('open');
    }
    // One twist and a click, then the lid lifts off.
    click();
    await twist(1);
    await run(lid, [{ transform: 'translateY(0) rotate(0)', opacity: 1 }, { transform: 'translateY(-260px) rotate(-6deg)', opacity: 0 }], { duration: 220, easing: 'cubic-bezier(.2,.7,.3,1)' });
    mouth.style.opacity = 1;
    energy();
    await run(sky, [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(.7)' }], { duration: 170 });
    const flight = [{ transform: inJar }, { transform: midAir, offset: 0.55 }, { transform: 'none' }];
    whoosh(true);
    trail(flight, 400);
    await run(main, flight.map((f, i) => ({ ...f, opacity: i === 0 ? 0 : 1 })), { duration: 400, easing: 'cubic-bezier(.2,.6,.3,1)' });
    await run(f3, [{ transform: 'rotateX(180deg)' }, { transform: 'rotateX(0deg)' }], { duration: 180, easing: EASE });
    f3.hidden = true;
    base.style.clipPath = HALF;
    f2.hidden = false;
    await run(f2, [{ transform: 'rotate3d(1,-1,0,-180deg)' }, { transform: 'rotate3d(1,-1,0,0deg)' }], { duration: 200, easing: EASE });
    f2.hidden = true;
    base.style.clipPath = SQUARE;
    f1.hidden = false;
    asPaper(f1, true);
    await run(f1, [{ transform: 'rotate3d(1,1,0,180deg)' }, { transform: 'rotate3d(1,1,0,90deg)' }], { duration: 130, easing: 'cubic-bezier(.6,0,1,1)' });
    asPaper(f1, false);
    asPaper(base, false);
    await run(f1, [{ transform: 'rotate3d(1,1,0,90deg)' }, { transform: 'rotate3d(1,1,0,0deg)' }], { duration: 130, easing: 'cubic-bezier(0,0,.4,1)' });
    show('open');
  }

  return { el, card: main, foldIn, foldOut, lidOn, skip, isSkipped: () => skipped };
}

// Twine tied in a bow: dark edge, mid tone, and a dashed light twist on top; frayed ends and a wrapped knot.
const TWINE = 'M22 12C16 2 3 3 4.5 10.5 6 16.5 16 15 22 12ZM22 12C27.5 4 39 5 38 11.5 37 16 28 15 22 12ZM22 12C19 17 15.5 21.5 10 26.5M22 12C25 17 27.5 21 32.5 25';
const BOW = `<svg class="bow" viewBox="0 0 44 28" aria-hidden="true">
  <path d="${TWINE}" stroke="#5e4327" stroke-width="2.8"/><path d="${TWINE}" stroke="#a07c4c" stroke-width="1.9"/>
  <path d="${TWINE}" stroke="#d6bb8e" stroke-width="1.2" stroke-dasharray=".7 1.6"/>
  <path d="M10 26.5 8.3 27.6M10 26.5 9.4 28.2M32.5 25 34.3 25.8M32.5 25 33.2 26.9" stroke="#a07c4c" stroke-width=".7"/>
  <ellipse cx="22" cy="12" rx="2.3" ry="2.8" fill="#8a6a43" stroke="#5e4327" stroke-width=".8"/>
  <path d="M21.2 9.8C22.6 11 22.6 13 21.2 14.2" stroke="#d6bb8e" stroke-width=".6"/></svg>`;

/** The rolled note lying on the bottom of a jar, tied with its bow. */
export function noteScroll(paper) {
  const rest = document.createElement('div');
  rest.className = `note-roll is-resting ${paper}`;
  rest.innerHTML = BOW;
  return rest;
}

// A tap skips the note's animations the same way it skips the fold: every remaining step lands at once.
// `skipped` comes from the jar's stage, so a tap made before the note starts still counts.
let noteSkipped = false;
let stageSkipped = () => false;
const isSkipped = () => noteSkipped || stageSkipped();
export function skipNote() {
  noteSkipped = true;
  document.querySelectorAll('.note-fly, .note-ghost, .view-note').forEach((n) => n.getAnimations({ subtree: true }).forEach((a) => a.finish()));
}
const startNote = (skipped) => { noteSkipped = false; stageSkipped = skipped || (() => false); };
const wait = (ms) => (isSkipped() ? Promise.resolve() : new Promise((r) => setTimeout(r, ms)));
const go = (node, frames, opts) => (isSkipped() ? Promise.resolve()
  : node.animate(frames, { fill: 'forwards', ...opts }).finished.catch(() => {}));

/**
 * The note slip rolls up into a little scroll, gets a twine bow, and is tossed into the open jar,
 * where it comes to rest on the bottom.
 * @param slip   the note slip on screen (hidden once the roll starts)
 * @param jar    the jar element the scroll lands in
 * @param paper  the slip's paper class, so the scroll is the same colour
 * @param quick    the shorter version, for putting a note back
 * @param skipped  the stage's isSkipped, when there is one
 */
export async function rollNote(slip, jar, paper, { quick = false, skipped } = {}) {
  startNote(skipped);
  const k = quick ? 0.6 : 1;
  const rest = noteScroll(paper);
  if (reduceMotion()) { slip.style.visibility = 'hidden'; jar.append(rest); return; }

  // A stand-in for the slip, laid exactly over it, rolls up from the right into a tube that thickens as it goes.
  const b = slip.getBoundingClientRect();
  const w = slip.offsetWidth, h = slip.offsetHeight;
  const cx0 = b.left + b.width / 2, cy0 = b.top + b.height / 2;
  const ghost = slip.cloneNode(true);
  ghost.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'));
  ghost.classList.add('note-ghost');
  ghost.style.cssText = `left:${cx0 - w / 2}px;top:${cy0 - h / 2}px;width:${w}px;height:${h}px`;
  document.body.append(ghost);
  slip.style.visibility = 'hidden';
  const tube = document.createElement('div');
  tube.className = `note-roll ${paper}`;
  tube.style.cssText = `left:${cx0 + w / 2 - 12}px;top:${cy0 - h / 2 - 2}px;width:14px;height:${h + 4}px`;
  const fly = document.createElement('div');
  fly.className = 'note-fly';
  fly.append(tube);
  document.body.append(fly);
  const travel = w - 18, roll = { duration: 560 * k, easing: 'cubic-bezier(.45,0,.25,1)' };
  await Promise.all([
    go(ghost, [{ clipPath: 'inset(0 0 0 0)' }, { clipPath: `inset(0 ${travel + 6}px 0 0)` }], roll),
    go(tube, [{ transform: 'translateX(0)', width: '14px' }, { transform: `translateX(${-travel}px)`, width: '22px' }], roll),
  ]);
  ghost.remove();

  // Tied with a bow, and the knot pulled tight.
  const base = `translateX(${-travel}px)`;
  tube.insertAdjacentHTML('beforeend', BOW);
  go(tube.querySelector('.bow'), [{ transform: 'translate(-50%,-50%) rotate(90deg) scale(0)' }, { transform: 'translate(-50%,-50%) rotate(90deg) scale(1)' }], { duration: 300, easing: MOTION.spring });
  await wait(140 * k);
  if (!quick) await go(tube, [{ transform: `${base} rotate(0)` }, { transform: `${base} rotate(-4deg)` }, { transform: `${base} rotate(2deg)` }, { transform: `${base} rotate(0)` }], { duration: 240, easing: 'ease-in-out' });
  await wait(160 * k);

  // Tossed with gravity: it drifts across at a steady speed while it rises, slows at the top, then falls faster and faster.
  const t = tube.getBoundingClientRect(), j = jar.getBoundingClientRect();
  const cx = t.left + t.width / 2, cy = t.top + t.height / 2;
  const mx = j.left + j.width / 2 - cx, my = j.top - 44 - cy, iy = j.top + j.height * 0.82 - cy;
  const up = (dy, r, s) => `${base} translateY(${dy}px) rotate(${r}deg) scale(${s})`;
  const toss = { duration: 900 * k };
  whoosh(false);
  await Promise.all([
    go(fly, [{ offset: 0, transform: 'translateX(0)' }, { offset: 0.1, transform: 'translateX(0)' }, { offset: 1, transform: `translateX(${mx}px)` }], toss),
    go(tube, [
      { offset: 0, transform: up(0, 0, 1), easing: 'ease-out' },
      { offset: 0.1, transform: up(6, -5, 0.97), easing: RISE },
      { offset: 0.46, transform: up(my, 70, 0.84), easing: GRAVITY },
      { offset: 0.92, transform: up(iy - 8, 158, 0.6), opacity: 1 },
      { offset: 1, transform: up(iy, 168, 0.56), opacity: 0 },
    ], toss),
  ]);
  fly.remove();

  // It hits the bottom, bounces twice (smaller each time) and settles in front of the sky.
  jar.append(rest);
  if (isSkipped()) return;
  const at = (y, r) => `translate(-50%, calc(50% + ${y}px)) rotate(${r}deg)`;
  await rest.animate([
    { offset: 0, opacity: 0, transform: at(-10, 86), easing: GRAVITY },
    { offset: 0.22, opacity: 1, transform: at(0, 80), easing: RISE },
    { offset: 0.45, transform: at(-7, 84), easing: GRAVITY },
    { offset: 0.66, transform: at(0, 81), easing: RISE },
    { offset: 0.8, transform: at(-2, 82.5), easing: GRAVITY },
    { offset: 0.9, transform: at(0, 82) },
    { offset: 1, transform: at(0, 82) },
  ], { duration: 640 * k }).finished.catch(() => {});
  await wait(200 * k);
}

/**
 * The other way: the scroll resting in the jar hops out to where the slip goes, its bow comes undone,
 * and it unrolls to the right into the note slip.
 * @param rest   the scroll in the jar (noteScroll)
 * @param slip   the slip it becomes; starts clipped away
 * @param quick    no hop, just a short unroll in place, for every open after the first
 * @param skipped  the stage's isSkipped
 */
export async function unrollNote(rest, slip, paper, { quick = false, skipped } = {}) {
  startNote(skipped);
  const done = () => { rest.remove(); slip.style.clipPath = 'none'; slip.getAnimations().forEach((a) => a.cancel()); };
  if (reduceMotion() || isSkipped()) return done();
  const s = slip.getBoundingClientRect();
  const h = slip.offsetHeight;
  const tube = document.createElement('div');
  tube.className = `note-roll ${paper}`;
  tube.style.cssText = `left:${s.left}px;top:${s.top + s.height / 2 - h / 2 - 2}px;width:22px;height:${h + 4}px`;
  tube.innerHTML = BOW;
  const fly = document.createElement('div');
  fly.className = 'note-fly';
  fly.append(tube);
  document.body.append(fly);
  rest.style.opacity = 0;

  if (!quick) {
    // Out of the jar in an arc, slowing as it rises and dropping onto its spot.
    const r = rest.getBoundingClientRect(), t = tube.getBoundingClientRect();
    const dx = r.left + r.width / 2 - (t.left + t.width / 2), dy = r.top + r.height / 2 - (t.top + t.height / 2);
    const scale = Math.max(r.width, r.height) / t.height;
    whoosh(true);
    await go(tube, [
      { offset: 0, transform: `translate(${dx}px, ${dy}px) rotate(82deg) scale(${scale})`, easing: RISE },
      { offset: 0.5, transform: `translate(${dx * 0.4}px, ${Math.min(dy * 0.4, -40)}px) rotate(30deg) scale(1)`, easing: GRAVITY },
      { offset: 1, transform: 'none' },
    ], { duration: 620 });
    await go(tube.querySelector('.bow'), [{ transform: 'translate(-50%,-50%) rotate(90deg) scale(1)', opacity: 1 }, { transform: 'translate(-50%,-50%) rotate(140deg) scale(0)', opacity: 0 }], { duration: 220, easing: 'ease-in' });
  } else {
    tube.querySelector('.bow').remove();
  }

  // Unrolls to the right; the tube thins out as the paper leaves it.
  const travel = s.width - 14;
  const unroll = { duration: quick ? 360 : 520, easing: 'cubic-bezier(.3,0,.2,1)' };
  await Promise.all([
    go(slip, [{ clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0 0 0)' }], unroll),
    go(tube, [{ transform: 'translateX(0)', width: '22px', opacity: 1 }, { transform: `translateX(${travel - 8}px)`, width: '14px', opacity: 1, offset: 0.9 }, { transform: `translateX(${travel}px)`, width: '8px', opacity: 0 }], unroll),
  ]);
  fly.remove();
  done();
}
