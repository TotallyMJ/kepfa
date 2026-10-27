// 1080×1920 images sized for an Instagram story, printed on paper under a Kepfa quote:
// one jarred sky with its handwritten note, one month's jar, or the whole year's shelf.

import { drawJar, jarPoint, JAR_RATIO, INSIDE } from './jar.js';
import { loadThumbs, ROLLS, paperIndex, pileFor, drawPile } from './pile.js';
import { loadImage } from './sky.js';
import { t, fmt, MONTHS, MONTHS_SHORT, CHALLENGE_TAG, CHALLENGE_SIZE } from './strings.js';

const isThai = (s) => /[฀-๿]/.test(s);

const W = 1080, H = 1920;
const PAPER = '#F1EDE6';
const GRID = 'rgba(74, 120, 184, .1)', GRID_CELL = 60;
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
  // The app's grid paper (--grid), at the size it reads on a phone held full screen.
  ctx.fillStyle = GRID;
  for (let x = GRID_CELL - 1; x < W; x += GRID_CELL) ctx.fillRect(x, 0, 2, H);
  for (let y = GRID_CELL - 1; y < H; y += GRID_CELL) ctx.fillRect(0, y, W, 2);
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

// Laid out like a page of a quiet magazine: wide margins, a running line at the top with a hairline under it,
// the name set large in the serif, the quote as its dek, and a hairline footer with an issue number.
const MARGIN = 86;
const smallCaps = (ctx, str, x, y, align) => text(ctx, str.toUpperCase(), x, y, { font: `500 25px ${SANS}`, color: SOFT, align, spacing: 6 });

/**
 * @param issue  the running line's right side, e.g. "Issue · October 2026"
 * @param title  the one big title: the name on a single sky's page, the month or the year on theirs (set in italic)
 * @param kicker a line under the quote, between two hairlines, e.g. "2026 · 8 skies kept"
 * @returns where the page's content starts
 */
function masthead(ctx, quote, issue, { title = 'Kepfa', kicker = '' } = {}) {
  // A single sky has no title of its own, so the quote is the headline and the name shrinks to one small line.
  if (title === 'Kepfa') {
    smallCaps(ctx, `Kepfa · ${issue}`, W / 2, 118, 'center');
    ctx.fillStyle = INK;
    ctx.fillRect(W / 2 - 120, 148, 240, 2);
    const font = `italic 74px ${SERIF}`;
    ctx.font = font;
    // Balanced: narrow the measure while the line count holds, so a quote never ends on a lone word or two.
    const maxW = W - MARGIN * 2 - 40;
    let lines = wrap(ctx, quote, maxW, 3);
    for (let w = maxW - 20; lines.length > 1 && w > maxW * 0.5; w -= 20) {
      const tighter = wrap(ctx, quote, w, 3);
      if (tighter.length > lines.length) break;
      lines = tighter;
    }
    lines.forEach((ln, i) => text(ctx, ln, W / 2, 240 + i * 80, { font }));
    return 240 + (lines.length - 1) * 80 + 40;
  }
  smallCaps(ctx, 'Kepfa', MARGIN, 118, 'left');
  smallCaps(ctx, issue, W - MARGIN, 118, 'right');
  ctx.fillStyle = INK;
  ctx.fillRect(MARGIN, 140, W - MARGIN * 2, 2);
  text(ctx, title, W / 2, 268, { font: `${title === 'Kepfa' ? '' : 'italic '}500 122px ${SERIF}` });
  const font = `italic 41px ${SERIF}`;
  ctx.font = font;
  const lines = wrap(ctx, `“${quote}”`, W - MARGIN * 2 - 60, 2);
  lines.forEach((ln, i) => text(ctx, ln, W / 2, 330 + i * 50, { font, color: '#4A443D' }));
  let y = 330 + (lines.length - 1) * 50 + 30;
  if (kicker) {
    const ky = y + 34;
    smallCaps(ctx, kicker, W / 2, ky, 'center');
    ctx.font = `500 25px ${SANS}`;
    const half = (ctx.measureText(kicker.toUpperCase()).width + kicker.length * 6) / 2 + 30;
    ctx.fillStyle = RULE;
    ctx.fillRect(MARGIN, ky - 9, W / 2 - half - MARGIN, 2);
    ctx.fillRect(W / 2 + half, ky - 9, W / 2 - half - MARGIN, 2);
    y = ky + 20;
  }
  return y;
}

/** A pale oak shelf w wide whose top is at y: a lit top edge, a slightly darker front, a soft shadow on the page. */
function shelf(ctx, x, y, w) {
  const h = 46;   // as in the app: a lit top face (the jars stand at its back, the tent cards at its front), then the front edge
  const shade = ctx.createLinearGradient(0, y + h - 6, 0, y + h + 30);
  shade.addColorStop(0, 'rgba(60, 40, 20, .3)');
  shade.addColorStop(1, 'rgba(60, 40, 20, 0)');
  ctx.fillStyle = shade;
  ctx.fillRect(x + 6, y + h - 6, w - 12, 36);
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#EFE3CD'); g.addColorStop(0.4, '#E7D8BC');
  g.addColorStop(0.4, '#D9C6A5'); g.addColorStop(0.58, '#D9C6A5');
  g.addColorStop(0.58, '#C8B08A'); g.addColorStop(1, '#C3AA82');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 5); ctx.fill();
}

/** The soft shadow a jar casts where it stands, centred under cx at y. */
function standShadow(ctx, cx, y, w) {
  const g = ctx.createRadialGradient(cx, y, 0, cx, y, w / 2);
  g.addColorStop(0, 'rgba(40, 28, 15, .32)');
  g.addColorStop(1, 'rgba(40, 28, 15, 0)');
  ctx.save();
  ctx.translate(cx, y);
  ctx.scale(1, 0.18);
  ctx.translate(-cx, -y);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, y, w / 2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

/**
 * A low folded card standing at the front of the shelf: the month, and how many skies in red, on one line.
 * Kept short so it hides as little as possible of what's piled in the jar behind it. Its foot is at y.
 */
function tentCard(ctx, cx, y, w, month, count) {
  const h = w * 0.36, x = cx - w / 2, top = y - h;
  // The back half, showing as a sliver above the fold.
  ctx.fillStyle = '#DCCFB6';
  ctx.fillRect(x + w * 0.08, top - h * 0.12, w * 0.84, h * 0.12);
  ctx.shadowColor = 'rgba(60, 40, 20, .38)';
  ctx.shadowBlur = h * 0.3;
  ctx.shadowOffsetY = h * 0.12;
  const g = ctx.createLinearGradient(0, top, 0, y);
  g.addColorStop(0, '#F7F1E6');
  g.addColorStop(1, '#EAE0CF');
  ctx.fillStyle = g;
  ctx.fillRect(x, top, w, h);
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = 'rgba(70, 45, 20, .35)';
  ctx.fillRect(x, y - 1.5, w, 2);
  const k = w / 38, base = top + h * 0.66;
  const label = month.toUpperCase();
  ctx.font = `600 ${4.6 * k}px ${SANS}`;
  const lw = ctx.measureText(label).width + label.length * k;
  ctx.font = `${4.4 * k}px ${MONO}`;
  const cw = ctx.measureText(count).width, gap = 3.2 * k, start = cx - (lw + gap + cw) / 2;
  text(ctx, label, start, base, { font: `600 ${4.6 * k}px ${SANS}`, color: INK, align: 'left', spacing: k });
  text(ctx, count, start + lw + gap, base, { font: `${4.4 * k}px ${MONO}`, color: '#B3261E', align: 'left' });
}

/** The last line of every image: the app's name and where to find it. */
function footer(ctx) {
  ctx.fillStyle = INK;
  ctx.fillRect(MARGIN, H - 112, W - MARGIN * 2, 2);
  text(ctx, 'KEPFA', MARGIN, H - 74, { font: `600 25px ${SANS}`, color: INK, align: 'left', spacing: 6 });
  text(ctx, t.site, W - MARGIN, H - 74, { font: `500 25px ${MONO}`, color: INK, align: 'right' });
}

function wrap(ctx, str, maxW, maxLines) {
  // Wrap by words. Thai has no spaces between words, so it's split into words by the browser where it can,
  // and by characters only as a last resort.
  // A comma with no space after it ("bangkok,thailand") can still break.
  const tokens = !isThai(str) ? str.split(/(\s+)|(?<=,)(?=\S)/).filter(Boolean)
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
  const k = Math.max(bw / 540, 0.62);   // a small jar still gets a tag you can read
  const thai = isThai(label);
  const stitch = 12 * k;
  const pad = stitch + 18 * k;   // the writing keeps clear of the stitched line on both sides
  let size = (thai ? 40 : 60) * k, lines;
  const w = 190 * k;
  const font = () => (thai ? `${size}px ${SANS}` : `${size}px ${HAND}`);
  // The card keeps its shape: a longer name wraps and the writing gets smaller, until it fits in three lines.
  for (;;) {
    ctx.font = font();
    lines = wrap(ctx, label, w - pad * 2, 3);
    const fits = lines.join(' ').length >= label.trim().length - 1 && lines.every((ln) => ctx.measureText(ln).width <= w - pad * 2);
    if (fits || size <= (thai ? 24 : 34) * k) break;
    size -= 2 * k;
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
  // The note: the same torn paper, torn along the top as well, as in the app.
  torn2: { src: [12, 12, 84, 12], dst: [8, 8, 57, 8], both: true },
};

/** Tears the top edge too: the paper is cut by its own torn outline turned upside down. */
function tearTop(paper) {
  const c = document.createElement('canvas');
  c.width = paper.width;
  c.height = paper.height;
  const x = c.getContext('2d');
  x.drawImage(paper, 0, 0);
  x.globalCompositeOperation = 'destination-in';
  x.translate(0, c.height);
  x.scale(1, -1);
  x.drawImage(paper, 0, 0);
  return c;
}

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

/** The paper multiplied by a colour, keeping its own torn outline. */
function tintPaper(paper, color) {
  const c = document.createElement('canvas');
  c.width = paper.width;
  c.height = paper.height;
  const x = c.getContext('2d');
  x.drawImage(paper, 0, 0);
  // Take the colour's hue but keep the paper's own light and grain, then lift it a little so it stays a pale paper.
  x.globalCompositeOperation = 'color';
  x.fillStyle = color;
  x.fillRect(0, 0, c.width, c.height);
  x.globalCompositeOperation = 'soft-light';
  x.fillStyle = 'rgba(255, 255, 255, .5)';
  x.fillRect(0, 0, c.width, c.height);
  x.globalCompositeOperation = 'destination-in';
  x.drawImage(paper, 0, 0);
  return c;
}

/** A slip of paper w×h, top-centre at cx,y, tilted; `inside` draws on it with 0,0 at its top-left. `tint` colours the paper. */
function slip(ctx, img, kind, cx, y, w, h, tilt, inside, tint) {
  ctx.save();
  ctx.translate(cx, y + h / 2);
  ctx.rotate((tilt * Math.PI) / 180);
  ctx.translate(-w / 2, -h / 2);
  ctx.shadowColor = 'rgba(30, 28, 25, .16)';
  ctx.shadowBlur = 26;
  ctx.shadowOffsetY = 10;
  if (img) {
    const paper = SLIPS[kind].both ? tearTop(stretchPaper(img, w, h, SLIPS[kind])) : stretchPaper(img, w, h, SLIPS[kind]);
    ctx.drawImage(tint ? tintPaper(paper, tint) : paper, 0, 0);
  }
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


/** A photo print with its white border, the time written on the bottom edge, tilted; cx,y is its top centre. */
function polaroid(ctx, img, cx, y, w, tilt, caption) {
  const pad = w * 0.044, foot = w * 0.14, ph = w - pad * 2;
  const h = pad + ph + foot;
  ctx.save();
  ctx.translate(cx, y + h / 2);
  ctx.rotate((tilt * Math.PI) / 180);
  ctx.translate(-w / 2, -h / 2);
  ctx.shadowColor = 'rgba(30, 28, 25, .32)';
  ctx.shadowBlur = 50;
  ctx.shadowOffsetY = 24;
  ctx.fillStyle = '#FDFCF8';
  ctx.fillRect(0, 0, w, h);
  ctx.shadowColor = 'transparent';
  const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
  const s = Math.min(iw, ih);
  ctx.drawImage(img, (iw - s) / 2, (ih - s) / 2, s, s, pad, pad, ph, ph);
  text(ctx, caption, w / 2, h - foot * 0.36, { font: `32px ${MONO}`, color: SOFT, spacing: 3 });
  ctx.restore();
  return h;
}

/** Letters set round a circle, starting at the top and running clockwise. */
function ringText(ctx, str, cx, cy, r, font) {
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const total = [...str].reduce((a, ch) => a + ctx.measureText(ch).width, 0);
  const gap = (Math.PI * 2 * r - total) / str.length;
  let a = -Math.PI / 2;
  for (const ch of str) {
    const cw = ctx.measureText(ch).width;
    a += (cw / 2) / r;
    ctx.save();
    ctx.translate(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    ctx.rotate(a + Math.PI / 2);
    ctx.fillText(ch, 0, 0);
    ctx.restore();
    a += (cw / 2 + gap) / r;
  }
  ctx.textBaseline = 'alphabetic';
}

/** The month's pile drawn into the jar's inside (so the glass still goes over it), with this sky as a small unfolded print on top. */
function jarContents(month, img) {
  const c = document.createElement('canvas');
  c.width = INSIDE.w;
  c.height = INSIDE.h;
  const x = c.getContext('2d');
  x.translate(-INSIDE.x, -INSIDE.y);
  drawPile(x, pileFor(month));
  // Always low in the jar, under the label and in front of the pile, so it shows however full the month is.
  const s = INSIDE.w * 0.4, b = s * 0.07;
  x.translate(INSIDE.x + INSIDE.w * 0.5, INSIDE.y + INSIDE.h * 0.72);
  x.rotate(-0.22);
  x.shadowColor = 'rgba(30, 28, 25, .35)';
  x.shadowBlur = 14;
  x.shadowOffsetY = 5;
  x.fillStyle = '#FDFCF8';
  x.fillRect(-s / 2 - b, -s / 2 - b, s + b * 2, s + b * 3.4);
  x.shadowColor = 'transparent';
  const k = Math.max(s / img.naturalWidth, s / img.naturalHeight);
  x.beginPath(); x.rect(-s / 2, -s / 2, s, s); x.clip();
  x.drawImage(img, (-img.naturalWidth * k) / 2, (-img.naturalHeight * k) / 2, img.naturalWidth * k, img.naturalHeight * k);
  return c;
}

/**
 * A printed jam label with the month on it, in the jar's upper middle, made to look real: cream stock with grain and fibres,
 * a hand-cut scalloped edge, uneven red stitches, ink soaked into the paper, shaded as it wraps round the glass, and the glass's glare.
 */
function jamLabel(ctx, bw, bh, month, year, tagged) {
  // With a place tag hanging on the right, the label is a little smaller and sits left of it.
  const w = bw * (tagged ? 0.6 : 0.74), h = bw * (tagged ? 0.3 : 0.36), pad = 6, cx = bw * (tagged ? 0.42 : 0.5);
  const c = document.createElement('canvas');
  c.width = w + pad * 2;
  c.height = h + pad * 2;
  const x = c.getContext('2d');
  x.translate(c.width / 2, c.height / 2);
  const wob = (a) => Math.sin(a * 16) * 0.028 + Math.sin(a * 5 + 1.3) * 0.006;
  const edge = () => {
    x.beginPath();
    for (let i = 0; i <= 160; i++) { const a = (i / 160) * Math.PI * 2, r = 1 + wob(a); x.lineTo(Math.cos(a) * (w / 2) * r, Math.sin(a) * (h / 2) * r); }
    x.closePath();
  };
  // A soft shadow where the edge lifts off the glass.
  x.save(); x.shadowColor = 'rgba(40, 30, 20, .35)'; x.shadowBlur = 5; x.shadowOffsetY = 1.5; edge(); x.fillStyle = '#F6EEDB'; x.fill(); x.restore();
  x.save();
  edge();
  x.clip();
  const paper = x.createRadialGradient(-w * 0.1, -h * 0.2, 0, 0, 0, w * 0.6);
  paper.addColorStop(0, '#FCF6E8');
  paper.addColorStop(1, '#EFE4CB');
  x.fillStyle = paper;
  x.fillRect(-w / 2 - 4, -h / 2 - 4, w + 8, h + 8);
  for (let n = 0; n < (w * h) / 9; n++) {
    x.fillStyle = Math.random() < 0.5 ? 'rgba(120, 95, 55, .07)' : 'rgba(255, 255, 255, .18)';
    x.fillRect((Math.random() - 0.5) * w, (Math.random() - 0.5) * h, 1.2, 1.2);
  }
  x.strokeStyle = 'rgba(150, 120, 80, .14)';
  x.lineWidth = 0.6;
  for (let n = 0; n < 26; n++) {
    const fx = (Math.random() - 0.5) * w, fy = (Math.random() - 0.5) * h, a = Math.random() * Math.PI;
    x.beginPath(); x.moveTo(fx, fy); x.quadraticCurveTo(fx + Math.cos(a) * 6, fy + Math.sin(a) * 6 + 2, fx + Math.cos(a) * 11, fy + Math.sin(a) * 11); x.stroke();
  }
  // Red stitches round the edge, each a touch different.
  x.strokeStyle = '#B3261E';
  x.lineCap = 'round';
  for (let i = 0; i < 46; i++) {
    const a0 = (i / 46) * Math.PI * 2;
    x.lineWidth = 1.6 + Math.random() * 0.5;
    x.globalAlpha = 0.8 + Math.random() * 0.2;
    x.beginPath(); x.ellipse(0, 0, w / 2 - 9, h / 2 - 8, 0, a0, a0 + 0.085); x.stroke();
  }
  x.globalAlpha = 1;
  // The writing, a touch see-through so the grain shows (plain drawing: iPhone Safari can drop text drawn with blend modes).
  x.globalAlpha = 0.92;
  text(x, month, 0, h * 0.1, { font: `${h * 0.48}px ${HAND}`, color: '#2a2420' });
  text(x, String(year), 0, h * 0.34, { font: `600 ${h * 0.13}px ${MONO}`, color: '#B3261E', spacing: 3 });
  x.globalAlpha = 1;
  // It wraps round the jar: darker toward both sides, a soft highlight just left of centre.
  const round = x.createLinearGradient(-w / 2, 0, w / 2, 0);
  round.addColorStop(0, 'rgba(60, 40, 20, .28)'); round.addColorStop(0.18, 'rgba(60, 40, 20, 0)');
  round.addColorStop(0.38, 'rgba(255, 255, 255, .22)'); round.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
  round.addColorStop(0.82, 'rgba(60, 40, 20, 0)'); round.addColorStop(1, 'rgba(60, 40, 20, .32)');
  x.fillStyle = round;
  x.fillRect(-w / 2 - 4, -h / 2 - 4, w + 8, h + 8);
  // The glass in front catches the light in a slanted streak.
  x.rotate(-0.35);
  const glare = x.createLinearGradient(-w * 0.28, 0, -w * 0.12, 0);
  glare.addColorStop(0, 'rgba(255, 255, 255, 0)'); glare.addColorStop(0.5, 'rgba(255, 255, 255, .38)'); glare.addColorStop(1, 'rgba(255, 255, 255, 0)');
  x.fillStyle = glare;
  x.fillRect(-w * 0.28, -h, w * 0.16, h * 2);
  x.restore();
  ctx.drawImage(c, cx - c.width / 2, bh * 0.47 - c.height / 2);
}

/** The red KEPT postmark: two rings, the month round the edge, the day in the middle. A thin cream glow keeps it legible on dark photos. */
function postmark(ctx, cx, cy, size, { ring, word, center }) {
  const k = size / 104;
  const ink = () => {
    ctx.strokeStyle = ctx.fillStyle = '#C8352A';
    ctx.lineWidth = 3 * k;
    ctx.beginPath(); ctx.arc(0, 0, 47 * k, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 1.6 * k;
    ctx.beginPath(); ctx.arc(0, 0, 29 * k, 0, Math.PI * 2); ctx.stroke();
    ringText(ctx, ring, 0, 0, 37.5 * k, `600 ${8.6 * k}px ${MONO}`);
    text(ctx, word, 0, -1 * k, { font: `600 ${9 * k}px ${MONO}`, color: '#C8352A', spacing: 2 * k });
    text(ctx, center, 0, 15 * k, { font: `500 ${19 * k}px ${SERIF}`, color: '#C8352A' });
  };
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((-12 * Math.PI) / 180);
  ctx.globalAlpha = 0.95;
  ctx.shadowColor = 'rgba(253, 252, 248, .95)';
  ctx.shadowBlur = 5;
  ink();
  ctx.restore();
}

/** The handwritten note's slip, measured: up to three lines, the writing shrinking rather than cut off. */
function measureNote(ctx, sky) {
  if (!sky.note) return null;
  // On a torn slip: handwriting for English, the regular face for Thai.
  const thai = isThai(sky.note);
  const padX = 64;
  let size = thai ? 56 : 92, font, lines;
  // Up to three lines; a longer note gets smaller writing instead of being cut off.
  for (;;) {
    font = thai ? `${size}px ${SANS}` : `${size}px ${HAND}`;
    ctx.font = font;
    lines = wrap(ctx, sky.note, W - MARGIN * 2 - padX * 2, 3);
    if (lines.join(' ').length >= sky.note.trim().length - 1 || size <= (thai ? 38 : 60)) break;
    size -= 4;
  }
  const lh = size * (thai ? 76 / 56 : 82 / 92);
  const w = Math.min(W - MARGIN * 2, Math.max(...lines.map((ln) => ctx.measureText(ln).width)) + padX * 2);
  return { font, lh, lines, w, h: 40 + lines.length * lh + SLIPS.torn2.dst[2] * 2 };
}

/** Under the hero, top down from y: the note's slip, then the day's hashtags for a challenge sky. */
function drawUnder(ctx, y, { sky, challenge, note, paperImg }) {
  if (note) {
    // The note's slip is the sky's own paper colour, torn top and bottom and tilted against the print, as in the app.
    const { font, lh, lines, w, h } = note;
    slip(ctx, paperImg, 'torn2', W / 2, y, w, h, 2, () => {
      lines.forEach((ln, i) => text(ctx, ln, w / 2, 30 + SLIPS.torn2.dst[2] * 0.6 + lh * 0.78 + i * lh, { font }));
    }, ROLLS[paperIndex(sky.id)]);
    y += h + 30;
  }
  if (challenge) text(ctx, `#${challenge.tag} #kepfa`, W / 2, y + 40, { font: `32px ${MONO}`, color: '#4A443D' });
}

/**
 * @param challenge  {tag, …} when the sky was kept for that day's prompt: its hashtags go under the note
 * @param month      every sky kept that month, for the pile in the jar
 */
async function storySingle(sky, showPlace, quote, challenge, month = [sky]) {
  const [c, ctx] = page();
  const d = new Date(sky.takenAt);
  const top = masthead(ctx, quote, t.issueLine(d.getDate(), MONTHS[d.getMonth()], d.getFullYear()));
  const [paperImg, tapeImg] = await Promise.all(['paper', 'tape'].map(texture));

  // The print is the hero, centred and tilted left. The note is measured first so the whole group can sit centred.
  let pw = 734;
  const note = measureNote(ctx, sky);
  // A long note makes the print smaller, so everything stays above the footer.
  const rest = 90 + (note ? note.h + 30 : 0) + (challenge ? 60 : 0);
  pw = Math.min(pw, (H - 112 - top - 60 - rest) / (1.096 + 0.37 * JAR_RATIO * 0.38));
  // Whatever comes under the print starts below the jar that leans on its corner.
  const below = pw * 0.37 * JAR_RATIO * 0.38 + 90;
  const total = pw * 1.096 + below + (note ? note.h + 30 : 0) + (challenge ? 60 : 0);
  const py = top + Math.max(60, (H - 112 - top - total) / 2);
  const [{ img, release }] = await Promise.all([loadImage(sky.photo), loadThumbs(month)]);
  const ph = polaroid(ctx, img, W / 2, py, pw, -3, fmt.time(d));
  tapeStrip(ctx, tapeImg, W / 2, py + 4, 216, -4);

  // The jar leans the other way against the print's bottom-right corner (the place tag hangs from its neck).
  const placed = showPlace && sky.place;
  const bw = pw * 0.37, bh = bw * JAR_RATIO, jy = py + ph - bh * 0.62;
  // With a tag hanging on its right, the jar slides in just enough to keep the widest tag inside the margin.
  const reach = jarPoint(925, 540, bw)[0] + 165 * Math.max(bw / 540, 0.62);
  const jx = Math.min(W / 2 + pw * 0.5 - bw * 0.62, placed ? W - MARGIN - reach : Infinity);
  ctx.save();
  ctx.translate(jx + bw / 2, jy + bh / 2);
  ctx.rotate((7 * Math.PI) / 180);
  ctx.translate(-bw / 2, -bh / 2);
  // A soft shadow where it stands.
  const g = ctx.createRadialGradient(bw / 2, bh, 0, bw / 2, bh, bw * 0.5);
  g.addColorStop(0, 'rgba(30, 28, 25, .28)');
  g.addColorStop(1, 'rgba(30, 28, 25, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, bh - bw * 0.2, bw, bw * 0.4);
  if (placed) tagThreadBack(ctx, 0, 0, bw);
  // Not the same photo again: the month's folded skies, with this one as a small print on top, and the month's label.
  drawJar(ctx, { x: 0, y: 0, w: bw, image: jarContents(month, img) });
  jamLabel(ctx, bw, bh, MONTHS[d.getMonth()], d.getFullYear(), placed);
  if (placed) tag(ctx, 0, 0, bw, sky.place);
  ctx.restore();
  release();

  // A note in the margin, scrapbook style: handwriting and a hand-drawn arrow into the jar.
  const jarLeft = jx + bw * 0.04;
  // Room on its right for the arrow, but never past the page margin on its left.
  ctx.font = `108px ${HAND}`;
  const wide = Math.max(...t.keptInJar.map((ln) => ctx.measureText(ln).width));
  const tx = Math.max(jarLeft - 140, MARGIN + wide), ty = py + ph + 165;
  ctx.save();
  ctx.translate(tx, ty);
  ctx.rotate((-5 * Math.PI) / 180);
  t.keptInJar.forEach((ln, i, all) => text(ctx, ln, 0, (i - all.length + 1) * 84, { font: `108px ${HAND}`, color: '#2a2420', align: 'right' }));
  ctx.restore();
  ctx.strokeStyle = '#2a2420';
  ctx.lineWidth = 4;
  ctx.lineCap = ctx.lineJoin = 'round';
  // A short hook from the end of the writing that arrives level, pointing in at the jar's lower half.
  const sx = tx + 18, sy = ty - 40, ex = jx - 26, ey = jy + bh * 0.7, c2x = ex - 44, c2y = ey + 4;
  ctx.beginPath(); ctx.moveTo(sx, sy); ctx.bezierCurveTo(sx + 30, sy - 6, c2x, c2y, ex, ey); ctx.stroke();
  const ang = Math.atan2(ey - c2y, ex - c2x);
  for (const turn of [-0.45, 0.45]) {
    ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex - Math.cos(ang + turn) * 28, ey - Math.sin(ang + turn) * 28); ctx.stroke();
  }

  // KEPT, stamped across the print's left edge.
  postmark(ctx, W / 2 - pw / 2 - pw * 0.04, py + ph * 0.5, pw * 0.55,
    { ring: t.keptRing(MONTHS[d.getMonth()], d.getFullYear()), word: t.keptWord, center: String(d.getDate()) });

  drawUnder(ctx, py + ph + below, { sky, challenge, note, paperImg });
  footer(ctx);
  return toBlob(c);
}

/** One sky, the other way: the jar is the hero, standing tall in the middle of the page with the sky filling it,
   KEPT inked across its lower corner and the day typed underneath, then the same note as the polaroid. */
async function storySingleJar(sky, showPlace, quote, challenge) {
  const [c, ctx] = page();
  const d = new Date(sky.takenAt);
  const top = masthead(ctx, quote, t.issueLine(d.getDate(), MONTHS[d.getMonth()], d.getFullYear()));
  const paperImg = await texture('paper');
  const note = measureNote(ctx, sky);
  // As big as the page allows once the day and the note have their room.
  const day = 96;
  const rest = day + (note ? note.h + 30 : 0) + (challenge ? 60 : 0);
  const bw = Math.min(600, (H - 112 - top - 120 - rest) / JAR_RATIO), bh = bw * JAR_RATIO;
  const jx = (W - bw) / 2;
  const jy = top + Math.max(60, (H - 112 - top - bh - rest) / 2);
  const { img, release } = await loadImage(sky.photo);
  standShadow(ctx, W / 2, jy + bh - bw * 0.02, bw * 1.05);
  // The place tag hangs from its neck, as on the polaroid's jar.
  const placed = showPlace && sky.place;
  ctx.save();
  ctx.translate(jx, jy);
  if (placed) tagThreadBack(ctx, 0, 0, bw);
  drawJar(ctx, { x: 0, y: 0, w: bw, image: img });
  if (placed) tag(ctx, 0, 0, bw, sky.place);
  ctx.restore();
  release();
  // KEPT stamped over the jar's left side, half on the paper so the red reads, as on the polaroid's edge.
  postmark(ctx, jx - bw * 0.04, jy + bh * 0.7, bw * 0.48,
    { ring: t.keptRing(MONTHS[d.getMonth()], d.getFullYear()), word: t.keptWord, center: String(d.getDate()) });
  text(ctx, `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()} · ${fmt.time(d)}`.toUpperCase(), W / 2, jy + bh + 66, { font: `500 28px ${MONO}`, color: SOFT, spacing: 6 });
  drawUnder(ctx, jy + bh + day, { sky, challenge, note, paperImg });
  footer(ctx);
  return toBlob(c);
}

/** @param theme  the month's theme; it takes the quote's place, so the month's shelf reads as one story */
async function storyJar({ year, month, skies, quote, theme }) {
  const [c, ctx] = page();
  const top = masthead(ctx, theme || quote, t.issueLine(month + 1, MONTHS[month], year), { title: MONTHS[month], kicker: t.storyKept(year, skies.length) });

  // The month's shelf: every sky in its own jar, newest first, the day under each.
  // Try each column count and keep the one that gives the biggest jars in the space left.
  const list = skies.slice().reverse();
  const n = Math.max(list.length, 1);
  const gridTop = top + 40, gridBottom = H - 160, gap = 24, label = 96;
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
    shelf(ctx, Math.min(MARGIN, x - 24), y + jh - 3, Math.max(W - MARGIN * 2, rowW + 48));
    for (const s of row) {
      // Thumbnails, one at a time, so a full month doesn't hold 31 photos in memory at once.
      const { img, release } = await loadImage(s.thumb);
      standShadow(ctx, x + jw / 2, y + jh, jw * 0.9);
      drawJar(ctx, { x, y, w: jw, image: img });
      release();
      text(ctx, String(new Date(s.takenAt).getDate()).padStart(2, '0'), x + jw / 2, y + jh + 74, { font: `26px ${MONO}`, color: SOFT });
      x += jw + gap;
    }
    y += jh + label;
  }
  footer(ctx);
  return toBlob(c);
}

async function storyYear({ year, skies, quote }) {
  const [c, ctx] = page();
  const top = masthead(ctx, quote, t.volume(year), { title: String(year), kicker: `${skies.length} ${t.kept(skies.length)}` });

  // Three shelves of four; each jar has a tent card in front saying which month it is and how many skies.
  const bw = 150, bh = Math.round(150 * JAR_RATIO), gapX = 76, rowH = bh + 90, firstRow = top + 50;
  const left = (W - (4 * bw + 3 * gapX)) / 2;
  await loadThumbs(skies);
  for (let m = 0; m < 12; m++) {
    const r = Math.floor(m / 4), col = m % 4;
    const x = left + col * (bw + gapX);
    const y = firstRow + r * rowH;
    if (col === 0) shelf(ctx, MARGIN, y + bh - 3, W - MARGIN * 2);
    const inMonth = skies.filter((s) => new Date(s.takenAt).getMonth() === m);
    // Months with nothing in them stay faint, so the jars that were filled stand out.
    standShadow(ctx, x + bw / 2, y + bh, bw * 0.9);
    drawJar(ctx, { x, y, w: bw, skies: inMonth, ghost: !inMonth.length });
    tentCard(ctx, x + bw / 2, y + bh + 13, bw * 0.66, MONTHS_SHORT[m], inMonth.length ? String(inMonth.length) : '–');
  }

  // The year as a strip of colors, one sliver per sky.
  const sx = MARGIN, sy = firstRow + 3 * rowH - 10, sw = W - MARGIN * 2, sh = 80;
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

// Stickers for the finished challenge, in the colours of the star paper; the last one is holographic.
const STAR_INKS = ['#FF5A36', '#FFC12E', '#22C3F0', '#B5E42A', 'holo'];

/** A soft five-point star sticker centred on x,y. */
function star(ctx, x, y, r, turn, ink) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(turn);
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5 - Math.PI / 2, rr = i % 2 ? r * 0.48 : r;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  if (ink === 'holo') {
    const g = ctx.createLinearGradient(-r, -r, r, r);
    g.addColorStop(0, '#F7A8C8');
    g.addColorStop(0.5, '#9FD8F5');
    g.addColorStop(1, '#F6E58D');
    ctx.fillStyle = g;
  } else ctx.fillStyle = ink;
  ctx.shadowColor = 'rgba(30, 28, 25, .18)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 3;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = ctx.fillStyle;
  ctx.lineWidth = r * 0.22;
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/**
 * Star stickers scattered evenly over a w×h area, fresh every time: one chance per cell of a loose grid,
 * jittered inside it. `unit` scales the stars (1 at story size); none lands on an `avoid` box {x, y, w, h}.
 */
export function scatterStars(ctx, w, h, { unit = 1, avoid = [], scale = 1 } = {}) {
  const cell = 154 * unit, across = Math.max(1, Math.round(w / cell)), down = Math.max(1, Math.round(h / cell));
  const cw = w / across, ch = h / down;
  for (let r = 0; r < down; r++) {
    for (let col = 0; col < across; col++) {
      if (Math.random() > 0.72) continue;
      const x = (col + 0.15 + Math.random() * 0.7) * cw, y = (r + 0.15 + Math.random() * 0.7) * ch;
      const size = (16 + Math.random() * 16) * unit * scale;   // scale shrinks the stickers, not their spacing
      if (avoid.some((b) => x > b.x - size && x < b.x + b.w + size && y > b.y - size && y < b.y + b.h + size)) continue;
      star(ctx, x, y, size, Math.random() * Math.PI, STAR_INKS[Math.floor(Math.random() * STAR_INKS.length)]);
    }
  }
}

/** Text with a halo of paper behind it, so it reads over the stars. */
function haloText(ctx, str, x, y, opts) {
  ctx.save();
  ctx.shadowColor = PAPER;
  ctx.shadowBlur = 26;
  for (let i = 0; i < 3; i++) text(ctx, str, x, y, opts);
  ctx.restore();
}

/** A finished round: every day's sky on one stamped sheet, on grid paper scattered with star stickers. */
async function storyDone({ round, skies }) {
  const [c, ctx] = page();
  const kicker = `Kepfa · ${t.doneKicker(round)}`.toUpperCase();
  ctx.font = `500 25px ${SANS}`;
  const kw = ctx.measureText(kicker).width + kicker.length * 5 + 44;
  // The writing is measured first so no star lands on it.
  const box = (str, font, cy, up, down) => { ctx.font = font; const w = ctx.measureText(str).width + 30; return { x: (W - w) / 2, y: cy - up, w, h: up + down }; };
  const avoid = [
    { x: W / 2 - kw / 2, y: 110, w: kw, h: 56 },
    ...t.doneTitle.map((ln, i) => box(ln, `italic 500 150px ${SERIF}`, 330 + i * 150, 110, 40)),
    box(t.doneLine, `italic 54px ${SERIF}`, 590, 44, 16),
  ];
  // The sheet: six across, five down, each day numbered; the hashtag sits under it.
  const sw = 900, pad = 36, gap = 14, cols = 6;
  const cell = (sw - pad * 2 - gap * (cols - 1)) / cols;
  const rows = Math.ceil(skies.length / cols);
  const sh = pad + rows * cell + (rows - 1) * gap + 96;
  const top = 680, tagY = top + sh + 150;
  scatterStars(ctx, W, H - 140, { avoid: [...avoid, box(`#${CHALLENGE_TAG}`, `34px ${MONO}`, tagY, 34, 14)] });
  ctx.fillStyle = 'rgba(253, 252, 248, .9)';
  ctx.beginPath(); ctx.roundRect(W / 2 - kw / 2, 110, kw, 56, 8); ctx.fill();
  smallCaps(ctx, kicker, W / 2, 147, 'center');
  t.doneTitle.forEach((ln, i) => haloText(ctx, ln, W / 2, 330 + i * 150, { font: `italic 500 150px ${SERIF}` }));
  haloText(ctx, t.doneLine, W / 2, 590, { font: `italic 54px ${SERIF}`, color: '#3A352F' });

  ctx.save();
  ctx.translate(W / 2, top + sh / 2);
  ctx.rotate((-1.5 * Math.PI) / 180);
  ctx.translate(-sw / 2, -sh / 2);
  ctx.shadowColor = 'rgba(30, 28, 25, .32)';
  ctx.shadowBlur = 50;
  ctx.shadowOffsetY = 24;
  ctx.fillStyle = '#FDFCF8';
  ctx.beginPath(); ctx.roundRect(0, 0, sw, sh, 8); ctx.fill();
  ctx.shadowColor = 'transparent';
  for (let i = 0; i < skies.length; i++) {
    const x = pad + (i % cols) * (cell + gap), y = pad + Math.floor(i / cols) * (cell + gap);
    // One thumbnail at a time, cropped square from its middle.
    const { img, release } = await loadImage(skies[i].thumb);
    const s = Math.min(img.naturalWidth, img.naturalHeight);
    ctx.save();
    ctx.beginPath(); ctx.roundRect(x, y, cell, cell, 4); ctx.clip();
    ctx.drawImage(img, (img.naturalWidth - s) / 2, (img.naturalHeight - s) / 2, s, s, x, y, cell, cell);
    ctx.restore();
    release();
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, .6)';
    ctx.shadowBlur = 6;
    text(ctx, String(i + 1), x + 8, y + cell - 10, { font: `22px ${MONO}`, color: '#fff', align: 'left' });
    ctx.restore();
  }
  text(ctx, t.doneRange(fmt.dayLong(skies[0].prompt), fmt.dayLong(skies[skies.length - 1].prompt)).toUpperCase(),
    sw / 2, sh - 38, { font: `28px ${MONO}`, color: SOFT, spacing: 3 });
  ctx.restore();
  const tapeImg = await texture('tape');
  tapeStrip(ctx, tapeImg, W / 2, top + 4, 230, 3);
  postmark(ctx, W / 2 + sw / 2 - 30, top + sh - 20, 300,
    { ring: t.doneStamp, word: t.doneWord, center: `${skies.length}/${CHALLENGE_SIZE}` });

  haloText(ctx, `#${CHALLENGE_TAG}`, W / 2, tagY, { font: `34px ${MONO}`, color: '#4A443D' });
  footer(ctx);
  return toBlob(c);
}

// ---------- a stamp's letter: what the sky wrote, and the postcard that came with it ----------

const PEN = '#2E3F63';   // the app's --pen
const STAMP_RED = '#C8352A';   // the app's --stamp

/** Letters along an arc, centred on `mid` (radians). On the top they run clockwise; underneath they stay upright. */
function arcText(ctx, str, cx, cy, r, mid, spacing, under) {
  const widths = [...str].map((ch) => ctx.measureText(ch).width + spacing);
  const span = (widths.reduce((a, b) => a + b, 0) - spacing) / r;
  let a = under ? mid + span / 2 : mid - span / 2;
  [...str].forEach((ch, i) => {
    const step = (widths[i] - spacing) / 2 / r;
    a += under ? -step : step;
    ctx.save();
    ctx.translate(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    ctx.rotate(under ? a - Math.PI / 2 : a + Math.PI / 2);
    ctx.fillText(ch, 0, 0);
    ctx.restore();
    a += (under ? -1 : 1) * (step + spacing / r);
  });
}

/** The postmark from the letter page (its 140×70 drawing), with its top-left at x,y and `w` wide. */
function letterPostmark(ctx, x, y, w, at, n) {
  const k = w / 140, d = new Date(at);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  ctx.globalAlpha = 0.7;
  ctx.globalCompositeOperation = 'multiply';
  ctx.strokeStyle = ctx.fillStyle = STAMP_RED;
  ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.arc(44, 35, 26, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(44, 35, 19, 0, Math.PI * 2); ctx.stroke();
  ctx.font = `5.2px ${MONO}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  arcText(ctx, 'KEPFA', 44, 35, 20.6, -Math.PI / 2, 1.2, false);
  arcText(ctx, `${d.getDate()} ${MONTHS_SHORT[d.getMonth()].toUpperCase()} ${d.getFullYear()}`, 44, 35, 24.2, Math.PI / 2, 1.2, true);
  [21.5, 66.5].forEach((cx) => { ctx.beginPath(); ctx.arc(cx, 35, 0.9, 0, Math.PI * 2); ctx.fill(); });
  ctx.font = `600 16px ${SERIF}`;
  ctx.fillText(`${n}/${n}`, 44.1, 38.6);
  ctx.lineWidth = 2.2;
  for (let i = 0; i < 4; i++) {
    const wy = 20 + i * 10;
    ctx.beginPath();
    ctx.moveTo(74, wy);
    for (let s = 0; s < 4; s++) ctx.quadraticCurveTo(82 + s * 16, wy + (s % 2 ? 5 : -5), 90 + s * 16, wy);
    ctx.stroke();
  }
  ctx.restore();
}

/** A perforated stamp printed from the sky (the album's 100×124 drawing), top-left at x,y and `w` wide. */
function stampPrint(ctx, img, x, y, w, name, n) {
  const k = w / 100, sw = 100, sh = 124;
  const c = document.createElement('canvas');
  c.width = Math.round(w); c.height = Math.round(sh * k);
  const g = c.getContext('2d');
  g.scale(k, k);
  g.fillStyle = '#FBF7EE';
  g.fillRect(0, 0, sw, sh);
  if (img) {
    const iw = img.naturalWidth, ih = img.naturalHeight, bw = sw - 16, bh = sh - 40;
    const s = Math.min(iw / bw, ih / bh);
    g.drawImage(img, (iw - bw * s) / 2, (ih - bh * s) / 2, bw * s, bh * s, 8, 8, bw, bh);
  }
  g.fillStyle = '#FBF7EE';
  g.font = `500 11px ${SERIF}`;
  g.textAlign = 'left';
  g.fillText(String(n), 13, 21);
  g.fillStyle = '#2a2420';
  g.font = `italic 12px ${SERIF}`;
  g.textAlign = 'center';
  g.fillText(name, sw / 2, sh - 18);
  g.fillStyle = '#8A8277';
  g.font = `5.2px ${MONO}`;
  if ('letterSpacing' in g) g.letterSpacing = '1.6px';
  g.fillText('KEPFA', sw / 2, sh - 8);
  // The perforations: half-holes punched along every edge.
  g.globalCompositeOperation = 'destination-out';
  g.beginPath();
  for (let px = 4.8; px <= sw; px += 9.6) { g.moveTo(px + 3.2, 0); g.arc(px, 0, 3.2, 0, Math.PI * 2); g.moveTo(px + 3.2, sh); g.arc(px, sh, 3.2, 0, Math.PI * 2); }
  for (let py = 5.4; py <= sh; py += 9.6) { g.moveTo(3.2, py); g.arc(0, py, 3.2, 0, Math.PI * 2); g.moveTo(sw + 3.2, py); g.arc(sw, py, 3.2, 0, Math.PI * 2); }
  g.fill();
  ctx.save();
  ctx.shadowColor = 'rgba(30, 28, 25, .25)';
  ctx.shadowBlur = 10 * k;
  ctx.shadowOffsetY = 4 * k;
  ctx.drawImage(c, x, y);
  ctx.restore();
}

/** Lines of the postcard's words, in handwriting (Thai in the regular face), centred in a box. */
function postcardWords(ctx, str, cx, top, w, h, size) {
  const thai = isThai(str);
  const font = thai ? `${size * 0.62}px ${SANS}` : `${size}px ${HAND}`;
  const lh = thai ? size * 0.93 : size * 1.12;
  ctx.font = font;
  const lines = wrap(ctx, str, w, 6);
  const y0 = top + (h - lines.length * lh) / 2 + lh * 0.78;
  lines.forEach((ln, i) => text(ctx, ln, cx, y0 + i * lh, { font, color: PEN }));
}

/** The postcard from the letter page (its 300×196 card), centred on cx with its top at y. */
async function postcard(ctx, cx, y, pw, { card, to, sky, name, need, at }) {
  const k = pw / 300, ph = 196 * k, b = 5 * k;
  ctx.save();
  ctx.translate(cx, y + ph / 2);
  ctx.rotate((-1.5 * Math.PI) / 180);
  ctx.translate(-pw / 2, -ph / 2);
  ctx.shadowColor = 'rgba(30, 28, 25, .4)';
  ctx.shadowBlur = 26 * k;
  ctx.shadowOffsetY = 14 * k;
  ctx.fillStyle = '#FBF8F1';
  ctx.fillRect(0, 0, pw, ph);
  ctx.shadowColor = 'transparent';
  // Airmail edge: stripes of red and blue at 45°, only in the border.
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, pw, ph);
  ctx.rect(b, b, pw - b * 2, ph - b * 2);
  ctx.clip('evenodd');
  const period = 28 * k;
  for (let o = -ph; o < pw + ph; o += period) {
    [[0, 'rgba(200, 53, 42, .8)'], [14 * k, 'rgba(46, 63, 99, .8)']].forEach(([d, color]) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(o + d, 0); ctx.lineTo(o + d + 9 * k, 0); ctx.lineTo(o + d + 9 * k - ph, ph); ctx.lineTo(o + d - ph, ph);
      ctx.fill();
    });
  }
  ctx.restore();
  // Inside the border, measured as on the page: message on the left, a rule, the address side on the right.
  const ix = b, iy = b, iw = 290 * k, ih = 186 * k, split = ix + iw * 0.54;
  ctx.fillStyle = 'rgba(58, 51, 44, .18)';
  ctx.fillRect(split, iy + 22 * k, Math.max(1, k), ih - 44 * k);
  postcardWords(ctx, card, (ix + 20 * k + split - 18 * k) / 2, iy + 18 * k, split - ix - 38 * k, ih - 36 * k, 21 * k);
  const toFont = isThai(to) ? `${13 * k}px ${SANS}` : `${18 * k}px ${HAND}`;
  text(ctx, `${t.letterTo} `, split + 14 * k, iy + ih - 46 * k - 4 * k, { font: `${18 * k}px ${HAND}`, color: PEN, align: 'left' });
  ctx.font = `${18 * k}px ${HAND}`;
  const toX = split + 14 * k + ctx.measureText(`${t.letterTo} `).width;
  text(ctx, to, toX, iy + ih - 46 * k - 4 * k, { font: toFont, color: PEN, align: 'left' });
  let img = null, release = () => {};
  if (sky) ({ img, release } = await loadImage(sky.thumb));
  const sw = 62 * k, sx = ix + iw - 14 * k - sw, sy = iy + 14 * k;
  ctx.save();
  ctx.translate(sx + sw / 2, sy + (sw * 1.24) / 2);
  ctx.rotate((2 * Math.PI) / 180);
  stampPrint(ctx, img, -sw / 2, -(sw * 1.24) / 2, sw, name, need);
  ctx.restore();
  release();
  letterPostmark(ctx, ix + iw - 22 * k - 116 * k, iy + 18 * k, 116 * k, at, need);
  ctx.restore();
  return ph;
}

/** The letter page as a story: letterhead, the sky's note and sign-off, the postcard, the P.S. and the stamp's name. */
async function storyStamp(p) {
  const [c, ctx] = page();
  const k = (W - MARGIN * 2) / 340;   // the letter page's 340px column, at story size
  const d = new Date(p.at);
  // Measured first: the whole letter sits in the middle of the page, with the postcard full width as its centrepiece.
  const bodyFont = `${17.5 * k}px ${SERIF}`, lh = 17.5 * 1.4 * k;
  ctx.font = bodyFont;
  const lines = wrap(ctx, p.letter, W - MARGIN * 2, 5);
  const pw = W - MARGIN * 2, ph = (pw / 300) * 196;
  const hiY = 8 * k + 16 * k + 28 * k, bodyY = hiY + 8 * k + 17.5 * k * 1.1;
  const signY = bodyY + (lines.length - 1) * lh + 28 * k;
  const cardY = signY + 34 * k, psY = cardY + ph + 46 * k, nameY = psY + 38 * k;
  const y0 = Math.max(170, (H - 150 - nameY) / 2);
  scatterStars(ctx, W, H - 140, { scale: 0.6, avoid: [
    { x: MARGIN - 20, y: y0 - 70, w: W - MARGIN * 2 + 40, h: signY + 90 },
    { x: MARGIN - 30, y: y0 + cardY - 30, w: pw + 60, h: ph + 60 },
    { x: MARGIN + 80, y: y0 + psY - 40, w: W - MARGIN * 2 - 160, h: nameY - psY + 70 },
  ] });
  // Letterhead
  text(ctx, 'Kepfa', MARGIN, y0, { font: `500 ${24 * k}px ${SERIF}`, align: 'left' });
  text(ctx, `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`.toUpperCase(), W - MARGIN, y0 - 4, { font: `${10 * k}px ${MONO}`, color: SOFT, align: 'right', spacing: 1.2 * k });
  ctx.fillStyle = INK;
  ctx.fillRect(MARGIN, y0 + 6 * k + 4, W - MARGIN * 2, 2 * k);
  text(ctx, t.letterHi, MARGIN, y0 + hiY, { font: `italic 500 ${28 * k}px ${SERIF}`, align: 'left' });
  lines.forEach((ln, i) => text(ctx, ln, MARGIN, y0 + bodyY + i * lh, { font: bodyFont, align: 'left' }));
  ctx.save();
  ctx.translate(W - MARGIN, y0 + signY);
  ctx.rotate((-3 * Math.PI) / 180);
  text(ctx, t.letterSign, 0, 0, { font: `${26 * k}px ${HAND}`, color: PEN, align: 'right' });
  ctx.restore();
  await postcard(ctx, W / 2, y0 + cardY, pw, p);
  smallCaps(ctx, t.letterPS, W / 2, y0 + psY, 'center');
  text(ctx, p.name, W / 2, y0 + nameY, { font: `italic 500 ${32 * k}px ${SERIF}` });
  footer(ctx);
  return toBlob(c);
}

export async function makeStory(kind, payload) {
  await fontsReady();
  if (kind === 'single') {
    return payload.style === 'jar'
      ? storySingleJar(payload.sky, payload.showPlace, payload.quote, payload.challenge)
      : storySingle(payload.sky, payload.showPlace, payload.quote, payload.challenge, payload.monthSkies);
  }
  if (kind === 'jar') return storyJar(payload);
  if (kind === 'done') return storyDone(payload);
  if (kind === 'stamp') return storyStamp(payload);
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
