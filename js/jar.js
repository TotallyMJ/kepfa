// Draws a glass mason jar filled with one wavy sand-art layer per sky.
// Shared by the shelf, the jar view, the drop animation and the story exports.

const LIDS = ['#f6b1a8', '#f7c98b', '#bfe3c0', '#a9d4f5', '#c9b8f2', '#f5b5d4',
  '#ffd59e', '#a8e0d9', '#f2a7a0', '#b9c7f7', '#e8b4e6', '#9fd3f0'];

export function lidColor(monthIndex) {
  return LIDS[((monthIndex % 12) + 12) % 12];
}

function shade(hexColor, amt) {
  const n = parseInt(hexColor.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) =>
    Math.max(0, Math.min(255, Math.round(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt)))));
  return `rgb(${ch.join(',')})`;
}

function roundRect(path, x, y, w, h, r) {
  const [tl, tr, br, bl] = Array.isArray(r) ? r : [r, r, r, r];
  path.moveTo(x + tl, y);
  path.lineTo(x + w - tr, y);
  path.quadraticCurveTo(x + w, y, x + w, y + tr);
  path.lineTo(x + w, y + h - br);
  path.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
  path.lineTo(x + bl, y + h);
  path.quadraticCurveTo(x, y + h, x, y + h - bl);
  path.lineTo(x, y + tl);
  path.quadraticCurveTo(x, y, x + tl, y);
  path.closePath();
  return path;
}

/** Size a canvas for crisp drawing at devicePixelRatio and return a context in CSS pixels. */
export function setupCanvas(canvas, cssW, cssH) {
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  canvas.style.width = cssW + 'px';
  canvas.style.height = cssH + 'px';
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);
  return ctx;
}

/**
 * @param ctx 2d context
 * @param o.skies     oldest first; each needs `.palette` (top-to-bottom colors)
 * @param o.capacity  how many layers fill the jar (days in the month)
 * @param o.grow      0..1 height of the newest layer, for the pour animation
 * @param o.lid       lid color
 * @param o.ghost     faded jar for months that haven't happened yet
 * @param o.label     optional text on a strip of washi tape
 * @returns layer rects (CSS px) for hit-testing taps: [{index, top, bottom}]
 */
export function drawJar(ctx, o) {
  const { x, y, w, h, skies = [], capacity = 31, grow = 1, lid = LIDS[0], ghost = false, label, labelFont, outline = 'rgba(31,36,68,.22)' } = o;
  ctx.save();
  if (ghost) ctx.globalAlpha = 0.38;

  const lidH = h * 0.085;
  const lidW = w * 0.74;
  const lidX = x + (w - lidW) / 2;
  const neckH = h * 0.06;
  const neckW = w * 0.68;
  const neckX = x + (w - neckW) / 2;
  const neckY = y + lidH * 0.8;
  const bodyY = neckY + neckH * 0.6;
  const bodyH = y + h - bodyY - h * 0.02;
  const rTop = w * 0.26;
  const rBot = w * 0.17;
  const t = Math.max(1.5, w * 0.035);

  // contact shadow
  ctx.fillStyle = 'rgba(20,24,50,.14)';
  ctx.beginPath();
  ctx.ellipse(x + w / 2, bodyY + bodyH, w * 0.44, Math.max(2, h * 0.02), 0, 0, Math.PI * 2);
  ctx.fill();

  const body = roundRect(new Path2D(), x, bodyY, w, bodyH, [rTop, rTop, rBot, rBot]);
  const neck = roundRect(new Path2D(), neckX, neckY, neckW, neckH + rTop * 0.3, w * 0.04);

  ctx.fillStyle = 'rgba(255,255,255,.26)';
  ctx.fill(neck);
  ctx.fill(body);

  // contents
  const inner = roundRect(new Path2D(), x + t, bodyY + t, w - 2 * t, bodyH - 2 * t, [rTop - t, rTop - t, rBot - t, rBot - t]);
  const innerBottom = bodyY + bodyH - t;
  const innerTop = bodyY + t + bodyH * 0.07;
  const n = skies.length;
  const unit = (innerBottom - innerTop) / Math.max(capacity, n, 1);
  const amp = Math.min(unit * 0.32, w * 0.022);
  const layers = [];

  ctx.save();
  ctx.clip(inner);
  for (let i = n - 1; i >= 0; i--) {
    const yb = innerBottom - i * unit;
    const yt = yb - unit * (i === n - 1 ? grow : 1);
    if (yb - yt < 0.5) continue;
    const phase = i * 1.7;
    const p = new Path2D();
    p.moveTo(x, yb + amp * 2 + 1);
    p.lineTo(x, yt);
    const steps = 28;
    for (let s = 0; s <= steps; s++) {
      const sx = x + (w * s) / steps;
      p.lineTo(sx, yt + Math.sin((s / steps) * Math.PI * 3 + phase) * amp);
    }
    p.lineTo(x + w, yb + amp * 2 + 1);
    p.closePath();
    const pal = skies[i].palette;
    const g = ctx.createLinearGradient(0, yt - amp, 0, yb + amp);
    pal.forEach((c, j) => g.addColorStop(pal.length === 1 ? 0.5 : j / (pal.length - 1), c.hex));
    ctx.fillStyle = g;
    ctx.fill(p);
    layers.push({ index: i, top: yt, bottom: yb });
  }
  // soft depth inside the glass
  const depth = ctx.createLinearGradient(x, 0, x + w, 0);
  depth.addColorStop(0, 'rgba(255,255,255,.18)');
  depth.addColorStop(0.5, 'rgba(255,255,255,0)');
  depth.addColorStop(1, 'rgba(20,24,50,.12)');
  ctx.fillStyle = depth;
  ctx.fillRect(x, bodyY, w, bodyH);
  ctx.restore();

  // glass
  ctx.lineWidth = t;
  ctx.strokeStyle = 'rgba(255,255,255,.62)';
  ctx.stroke(body);
  ctx.lineWidth = Math.max(1, w * 0.008);
  ctx.strokeStyle = outline;
  ctx.stroke(body);
  ctx.fillStyle = 'rgba(255,255,255,.5)';
  ctx.fill(roundRect(new Path2D(), x + w * 0.1, bodyY + bodyH * 0.16, w * 0.065, bodyH * 0.46, w * 0.033));
  ctx.fill(roundRect(new Path2D(), x + w * 0.1, bodyY + bodyH * 0.67, w * 0.065, bodyH * 0.07, w * 0.033));

  ctx.fillStyle = 'rgba(255,255,255,.4)';
  ctx.fill(neck);
  ctx.stroke(neck);

  // lid
  const lidPath = roundRect(new Path2D(), lidX, y, lidW, lidH, lidH * 0.3);
  const lg = ctx.createLinearGradient(0, y, 0, y + lidH);
  lg.addColorStop(0, shade(lid, 0.35));
  lg.addColorStop(0.55, lid);
  lg.addColorStop(1, shade(lid, -0.12));
  ctx.fillStyle = lg;
  ctx.fill(lidPath);
  ctx.strokeStyle = 'rgba(0,0,0,.08)';
  ctx.lineWidth = Math.max(0.75, w * 0.006);
  for (let r = 1; r <= 3; r++) {
    const ly = y + (lidH * r) / 4;
    ctx.beginPath();
    ctx.moveTo(lidX + lidH * 0.25, ly);
    ctx.lineTo(lidX + lidW - lidH * 0.25, ly);
    ctx.stroke();
  }
  ctx.strokeStyle = outline;
  ctx.lineWidth = Math.max(1, w * 0.008);
  ctx.stroke(lidPath);

  if (label) {
    ctx.save();
    ctx.translate(x + w / 2, bodyY + bodyH * 0.4);
    ctx.rotate(-0.05);
    const tw = w * 0.64, th = Math.max(12, h * 0.095);
    ctx.fillStyle = 'rgba(255,251,242,.92)';
    ctx.shadowColor = 'rgba(20,24,50,.18)';
    ctx.shadowBlur = th * 0.25;
    ctx.fillRect(-tw / 2, -th / 2, tw, th);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#3b3654';
    ctx.font = labelFont || `${Math.round(th * 0.55)}px Itim, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 0, th * 0.04);
    ctx.restore();
  }

  ctx.restore();
  return layers;
}
