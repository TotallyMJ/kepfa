// One screw-top jam jar, drawn the same everywhere: SVG on the app's screens,
// canvas for exported images. Both read their outline from jarShape().

export const JAR_RATIO = 1.35;

/** Jar geometry in local coordinates (0,0 top-left), as SVG path strings so Path2D can reuse them. */
export function jarShape(w, h, inset = 1) {
  const s = inset;
  const lidH = h * 0.11;
  const mx = w * 0.1;
  const neckY = lidH;
  const sy = neckY + h * 0.05;
  const by = sy + h * 0.07;
  const r = w * 0.12;
  const body = `M${mx} ${neckY} L${mx} ${sy} Q${mx} ${by - h * 0.02} ${s} ${by}`
    + ` L${s} ${h - r - s} Q${s} ${h - s} ${r + s} ${h - s} L${w - r - s} ${h - s} Q${w - s} ${h - s} ${w - s} ${h - r - s}`
    + ` L${w - s} ${by} Q${w - mx} ${by - h * 0.02} ${w - mx} ${sy} L${w - mx} ${neckY} Z`;
  const lidW = w - 2 * mx + w * 0.06;
  const lid = { x: (w - lidW) / 2, y: s, w: lidW, h: lidH - s, r: Math.max(1, w * 0.015) };
  const ridges = Array.from({ length: 14 }, (_, i) => lid.x + lid.w * (0.04 + (0.92 * i) / 13));
  return {
    w, h, mx, lid, ridges, body,
    threads: [neckY + h * 0.018, neckY + h * 0.034],
    glare: { x: w * 0.09, y: by + h * 0.04, w: w * 0.06, h: h * 0.4 },
    photo: { y: neckY, h: h - neckY },
    fillTop: sy + h * 0.02,
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

/** Lid with ridges that run past both edges (clipped), so they can slide to show a twist. */
export function lidSvg(g, id = `lid${uid++}`) {
  const { lid } = g;
  const step = g.ridges[1] - g.ridges[0];
  const ridges = Array.from({ length: g.ridges.length + 8 }, (_, i) => g.ridges[0] + (i - 4) * step);
  return `<g class="j-lid"><defs><clipPath id="${id}"><rect x="${lid.x}" y="${lid.y}" width="${lid.w}" height="${lid.h}" rx="${lid.r}"/></clipPath></defs>`
    + `<rect class="j-lid-cap" x="${lid.x}" y="${lid.y}" width="${lid.w}" height="${lid.h}" rx="${lid.r}"/>`
    + `<g clip-path="url(#${id})"><g class="j-ridges" data-step="${step}">${ridges.map((x) => `<line x1="${x}" x2="${x}" y1="${lid.y + lid.h * 0.18}" y2="${lid.y + lid.h * 0.82}"/>`).join('')}</g>`
    + `<rect class="j-shine" x="${lid.x - lid.w * 0.2}" y="${lid.y}" width="${lid.w * 0.2}" height="${lid.h}" data-travel="${lid.w * 1.2}"/></g></g>`;
}

/** Jar for the app's screens. Colors come from CSS classes so it follows the theme. */
export function jarSvg({ w = 100, h = 135, href = '', lidded = true, label = '' } = {}) {
  const g = jarShape(w, h);
  const id = `jar${uid++}`;
  const { glare } = g;
  return `<svg class="jar" viewBox="0 0 ${w} ${h}" ${label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"'}>
    <defs><clipPath id="${id}"><path d="${g.body}"/></clipPath></defs>
    <path class="j-glass" d="${g.body}"/>
    <g clip-path="url(#${id})">
      <g class="j-sky">${href ? `<image href="${href}" x="0" y="${g.photo.y}" width="${w}" height="${g.photo.h}" preserveAspectRatio="xMidYMid slice"/>` : ''}</g>
      <rect class="j-glare" x="${glare.x}" y="${glare.y}" width="${glare.w}" height="${glare.h}" rx="${glare.w / 2}"/>
      <rect class="j-glow" width="${w}" height="${h}"/>
    </g>
    <path class="j-line" d="${g.body}"/>
    ${g.threads.map((y) => `<line class="j-thread" x1="${g.mx}" x2="${w - g.mx}" y1="${y}" y2="${y}"/>`).join('')}
    <ellipse class="j-ripple" cx="${w / 2}" cy="${g.photo.y + 2}" rx="${w / 2 - g.mx}" ry="${h * 0.03}"/>
    ${lidded ? lidSvg(g, `${id}l`) : ''}
  </svg>`;
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
 * Canvas jar, filled with either a photo or one layer per sky.
 * @returns layer rects for hit-testing taps: [{index, top, bottom}] in the caller's coordinates
 */
export function drawJar(ctx, { x, y, w, h, image = null, skies = null, capacity = 31, ghost = false, ink = '#1E1C19', paper = '#F1EDE6', glass = 'rgba(255,255,255,.4)' }) {
  const line = Math.max(1, w * 0.008);
  const g = jarShape(w, h, line);
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
    layers = layerShapes(g, skies, capacity);
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
  ctx.strokeStyle = ink;
  ctx.lineWidth = line;
  ctx.globalAlpha *= 0.45;
  ctx.stroke(body);
  ctx.globalAlpha /= 0.45;
  ctx.globalAlpha *= 0.3;
  for (const ty of g.threads) {
    ctx.beginPath();
    ctx.moveTo(g.mx, ty);
    ctx.lineTo(w - g.mx, ty);
    ctx.stroke();
  }
  ctx.restore();

  const { lid } = g;
  ctx.fillStyle = ink;
  ctx.beginPath();
  ctx.roundRect(lid.x, lid.y, lid.w, lid.h, lid.r);
  ctx.fill();
  ctx.save();
  ctx.strokeStyle = paper;
  ctx.globalAlpha *= 0.2;
  ctx.lineWidth = line;
  for (const rx of g.ridges) {
    ctx.beginPath();
    ctx.moveTo(rx, lid.y + lid.h * 0.18);
    ctx.lineTo(rx, lid.y + lid.h * 0.82);
    ctx.stroke();
  }
  ctx.restore();
  ctx.restore();

  return layers.map((l) => ({ index: l.index, top: y + l.top, bottom: y + l.bottom }));
}
