// One corked apothecary bottle, drawn the same everywhere: SVG on the app's screens,
// canvas for exported images. Both read their outline from bottleShape().

const CORK = '#D8BF96';
const CORK_DOT = '#A98756';

/** Bottle geometry in local coordinates (0,0 top-left), as SVG path strings so Path2D can reuse them. */
export function bottleShape(w, h, inset = 1) {
  const s = inset;
  const cx = w / 2;
  const nw = w * 0.34;
  const lipY = h * 0.125;
  const lipH = h * 0.035;
  const lipW = nw * 1.36;
  const nt = lipY + lipH / 2;
  const ss = h * 0.27;
  const bt = h * 0.42;
  const r = w * 0.13;
  const k = h * 0.07;
  const body = `M${cx - nw / 2} ${nt} L${cx - nw / 2} ${ss} C${cx - nw / 2} ${ss + k} ${s} ${bt - k} ${s} ${bt}`
    + ` L${s} ${h - r - s} Q${s} ${h - s} ${r + s} ${h - s} L${w - r - s} ${h - s} Q${w - s} ${h - s} ${w - s} ${h - r - s}`
    + ` L${w - s} ${bt} C${w - s} ${bt - k} ${cx + nw / 2} ${ss + k} ${cx + nw / 2} ${ss} L${cx + nw / 2} ${nt} Z`;
  const corkBottom = nt + h * 0.05;
  const cork = `M${cx - nw * 0.5} ${s} L${cx + nw * 0.5} ${s} L${cx + nw * 0.4} ${corkBottom} L${cx - nw * 0.4} ${corkBottom} Z`;
  const dots = [[-0.2, 0.045], [0.18, 0.09], [0.02, 0.14], [-0.12, 0.11]].map(([dx, dy]) => [cx + nw * dx, h * dy, w * 0.011]);
  return {
    w, h, cx, nw, nt, ss, bt, body, cork, dots,
    lip: { x: cx - lipW / 2, y: lipY, w: lipW, h: lipH, r: lipH / 2 },
    glare: { x: w * 0.11, y: bt + h * 0.03, w: w * 0.065, h: h * 0.3 },
    photo: { y: nt, h: h - nt },
    fillTop: bt - (bt - ss) * 0.35,
    fillBottom: h - s,
  };
}

/** Wavy sand-art layers, one per sky (oldest at the bottom). Returned top-most first so lower layers paint over the waves above. */
export function layerShapes(shape, skies, capacity, grow = 1) {
  const { w, fillTop, fillBottom } = shape;
  const n = skies.length;
  const unit = (fillBottom - fillTop) / Math.max(capacity, n, 1);
  const amp = Math.min(unit * 0.32, w * 0.022);
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const yb = fillBottom - i * unit;
    const yt = yb - unit * (i === n - 1 ? grow : 1);
    if (yb - yt < 0.5) continue;
    let d = `M0 ${yb + amp * 2 + 1} L0 ${yt}`;
    for (let s = 0; s <= 28; s++) d += ` L${(w * s) / 28} ${yt + Math.sin((s / 28) * Math.PI * 3 + i * 1.7) * amp}`;
    d += ` L${w} ${yb + amp * 2 + 1} Z`;
    out.push({ index: i, d, top: yt - amp, bottom: yb, palette: skies[i].palette });
  }
  return out;
}

let uid = 0;

/** Bottle for the app's screens. Colors come from CSS classes so it follows the theme. */
export function bottleSvg({ w = 100, h = 190, href = '', corked = true, label = '' } = {}) {
  const g = bottleShape(w, h);
  const id = `bottle${uid++}`;
  const { lip, glare } = g;
  return `<svg class="bottle" viewBox="0 0 ${w} ${h}" ${label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"'}>
    <defs><clipPath id="${id}"><path d="${g.body}"/></clipPath></defs>
    <path class="b-glass" d="${g.body}"/>
    <g clip-path="url(#${id})">
      ${href ? `<image href="${href}" x="0" y="${g.photo.y}" width="${w}" height="${g.photo.h}" preserveAspectRatio="xMidYMid slice"/>` : ''}
      <rect class="b-glare" x="${glare.x}" y="${glare.y}" width="${glare.w}" height="${glare.h}" rx="${glare.w / 2}"/>
    </g>
    <path class="b-line" d="${g.body}"/>
    <rect class="b-line b-lip" x="${lip.x}" y="${lip.y}" width="${lip.w}" height="${lip.h}" rx="${lip.r}"/>
    ${corked ? corkSvg(g) : ''}
  </svg>`;
}

export function corkSvg(g) {
  return `<g class="b-cork"><path d="${g.cork}"/>${g.dots.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('')}</g>`;
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
 * Canvas bottle, filled with either a photo or one layer per sky.
 * @returns layer rects for hit-testing taps: [{index, top, bottom}] in the caller's coordinates
 */
export function drawBottle(ctx, { x, y, w, h, image = null, skies = null, capacity = 31, grow = 1, ghost = false, ink = '#2A2723', glass = 'rgba(255,255,255,.4)' }) {
  const line = Math.max(1, w * 0.008);
  const g = bottleShape(w, h, line);
  const body = new Path2D(g.body);
  let layers = [];

  ctx.save();
  ctx.translate(x, y);
  if (ghost) ctx.globalAlpha = 0.35;
  ctx.fillStyle = glass;
  ctx.fill(body);

  ctx.save();
  ctx.clip(body);
  if (image) {
    const iw = image.naturalWidth || image.width;
    const ih = image.naturalHeight || image.height;
    const s = Math.max(w / iw, g.photo.h / ih);
    ctx.drawImage(image, (w - iw * s) / 2, g.photo.y + (g.photo.h - ih * s) / 2, iw * s, ih * s);
  } else if (skies) {
    layers = layerShapes(g, skies, capacity, grow);
    for (const l of layers) {
      const grad = ctx.createLinearGradient(0, l.top, 0, l.bottom);
      l.palette.forEach((c, j) => grad.addColorStop(l.palette.length === 1 ? 0.5 : j / (l.palette.length - 1), c.hex));
      ctx.fillStyle = grad;
      ctx.fill(new Path2D(l.d));
    }
  }
  ctx.fillStyle = 'rgba(255,255,255,.38)';
  ctx.beginPath();
  ctx.roundRect(g.glare.x, g.glare.y, g.glare.w, g.glare.h, g.glare.w / 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.globalAlpha *= 0.38;
  ctx.strokeStyle = ink;
  ctx.lineWidth = line;
  ctx.stroke(body);
  ctx.beginPath();
  ctx.roundRect(g.lip.x, g.lip.y, g.lip.w, g.lip.h, g.lip.r);
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = CORK;
  ctx.fill(new Path2D(g.cork));
  ctx.fillStyle = CORK_DOT;
  for (const [cx, cy, r] of g.dots) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  return layers.map((l) => ({ index: l.index, top: y + l.top, bottom: y + l.bottom }));
}
