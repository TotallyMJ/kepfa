// 1080×1920 images sized for an Instagram story, printed on paper under a Kepfa quote:
// one jarred sky with its handwritten note, one month's jar, or the whole year's shelf.

import { drawJar, jarPoint, JAR_RATIO } from './jar.js';
import { loadThumbs } from './pile.js';
import { loadImage } from './sky.js';
import { t, fmt, MONTHS, MONTHS_SHORT, CHALLENGE_TAG } from './strings.js';

const isThai = (s) => /[฀-๿]/.test(s);

const W = 1080, H = 1920;
const PAPER = '#F1EDE6';
const TAG = '#FBF9F5';
const INK = '#1E1C19';
const SOFT = '#6B645B';
const RULE = '#CFC7BB';

const SERIF = '"Cormorant Garamond", "IBM Plex Sans Thai", Georgia, serif';
const HAND = '"Reenie Beanie", "IBM Plex Sans Thai", sans-serif';
const SANS = '"IBM Plex Sans", "IBM Plex Sans Thai", system-ui, sans-serif';
const MONO = '"IBM Plex Mono", ui-monospace, monospace';

async function fontsReady() {
  try {
    await Promise.all([
      document.fonts.load('500 64px "Cormorant Garamond"'),
      document.fonts.load('italic 40px "Cormorant Garamond"'),
      document.fonts.load('64px "Reenie Beanie"'),
      document.fonts.load('40px "IBM Plex Sans"'),
      document.fonts.load('500 40px "IBM Plex Sans"'),
      document.fonts.load('40px "IBM Plex Sans Thai"'),
      document.fonts.load('40px "IBM Plex Mono"'),
    ]);
  } catch { /* fall back to system fonts */ }
}

function page() {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);
  // paper grain, and it stops IG's compression from banding flat areas
  const img = ctx.getImageData(0, 0, W, H);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 7;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
  return [c, ctx];
}

function toBlob(c) {
  return new Promise((resolve) => c.toBlob(resolve, 'image/jpeg', 0.92));
}

function text(ctx, str, x, y, { font, color = INK, align = 'center', spacing = 0 }) {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${spacing}px`;
  ctx.fillText(str, x, y);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
}

/** Name, then the quote that invites people in, then a rule. Returns the rule's y. */
function masthead(ctx, quote) {
  text(ctx, 'Kepfa', W / 2, 140, { font: `500 64px ${SERIF}` });
  const font = `italic 40px ${SERIF}`;
  ctx.font = font;
  const lines = wrap(ctx, `“${quote}”`, W - 220, 2);
  lines.forEach((ln, i) => text(ctx, ln, W / 2, 205 + i * 50, { font, color: '#3A3631' }));
  const y = 205 + (lines.length - 1) * 50 + 40;
  ctx.fillStyle = RULE;
  ctx.fillRect(90, y, W - 180, 2);
  return y;
}

function footer(ctx) {
  text(ctx, t.footer, W / 2, 1840, { font: `28px ${SANS}`, color: SOFT });
}

function wrap(ctx, str, maxW, maxLines) {
  // Wrap by words. Thai has no spaces between words, so it's split into words by the browser where it can,
  // and by characters only as a last resort.
  const tokens = !isThai(str) ? str.split(/(\s+)/)
    : 'Segmenter' in Intl ? Array.from(new Intl.Segmenter('th', { granularity: 'word' }).segment(str), (s) => s.segment)
      : Array.from(str);
  const lines = [];
  let line = '';
  for (const tok of tokens) {
    const test = line + tok;
    if (ctx.measureText(test).width > maxW && line.trim()) {
      lines.push(line.trim());
      line = tok.trimStart();
      if (lines.length === maxLines) break;
    } else {
      line = test;
    }
  }
  if (lines.length < maxLines && line.trim()) lines.push(line.trim());
  if (lines.length === maxLines && lines.join(' ').length < str.trim().length - 1) {
    lines[maxLines - 1] = lines[maxLines - 1].replace(/.$/, '…');
  }
  return lines;
}

// The place tag: manila card with tiny clouds and a stitched edge, hung on the same red thread as the note,
// which goes round the jar's neck. The strand behind the neck is drawn before the jar, the rest after.
const THREAD = '#B3261E', THREAD_DARK = '#7F1714';
const at = (bx, by, bw, px, py) => { const [x, y] = jarPoint(px, py, bw); return [bx + x, by + y]; };

function strand(ctx, from, ctl, to, k, color = THREAD) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.6 * k;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(...from);
  ctx.quadraticCurveTo(...ctl, ...to);
  ctx.stroke();
}

/** The turn of thread that passes behind the neck. */
function tagThreadBack(ctx, bx, by, bw) {
  const k = bw / 540;
  ctx.save();
  ctx.globalAlpha = 0.6;
  strand(ctx, at(bx, by, bw, 214, 330), at(bx, by, bw, 545, 300), at(bx, by, bw, 874, 330), k, THREAD_DARK);
  ctx.restore();
}

/** The card's outline: top corners clipped and softened, bottom corners rounded. `i` insets it (for the stitching). */
function tagPath(ctx, w, h, k, i = 0) {
  const c = 44 * k, r = 9 * k;
  ctx.beginPath();
  ctx.moveTo(c + i * 0.4, i);
  ctx.lineTo(w - c - i * 0.4, i);
  ctx.quadraticCurveTo(w - c + r * 0.6, i, w - c + r, i + r * 0.6);
  ctx.lineTo(w - i, c - r + i * 0.4);
  ctx.quadraticCurveTo(w - i, c, w - i, c + r);
  ctx.lineTo(w - i, h - r - i);
  ctx.quadraticCurveTo(w - i, h - i, w - r - i, h - i);
  ctx.lineTo(r + i, h - i);
  ctx.quadraticCurveTo(i, h - i, i, h - r - i);
  ctx.lineTo(i, c + r);
  ctx.quadraticCurveTo(i, c, i, c - r + i * 0.4);
  ctx.lineTo(c - r, i + r * 0.6);
  ctx.quadraticCurveTo(c - r * 0.6, i, c + i * 0.4, i);
  ctx.closePath();
}

/** A small cloud: three puffs on a flat base. */
function cloud(ctx, x, y, s) {
  ctx.beginPath();
  ctx.arc(x, y, 5 * s, Math.PI * 0.5, Math.PI * 1.5);
  ctx.arc(x + 7 * s, y - 4 * s, 7 * s, Math.PI, Math.PI * 1.9);
  ctx.arc(x + 15 * s, y - 1 * s, 5 * s, Math.PI * 1.3, Math.PI * 0.5);
  ctx.closePath();
  ctx.fill();
}

/** The tag itself, hanging from the knot on the right of the neck, with the place written on it by hand. */
function tag(ctx, bx, by, bw, label) {
  const k = bw / 540;
  const thai = isThai(label);
  const stitch = 12 * k;
  const pad = stitch + 18 * k;   // the writing keeps clear of the stitched line on both sides
  let size = (thai ? 40 : 60) * k, w = 190 * k, lines;
  const font = () => (thai ? `${size}px ${SANS}` : `${size}px ${HAND}`);
  // Wider for longer names, then smaller writing, until it fits in three lines.
  for (;;) {
    ctx.font = font();
    lines = wrap(ctx, label, w - pad * 2, 3);
    const fits = lines.join(' ').length >= label.trim().length - 1 && lines.every((ln) => ctx.measureText(ln).width <= w - pad * 2);
    if (fits || (w >= 300 * k && size <= (thai ? 30 : 44) * k)) break;
    if (w < 300 * k) w += 10 * k; else size -= 2 * k;
  }
  const lh = size * (thai ? 1.35 : 0.95);
  const h = Math.max(320 * k, 120 * k + lines.length * lh);
  const eye = 30 * k;   // eyelet centre, down from the top

  // Front turns of thread over the neck, the knot, then down to the eyelet.
  const knot = at(bx, by, bw, 872, 340);
  strand(ctx, at(bx, by, bw, 214, 332), at(bx, by, bw, 545, 362), knot, k);
  strand(ctx, at(bx, by, bw, 214, 338), at(bx, by, bw, 545, 372), knot, k);
  const [ex, ey] = at(bx, by, bw, 925, 540);

  ctx.save();
  ctx.translate(ex, ey);
  ctx.rotate((6 * Math.PI) / 180);
  ctx.translate(-w / 2, -eye);
  // Card, with a soft shadow on whatever is behind it.
  ctx.shadowColor = 'rgba(40, 25, 10, .22)';
  ctx.shadowBlur = 26 * k;
  ctx.shadowOffsetY = 10 * k;
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, '#F6EAD0');
  g.addColorStop(1, '#E8D6AB');
  ctx.fillStyle = g;
  tagPath(ctx, w, h, k);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.save();
  tagPath(ctx, w, h, k);
  ctx.clip();
  // Paper grain.
  for (let n = 0; n < (w * h) / 60; n++) {
    ctx.fillStyle = Math.random() < 0.5 ? 'rgba(120, 95, 50, .07)' : 'rgba(255, 250, 235, .12)';
    ctx.fillRect(Math.random() * w, Math.random() * h, 1.5 * k, 1.5 * k);
  }
  // Tiny pale-blue clouds, scattered on a loose grid.
  ctx.fillStyle = 'rgba(148, 174, 203, .22)';
  for (let y = 22 * k; y < h; y += 46 * k) {
    for (let x = ((y / (46 * k)) % 2) * 26 * k; x < w; x += 52 * k) cloud(ctx, x + 6 * k, y + 8 * k, k * (0.8 + ((x + y) % 3) * 0.12));
  }
  ctx.restore();
  // Stitched edge, then the reinforced eyelet with its hole.
  ctx.strokeStyle = '#B39A6A';
  ctx.lineWidth = 1.6 * k;
  ctx.setLineDash([5 * k, 5 * k]);
  tagPath(ctx, w, h, k, stitch);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = '#D9C08A';
  ctx.beginPath(); ctx.arc(w / 2, eye, 20 * k, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#FBF3DC';
  ctx.beginPath(); ctx.arc(w / 2, eye, 15 * k, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#CFC4B0';
  ctx.beginPath(); ctx.arc(w / 2, eye, 9 * k, 0, Math.PI * 2); ctx.fill();
  // The place, by hand.
  const top = eye + 40 * k + (h - eye - 40 * k - 24 * k - lines.length * lh) / 2;
  lines.forEach((ln, i) => text(ctx, ln, w / 2, top + lh * (i + 0.78), { font: font(), color: '#3A2F28' }));
  ctx.restore();

  // The thread goes down over the card and loops through the hole.
  strand(ctx, knot, [knot[0] + 26 * k, knot[1] + 60 * k], [ex, ey], k);
  strand(ctx, knot, [knot[0] + 6 * k, knot[1] + 80 * k], [ex + 2 * k, ey], k);
  ctx.fillStyle = THREAD;
  ctx.beginPath(); ctx.arc(...knot, 4.5 * k, 0, Math.PI * 2); ctx.fill();
}

// Real paper and tape (photos cut out of their backgrounds). A missing file falls back to a flat card.
const textures = {};
function texture(name) {
  textures[name] ||= new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = `assets/${name}.webp`;
  });
  return textures[name];
}

// Edges in the source photo [top, right, bottom, left] and how thick they draw. The torn edge is the tall bottom band.
const SLIPS = {
  torn: { src: [12, 12, 84, 12], dst: [8, 8, 57, 8] },
  note: { src: [12, 12, 12, 12], dst: [8, 8, 8, 8] },
};

/** The paper stretched to w×h without bending its edges: corners stay, sides and middle stretch. */
function stretchPaper(img, w, h, { src, dst }) {
  const c = document.createElement('canvas');
  c.width = Math.round(w);
  c.height = Math.round(h);
  const ctx = c.getContext('2d');
  const sw = img.naturalWidth, sh = img.naturalHeight;
  const sx = [0, src[3], sw - src[1], sw], sy = [0, src[0], sh - src[2], sh];
  const dx = [0, dst[3], c.width - dst[1], c.width], dy = [0, dst[0], c.height - dst[2], c.height];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      // Half a pixel of overlap so no hairline shows between pieces.
      ctx.drawImage(img, sx[i], sy[j], sx[i + 1] - sx[i], sy[j + 1] - sy[j],
        dx[i], dy[j], dx[i + 1] - dx[i] + (i < 2 ? 0.5 : 0), dy[j + 1] - dy[j] + (j < 2 ? 0.5 : 0));
    }
  }
  return c;
}

/** A slip of paper w×h, top-centre at cx,y, tilted; `inside` draws on it with 0,0 at its top-left. */
function slip(ctx, img, kind, cx, y, w, h, tilt, inside) {
  ctx.save();
  ctx.translate(cx, y + h / 2);
  ctx.rotate((tilt * Math.PI) / 180);
  ctx.translate(-w / 2, -h / 2);
  ctx.shadowColor = 'rgba(30, 28, 25, .16)';
  ctx.shadowBlur = 26;
  ctx.shadowOffsetY = 10;
  if (img) ctx.drawImage(stretchPaper(img, w, h, SLIPS[kind]), 0, 0);
  else { ctx.fillStyle = TAG; ctx.fillRect(0, 0, w, h); }
  ctx.shadowColor = 'transparent';
  inside();
  ctx.restore();
}

function tapeStrip(ctx, img, cx, cy, w, tilt) {
  if (!img) return;
  const h = (w * img.naturalHeight) / img.naturalWidth;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((tilt * Math.PI) / 180);
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  ctx.restore();
}

function swatches(ctx, palette, y) {
  const sw = palette.slice(0, 5);
  const size = 72, gap = 22;
  let x = (W - (sw.length * size + (sw.length - 1) * gap)) / 2;
  for (const p of sw) {
    ctx.fillStyle = p.hex;
    ctx.fillRect(x, y, size, size);
    text(ctx, p.hex.slice(1).toUpperCase(), x + size / 2, y + size + 40, { font: `22px ${MONO}`, color: SOFT });
    x += size + gap;
  }
}

/** @param challenge  {text, day, tag} when the sky was kept for that day's prompt */
async function storySingle(sky, showPlace, quote, challenge) {
  const [c, ctx] = page();
  const top = masthead(ctx, quote);
  const [paperImg, noteImg, tapeImg] = await Promise.all(['paper', 'note', 'tape'].map(texture));

  // A challenge sky makes room for the prompt slip and hashtags; the palette steps aside.
  const bw = challenge ? 430 : 540, bh = Math.round(bw * JAR_RATIO), bx = (W - bw) / 2, by = top + 50;
  const { img, release } = await loadImage(sky.photo);
  const placed = showPlace && sky.place;
  if (placed) tagThreadBack(ctx, bx, by, bw);
  drawJar(ctx, { x: bx, y: by, w: bw, image: img });
  release();
  if (placed) tag(ctx, bx, by, bw, sky.place);

  let y = by + bh + 60;
  if (sky.note) {
    // Handwriting for English; Thai keeps the regular face at a regular size.
    const thai = isThai(sky.note);
    const font = thai ? `44px ${SANS}` : `66px ${HAND}`;
    const lh = thai ? 62 : 68, pad = 30;
    ctx.font = font;
    const lines = wrap(ctx, sky.note, W - 320, 3);
    const w = Math.min(W - 180, Math.max(...lines.map((ln) => ctx.measureText(ln).width)) + 110);
    const h = lines.length * lh + pad * 2;
    slip(ctx, noteImg, 'note', W / 2, y, w, h, -2, () => {
      lines.forEach((ln, i) => text(ctx, ln, w / 2, pad + lh * 0.74 + i * lh, { font }));
    });
    y += h + 26;
  }
  text(ctx, fmt.stamp(sky.takenAt), W / 2, y + 36, { font: `36px ${MONO}`, color: SOFT });
  y += 66;

  if (challenge) {
    const w = 820, lh = 56;
    const font = `500 48px ${SERIF}`;
    ctx.font = font;
    const lines = wrap(ctx, challenge.text, w - 110, 2);
    const h = 56 + lines.length * lh + 24 + SLIPS.torn.dst[2];
    y += 34;
    slip(ctx, paperImg, 'torn', W / 2, y, w, h, 1, () => {
      text(ctx, `${t.lookFor} · ${challenge.day}`.toUpperCase(), w / 2, 56, { font: `22px ${SANS}`, color: SOFT, spacing: 4 });
      lines.forEach((ln, i) => text(ctx, ln, w / 2, 56 + lh + i * lh, { font }));
    });
    tapeStrip(ctx, tapeImg, W / 2 - 24, y + 2, 230, 4);
    text(ctx, `#${CHALLENGE_TAG} #${challenge.tag}`, W / 2, y + h + 64, { font: `32px ${MONO}` });
  } else {
    swatches(ctx, sky.palette, y + 40);
  }
  footer(ctx);
  return toBlob(c);
}

async function storyJar({ year, month, skies, quote }) {
  const [c, ctx] = page();
  const top = masthead(ctx, quote);
  text(ctx, MONTHS[month], W / 2, top + 130, { font: `500 128px ${SERIF}` });
  text(ctx, t.storyKept(year, skies.length), W / 2, top + 195, { font: `36px ${SANS}`, color: SOFT });

  // The month's shelf: every sky in its own jar, newest first, the day under each.
  // Try each column count and keep the one that gives the biggest jars in the space left.
  const list = skies.slice().reverse();
  const n = Math.max(list.length, 1);
  const gridTop = top + 260, gridBottom = 1760, gap = 24, label = 56;
  const fit = (cols) => {
    const rows = Math.ceil(n / cols);
    return Math.min((W - 200 - gap * (cols - 1)) / cols, ((gridBottom - gridTop) / rows - label) / JAR_RATIO, 300);
  };
  let cols = 1;
  for (let k = 2; k <= 7; k++) if (fit(k) > fit(cols)) cols = k;
  const jw = Math.floor(fit(cols)), jh = Math.round(jw * JAR_RATIO);
  const rows = Math.ceil(n / cols);
  let y = gridTop + Math.max(0, (gridBottom - gridTop - rows * (jh + label)) / 2);
  for (let r = 0; r < rows; r++) {
    const row = list.slice(r * cols, r * cols + cols);
    const rowW = row.length * jw + (row.length - 1) * gap;
    let x = (W - rowW) / 2;
    for (const s of row) {
      // Thumbnails, one at a time, so a full month doesn't hold 31 photos in memory at once.
      const { img, release } = await loadImage(s.thumb);
      drawJar(ctx, { x, y, w: jw, image: img });
      release();
      text(ctx, String(new Date(s.takenAt).getDate()).padStart(2, '0'), x + jw / 2, y + jh + 44, { font: `26px ${MONO}`, color: SOFT });
      x += jw + gap;
    }
    ctx.fillStyle = INK;
    ctx.globalAlpha = 0.85;
    ctx.fillRect(Math.min(90, (W - rowW) / 2 - 20), y + jh + 2, Math.max(W - 180, rowW + 40), 4);
    ctx.globalAlpha = 1;
    y += jh + label;
  }
  footer(ctx);
  return toBlob(c);
}

async function storyYear({ year, skies, quote }) {
  const [c, ctx] = page();
  const top = masthead(ctx, quote);
  text(ctx, String(year), W / 2, top + 140, { font: `500 140px ${SERIF}` });
  text(ctx, `${skies.length} ${t.kept(skies.length)}`, W / 2, top + 205, { font: `36px ${SANS}`, color: SOFT });

  const bw = 160, bh = Math.round(160 * JAR_RATIO), gapX = 70, rowH = bh + 90, firstRow = top + 260;
  const left = (W - (4 * bw + 3 * gapX)) / 2;
  await loadThumbs(skies);
  for (let m = 0; m < 12; m++) {
    const r = Math.floor(m / 4), col = m % 4;
    const x = left + col * (bw + gapX);
    const y = firstRow + r * rowH;
    const inMonth = skies.filter((s) => new Date(s.takenAt).getMonth() === m);
    // Months with nothing in them stay faint, so the jars that were filled stand out.
    drawJar(ctx, { x, y, w: bw, skies: inMonth, ghost: !inMonth.length });
    if (col === 0) {
      ctx.fillStyle = INK;
      ctx.globalAlpha = 0.6;
      ctx.fillRect(left - 30, y + bh + 4, 4 * bw + 3 * gapX + 60, 2);
      ctx.globalAlpha = 1;
    }
    text(ctx, MONTHS_SHORT[m], x + bw / 2, y + bh + 48, { font: `30px ${SANS}`, color: SOFT });
  }

  // The year as a strip of colors, one sliver per sky.
  const sx = 90, sy = firstRow + 3 * rowH + 20, sw = W - 180, sh = 90;
  ctx.fillStyle = TAG;
  ctx.fillRect(sx, sy, sw, sh);
  if (skies.length) {
    const bwid = sw / skies.length;
    skies.forEach((s, i) => {
      const grad = ctx.createLinearGradient(0, sy, 0, sy + sh);
      s.palette.forEach((p, j) => grad.addColorStop(s.palette.length === 1 ? 0.5 : j / (s.palette.length - 1), p.hex));
      ctx.fillStyle = grad;
      ctx.fillRect(sx + i * bwid, sy, bwid + 1, sh);
    });
  }
  text(ctx, t.stripCaption, W / 2, sy + sh + 46, { font: `26px ${SANS}`, color: SOFT });
  footer(ctx);
  return toBlob(c);
}

export async function makeStory(kind, payload) {
  await fontsReady();
  if (kind === 'single') return storySingle(payload.sky, payload.showPlace, payload.quote, payload.challenge);
  if (kind === 'jar') return storyJar(payload);
  return storyYear(payload);
}

/** Mobile: native share sheet (pick Instagram, then Stories). Desktop or unsupported: save the file. */
export async function shareImage(blob, filename) {
  const file = new File([blob], filename, { type: blob.type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return 'shared';
    } catch (e) {
      if (e.name === 'AbortError') return 'cancelled';
    }
  }
  saveImage(blob, filename);
  return 'saved';
}

export function saveImage(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}
