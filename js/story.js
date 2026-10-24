// 1080×1920 images sized for an Instagram story, printed on paper under a Kepfa quote:
// one jarred sky with its handwritten note, one month's jar, or the whole year's shelf.

import { drawJar, jarShape, JAR_RATIO } from './jar.js';
import { dominant, loadImage } from './sky.js';
import { t, fmt, MONTHS, MONTHS_SHORT } from './strings.js';

const isThai = (s) => /[฀-๿]/.test(s);

const W = 1080, H = 1920;
const PAPER = '#F1EDE6';
const TAG = '#FBF9F5';
const INK = '#1E1C19';
const SOFT = '#6B645B';
const RULE = '#CFC7BB';
const GLASS = 'rgba(255,255,255,.45)';

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

function rule(ctx, y, half = 140) {
  ctx.fillStyle = RULE;
  ctx.fillRect(W / 2 - half, y, half * 2, 2);
}

function wrap(ctx, str, maxW, maxLines) {
  // Wrap by words, falling back to characters for scripts without spaces (Thai).
  const tokens = str.includes(' ') ? str.split(/(\s+)/) : Array.from(str);
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

/** Paper tag tied around the jar's neck. */
function tag(ctx, nx, ny, label) {
  ctx.save();
  let size = 34;
  ctx.font = `500 ${size}px ${SANS}`;
  const str = label.toUpperCase();
  while (size > 22 && ctx.measureText(str).width + str.length * 2 > 220) { size -= 2; ctx.font = `500 ${size}px ${SANS}`; }
  const tw = Math.max(180, ctx.measureText(str).width + str.length * 2 + 90);
  const tx = Math.min(nx + 50, W - tw - 50), ty = ny + 40;
  ctx.strokeStyle = SOFT;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(nx, ny);
  ctx.quadraticCurveTo(nx + 30, ny + 30, tx + 22, ty + 46);
  ctx.stroke();
  ctx.translate(tx, ty);
  ctx.rotate(0.14);
  ctx.fillStyle = TAG;
  ctx.strokeStyle = RULE;
  ctx.beginPath();
  ctx.roundRect(0, 0, tw, 92, 10);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = SOFT;
  ctx.beginPath(); ctx.arc(24, 46, 8, 0, Math.PI * 2); ctx.stroke();
  text(ctx, str, 48 + (tw - 48) / 2, 58, { font: `500 ${size}px ${SANS}`, spacing: 2 });
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

async function storySingle(sky, showPlace, quote) {
  const [c, ctx] = page();
  const top = masthead(ctx, quote);

  const bw = 620, bh = Math.round(620 * JAR_RATIO), bx = (W - bw) / 2, by = top + 50;
  const { img, release } = await loadImage(sky.photo);
  drawJar(ctx, { x: bx, y: by, w: bw, h: bh, image: img, ink: INK, paper: PAPER, glass: GLASS });
  release();
  const g = jarShape(bw, bh);
  if (showPlace && sky.place) tag(ctx, bx + bw - g.mx, by + g.threads[1], sky.place);

  let y = by + bh + 110;
  if (sky.note) {
    // Handwriting for English; Thai keeps the regular face at a regular size.
    const font = isThai(sky.note) ? `46px ${SANS}` : `68px ${HAND}`;
    ctx.font = font;
    const lines = wrap(ctx, sky.note, W - 260, 2);
    lines.forEach((ln, i) => text(ctx, ln, W / 2, y + i * 76, { font }));
    y += lines.length * 76 - 26;
  }
  rule(ctx, y);
  text(ctx, fmt.stamp(sky.takenAt), W / 2, y + 70, { font: `40px ${MONO}`, color: SOFT });
  swatches(ctx, sky.palette, y + 150);
  footer(ctx);
  return toBlob(c);
}

async function storyJar({ year, month, skies, quote }) {
  const [c, ctx] = page();
  const top = masthead(ctx, quote);
  text(ctx, MONTHS[month], W / 2, top + 130, { font: `500 128px ${SERIF}` });
  text(ctx, t.storyKept(year, skies.length), W / 2, top + 195, { font: `36px ${SANS}`, color: SOFT });

  const bw = 540, bh = Math.round(540 * JAR_RATIO), bx = (W - bw) / 2, by = top + 250;
  drawJar(ctx, { x: bx, y: by, w: bw, h: bh, skies, capacity: new Date(year, month + 1, 0).getDate(), ink: INK, paper: PAPER, glass: GLASS });

  // One square per sky: the month as a row of colors.
  const size = 34, gap = 10, perRow = 16;
  const rows = Math.ceil(skies.length / perRow);
  skies.forEach((s, i) => {
    const r = Math.floor(i / perRow), col = i % perRow;
    const inRow = Math.min(perRow, skies.length - r * perRow);
    const x = (W - (inRow * size + (inRow - 1) * gap)) / 2 + col * (size + gap);
    ctx.fillStyle = dominant(s.palette).hex;
    ctx.fillRect(x, by + bh + 90 + r * (size + gap) + (rows === 1 ? 20 : 0), size, size);
  });
  footer(ctx);
  return toBlob(c);
}

async function storyYear({ year, skies, quote }) {
  const [c, ctx] = page();
  const top = masthead(ctx, quote);
  text(ctx, String(year), W / 2, top + 140, { font: `500 140px ${SERIF}` });
  text(ctx, `${skies.length} ${t.kept(skies.length)}`, W / 2, top + 205, { font: `36px ${SANS}`, color: SOFT });

  const bw = 176, bh = Math.round(176 * JAR_RATIO), gapX = 52, rowH = bh + 100, firstRow = top + 260;
  const left = (W - (4 * bw + 3 * gapX)) / 2;
  const now = new Date();
  for (let m = 0; m < 12; m++) {
    const r = Math.floor(m / 4), col = m % 4;
    const x = left + col * (bw + gapX);
    const y = firstRow + r * rowH;
    const future = year > now.getFullYear() || (year === now.getFullYear() && m > now.getMonth());
    drawJar(ctx, {
      x, y, w: bw, h: bh, skies: skies.filter((s) => new Date(s.takenAt).getMonth() === m),
      capacity: new Date(year, m + 1, 0).getDate(), ghost: future, ink: INK, paper: PAPER, glass: GLASS,
    });
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
  if (kind === 'single') return storySingle(payload.sky, payload.showPlace, payload.quote);
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
