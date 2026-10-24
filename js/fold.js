// Origami fold that carries a photo into its jar and back out:
// fold the top half down, fold the right half over, drop the square in, screw the lid on.

import { jarSvg, JAR_RATIO } from './jar.js';

const EASE = 'cubic-bezier(.6,0,.3,1)';
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * @param href   photo URL
 * @param width  card width in CSS px; the jar sits underneath, slightly wider
 * @param state  'open' = photo out, jar empty and unlidded; 'kept' = photo in a lidded jar
 */
export function foldStage(href, width, state) {
  const cw = Math.round(width);
  const ch = Math.round(cw * 4 / 3);
  const jw = Math.round(cw * 1.1);
  const jh = Math.round(jw * JAR_RATIO);
  const jarTop = Math.round(ch * 0.55);

  const el = document.createElement('div');
  el.className = 'fold-stage';
  el.style.height = `${jarTop + jh}px`;
  const half = (top) => `<div class="fold-face"><div class="fold-img" style="background-image:url('${href}');height:${ch}px;top:${top}px"></div></div>`;
  el.innerHTML = `
    <div class="fold-jar" style="top:${jarTop}px;width:${jw}px">${jarSvg({ href })}</div>
    <div class="fold-card" style="width:${cw}px;height:${ch}px;left:calc(50% - ${cw / 2}px)">
      <div class="fold-bottom">${half(-ch / 2)}<div class="fold-right"><div class="fold-face fold-paper fold-front"></div><div class="fold-face fold-paper fold-back"></div></div></div>
      <div class="fold-top">${half(0)}<div class="fold-face fold-paper fold-under"></div></div>
    </div>`;

  const card = el.querySelector('.fold-card');
  const top = el.querySelector('.fold-top');
  const right = el.querySelector('.fold-right');
  const sky = el.querySelector('.j-sky');
  const lid = el.querySelector('.j-lid');
  const ridges = el.querySelector('.j-ridges');
  // Where the folded quarter (bottom-left of the card) ends up: over the jar's mouth.
  const inJar = `translate(${cw / 4}px, ${jarTop + jh * 0.3 - ch * 0.75}px) scale(.3)`;

  const show = (s) => {
    const kept = s === 'kept';
    card.classList.toggle('is-folded', kept);
    card.style.opacity = kept ? 0 : 1;
    card.style.transform = kept ? inJar : '';
    top.style.transform = kept ? 'rotateX(-180deg)' : '';
    right.style.transform = kept ? 'rotateY(-180deg)' : '';
    sky.style.opacity = kept ? 1 : 0;
    lid.style.opacity = kept ? 1 : 0;
    lid.style.transform = '';
  };
  show(state);

  const run = (node, frames, opts) => node.animate(frames, { fill: 'forwards', ...opts }).finished;

  async function foldIn() {
    if (reduceMotion()) return show('kept');
    await run(top, [{ transform: 'rotateX(0deg)' }, { transform: 'rotateX(-180deg)' }], { duration: 550, easing: EASE });
    card.classList.add('is-folded');
    await run(right, [{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(-180deg)' }], { duration: 500, easing: EASE });
    await run(card, [
      { transform: 'translate(0,0) scale(1)', opacity: 1 },
      { transform: `translate(${cw / 4}px, ${jarTop * 0.4}px) scale(.55)`, opacity: 1, offset: 0.5 },
      { transform: inJar, opacity: 0 },
    ], { duration: 700, easing: 'cubic-bezier(.5,0,.8,.4)' });
    await run(sky, [{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 500, easing: 'cubic-bezier(.2,.8,.3,1)' });
    lid.style.opacity = 1;
    await run(lid, [{ transform: 'translateY(-40px)' }, { transform: 'translateY(0)' }], { duration: 450, easing: 'cubic-bezier(.3,0,.2,1)' });
    ridges.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-4px)' }, { transform: 'translateX(0)' }], { duration: 500 });
    show('kept');
  }

  async function foldOut() {
    if (reduceMotion()) return show('open');
    show('kept');
    ridges.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(4px)' }], { duration: 350 });
    await run(lid, [{ transform: 'translateY(0) rotate(0)', opacity: 1 }, { transform: 'translateY(-40px) rotate(-8deg)', opacity: 0 }], { duration: 500, easing: 'cubic-bezier(.4,0,.2,1)' });
    await run(sky, [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(.6)' }], { duration: 400 });
    await run(card, [
      { transform: inJar, opacity: 0 },
      { transform: `translate(${cw / 4}px, ${jarTop * 0.4}px) scale(.55)`, opacity: 1, offset: 0.5 },
      { transform: 'translate(0,0) scale(1)', opacity: 1 },
    ], { duration: 650, easing: 'cubic-bezier(.2,.6,.3,1)' });
    await run(right, [{ transform: 'rotateY(-180deg)' }, { transform: 'rotateY(0deg)' }], { duration: 500, easing: EASE });
    card.classList.remove('is-folded');
    await run(top, [{ transform: 'rotateX(-180deg)' }, { transform: 'rotateX(0deg)' }], { duration: 550, easing: EASE });
    el.getAnimations({ subtree: true }).forEach((a) => a.cancel());
    show('open');
  }

  return { el, foldIn, foldOut };
}
