// Origami that carries a photo into its jar and back out: three folds down to a small triangle,
// a flip on the way in with a light trail, a ripple at the mouth, then one twist of the lid.

import { jarSvg, JAR_RATIO } from './jar.js';
import { whoosh, click } from './sound.js';

const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const EASE = 'cubic-bezier(.55,0,.35,1)';
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

  const show = (st) => {
    el.getAnimations({ subtree: true }).forEach((a) => a.cancel());
    const kept = st === 'kept';
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
    lid.style.opacity = kept ? 1 : 0;
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

  async function foldIn() {
    skipped = false;
    if (reduceMotion()) return show('kept');
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
    // Lid settles, then one twist and a click.
    lid.style.opacity = 1;
    await run(lid, [{ transform: 'translateY(-220px) rotate(-6deg)', opacity: 0 }, { transform: 'translateY(0) rotate(0)', opacity: 1 }], { duration: 200, easing: 'cubic-bezier(.3,0,.2,1)' });
    await twist(-1);
    click();
    show('kept');
  }

  /** @param quick  the short version (~0.55s) for every open after the first: lid off, photo out already flat */
  async function foldOut({ quick = false } = {}) {
    // No reset here: a tap that lands before the first frame still skips.
    if (reduceMotion()) return show('open');
    show('kept');
    if (quick) {
      await run(lid, [{ transform: 'translateY(0)', opacity: 1 }, { transform: 'translateY(-200px) rotate(-6deg)', opacity: 0 }], { duration: 160, easing: 'cubic-bezier(.2,.7,.3,1)' });
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

  return { el, foldIn, foldOut, skip };
}
