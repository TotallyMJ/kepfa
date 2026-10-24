// 1080×1920 images sized for an Instagram story: one sky, one month's jar, or the whole year's shelf.

import { drawJar, lidColor } from './jar.js';
import { SKY_TYPES, hexToRgb, luminance, mix, dominant, loadImage } from './sky.js';

const W = 1080, H = 1920;
const INK = '#1f2444';
const TH_MONTHS = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const TH_MONTHS_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

async function fontsReady() {
  try {
    await Promise.all([
      document.fonts.load('64px Itim'),
      document.fonts.load('40px Anuphan'),
      document.fonts.load('500 40px Anuphan'),
      document.fonts.load('30px "DM Mono"'),
    ]);
  } catch { /* fall back to system fonts */ }
}

function canvas() {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  return [c, c.getContext('2d')];
}

function toBlob(c) {
  return new Promise((resolve) => c.toBlob(resolve, 'image/jpeg', 0.92));
}

function soften(hexColor, t) {
  const [r, g, b] = mix(hexToRgb(hexColor), [255, 255, 255], t);
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}

function backdrop(ctx, colors, soft) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  colors.forEach((c, i) => g.addColorStop(colors.length === 1 ? 0 : i / (colors.length - 1), soften(c, soft)));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // grain so the gradient doesn't band on IG's compression
  const img = ctx.getImageData(0, 0, W, H);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 6;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

function textColorFor(colors, soft) {
  const avg = colors.map(hexToRgb).map((c) => mix(c, [255, 255, 255], soft)).reduce((a, c) => a + luminance(c), 0) / colors.length;
  return avg > 0.55 ? INK : '#ffffff';
}

function wrap(ctx, text, maxW, maxLines) {
  // Thai has no spaces between words, so wrap by character when a line overflows.
  const lines = [];
  let line = '';
  for (const ch of Array.from(text)) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = ch.trimStart();
      if (lines.length === maxLines) break;
    } else {
      line = test;
    }
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === maxLines && lines.join('').length < Array.from(text).length) {
    lines[maxLines - 1] = lines[maxLines - 1].slice(0, -1) + '…';
  }
  return lines;
}

function wordmark(ctx, color, y) {
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.85;
  ctx.font = '52px Itim, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('kepfa', W / 2, y);
  ctx.globalAlpha = 1;
}

function pill(ctx, text, cx, cy, fg, bg) {
  ctx.font = '500 34px Anuphan, sans-serif';
  const tw = ctx.measureText(text).width;
  const pw = tw + 64, ph = 72;
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(cx - pw / 2, cy - ph / 2, pw, ph, ph / 2);
  ctx.fill();
  ctx.fillStyle = fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, cx, cy + 2);
}

export function thaiDate(ms) {
  const d = new Date(ms);
  return `${d.getDate()} ${TH_MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

export function thaiTime(ms) {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

async function storySingle(sky) {
  const [c, ctx] = canvas();
  const colors = sky.palette.map((p) => p.hex);
  backdrop(ctx, colors, 0.35);
  const fg = textColorFor(colors, 0.35);

  wordmark(ctx, fg, 140);
  ctx.font = '30px "DM Mono", monospace';
  ctx.fillStyle = fg;
  ctx.globalAlpha = 0.75;
  ctx.fillText(`${thaiDate(sky.takenAt)}  ·  ${thaiTime(sky.takenAt)}`, W / 2, 196);
  ctx.globalAlpha = 1;

  // Polaroid with the note written on the bottom strip.
  const cardX = 130, cardY = 260, cardW = 820, pad = 38;
  const photoW = cardW - pad * 2, photoH = Math.round(photoW * 4 / 3);
  const cardH = pad + photoH + 190;
  ctx.save();
  ctx.translate(W / 2, cardY + cardH / 2);
  ctx.rotate(-0.025);
  ctx.translate(-W / 2, -(cardY + cardH / 2));
  ctx.shadowColor = 'rgba(20,24,50,.28)';
  ctx.shadowBlur = 50;
  ctx.shadowOffsetY = 18;
  ctx.fillStyle = '#fffdf8';
  ctx.fillRect(cardX, cardY, cardW, cardH);
  ctx.shadowColor = 'transparent';

  const { img, release } = await loadImage(sky.photo);
  const s = Math.max(photoW / img.naturalWidth, photoH / img.naturalHeight);
  const iw = img.naturalWidth * s, ih = img.naturalHeight * s;
  ctx.save();
  ctx.beginPath();
  ctx.rect(cardX + pad, cardY + pad, photoW, photoH);
  ctx.clip();
  ctx.drawImage(img, cardX + pad + (photoW - iw) / 2, cardY + pad + (photoH - ih) / 2, iw, ih);
  ctx.restore();
  release();

  ctx.fillStyle = '#3b3654';
  ctx.font = '46px Itim, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const note = sky.note?.trim() || SKY_TYPES[sky.type].th;
  wrap(ctx, note, photoW, 2).forEach((ln, i) => ctx.fillText(ln, cardX + pad + 4, cardY + pad + photoH + 82 + i * 60));
  ctx.restore();

  // Palette swatches with hex codes.
  const sw = sky.palette.slice(0, 5);
  const d = 118, gap = 36;
  const rowW = sw.length * d + (sw.length - 1) * gap;
  let sx = (W - rowW) / 2;
  const sy = 1600;
  sw.forEach((p) => {
    ctx.fillStyle = p.hex;
    ctx.beginPath();
    ctx.arc(sx + d / 2, sy, d / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(255,255,255,.85)';
    ctx.stroke();
    ctx.fillStyle = fg;
    ctx.font = '24px "DM Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(p.hex.toUpperCase(), sx + d / 2, sy + d / 2 + 44);
    sx += d + gap;
  });

  const t = SKY_TYPES[sky.type];
  pill(ctx, `${t.th} · ${t.en}`, W / 2, 1800, INK, 'rgba(255,255,255,.72)');
  return toBlob(c);
}

async function storyJar({ year, month, skies }) {
  const [c, ctx] = canvas();
  const colors = skies.length ? skies.slice().reverse().map((s) => dominant(s.palette).hex) : ['#c8d2f3', '#fcdccb'];
  const bg = colors.length > 6 ? colors.filter((_, i) => i % Math.ceil(colors.length / 6) === 0) : colors;
  backdrop(ctx, bg, 0.55);
  const fg = textColorFor(bg, 0.55);

  ctx.fillStyle = fg;
  ctx.textAlign = 'center';
  ctx.font = '96px Itim, sans-serif';
  ctx.fillText(`ฟ้าเดือน${TH_MONTHS[month]}`, W / 2, 250);
  ctx.font = '40px Anuphan, sans-serif';
  ctx.globalAlpha = 0.8;
  ctx.fillText(`${year}  ·  เก็บไว้ ${skies.length} ท้องฟ้า`, W / 2, 322);
  ctx.globalAlpha = 1;

  const days = new Date(year, month + 1, 0).getDate();
  drawJar(ctx, {
    x: 230, y: 420, w: 620, h: 900, skies, capacity: days, lid: lidColor(month),
    label: TH_MONTHS_SHORT[month], labelFont: '50px Itim, sans-serif', outline: 'rgba(31,36,68,.28)',
  });

  // One dot per sky: the month as a row of colors.
  const dot = 34, gap = 12, perRow = 16;
  const rows = Math.ceil(skies.length / perRow);
  skies.forEach((s, i) => {
    const r = Math.floor(i / perRow), col = i % perRow;
    const inRow = Math.min(perRow, skies.length - r * perRow);
    const rowW = inRow * dot + (inRow - 1) * gap;
    const cx = (W - rowW) / 2 + col * (dot + gap) + dot / 2;
    const cy = 1440 + r * (dot + gap) + (rows === 1 ? 20 : 0);
    ctx.fillStyle = dominant(s.palette).hex;
    ctx.beginPath();
    ctx.arc(cx, cy, dot / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.8)';
    ctx.lineWidth = 3;
    ctx.stroke();
  });

  const counts = {};
  skies.forEach((s) => { counts[s.type] = (counts[s.type] || 0) + 1; });
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  if (top) pill(ctx, `ฟ้าที่เจอบ่อยสุด: ${SKY_TYPES[top[0]].th}`, W / 2, 1640, INK, 'rgba(255,255,255,.72)');
  wordmark(ctx, fg, 1820);
  return toBlob(c);
}

async function storyYear({ year, skies }) {
  const [c, ctx] = canvas();
  backdrop(ctx, ['#c3c9ef', '#e9d4f0', '#ffd8c4'], 0.15);
  const fg = INK;

  ctx.fillStyle = fg;
  ctx.textAlign = 'center';
  ctx.font = '96px Itim, sans-serif';
  ctx.fillText(`ฟ้าของฉัน ${year}`, W / 2, 230);
  const types = new Set(skies.map((s) => s.type)).size;
  ctx.font = '40px Anuphan, sans-serif';
  ctx.globalAlpha = 0.75;
  ctx.fillText(`${skies.length} ท้องฟ้า  ·  ${types} จาก ${Object.keys(SKY_TYPES).length} แบบ`, W / 2, 300);
  ctx.globalAlpha = 1;

  const jw = 196, jh = 262, gapX = 44, rowH = 360;
  const left = (W - (4 * jw + 3 * gapX)) / 2;
  const now = new Date();
  for (let m = 0; m < 12; m++) {
    const r = Math.floor(m / 4), col = m % 4;
    const x = left + col * (jw + gapX);
    const y = 390 + r * rowH;
    const monthSkies = skies.filter((s) => new Date(s.takenAt).getMonth() === m);
    const future = year > now.getFullYear() || (year === now.getFullYear() && m > now.getMonth());
    drawJar(ctx, {
      x, y, w: jw, h: jh, skies: monthSkies, capacity: new Date(year, m + 1, 0).getDate(),
      lid: lidColor(m), ghost: future, outline: 'rgba(31,36,68,.28)',
    });
    if (col === 0) {
      // plank
      const py = y + jh + 4;
      const pg = ctx.createLinearGradient(0, py, 0, py + 26);
      pg.addColorStop(0, '#e8c79f');
      pg.addColorStop(1, '#c79c6c');
      ctx.fillStyle = pg;
      ctx.shadowColor = 'rgba(60,40,20,.25)';
      ctx.shadowBlur = 16;
      ctx.shadowOffsetY = 8;
      ctx.beginPath();
      ctx.roundRect(left - 30, py, 4 * jw + 3 * gapX + 60, 26, 8);
      ctx.fill();
      ctx.shadowColor = 'transparent';
    }
    ctx.fillStyle = 'rgba(31,36,68,.75)';
    ctx.font = '500 30px Anuphan, sans-serif';
    ctx.fillText(TH_MONTHS_SHORT[m], x + jw / 2, y + jh + 68);
  }

  // The year as a strip of colors, one sliver per sky.
  const stripY = 1520, stripH = 150, stripX = 90, stripW = W - 180;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(stripX, stripY, stripW, stripH, 28);
  ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,.5)';
  ctx.fillRect(stripX, stripY, stripW, stripH);
  if (skies.length) {
    const bw = stripW / skies.length;
    skies.forEach((s, i) => {
      const g = ctx.createLinearGradient(0, stripY, 0, stripY + stripH);
      s.palette.forEach((p, j) => g.addColorStop(s.palette.length === 1 ? 0.5 : j / (s.palette.length - 1), p.hex));
      ctx.fillStyle = g;
      ctx.fillRect(stripX + i * bw, stripY, bw + 1, stripH);
    });
  }
  ctx.restore();
  ctx.fillStyle = fg;
  ctx.globalAlpha = 0.7;
  ctx.font = '28px Anuphan, sans-serif';
  ctx.fillText('ทุกท้องฟ้าที่เก็บไว้ เรียงตามวัน', W / 2, stripY + stripH + 52);
  ctx.globalAlpha = 1;

  wordmark(ctx, fg, 1830);
  return toBlob(c);
}

export async function makeStory(kind, payload) {
  await fontsReady();
  if (kind === 'single') return storySingle(payload);
  if (kind === 'jar') return storyJar(payload);
  return storyYear(payload);
}

/** Mobile: native share sheet (pick Instagram → Story). Desktop or unsupported: save the file. */
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
