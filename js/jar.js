// The jar is a real photo (assets/jar.jpg, a front-on jam jar on white). At start-up it is split into layers:
// the glass as see-through ink (dark ink for light paper, light ink for dark paper) and the brass lid on its own.
// Skies sit under the glass, clipped to the measured inside of the jar. SVG on screen, canvas for exported images.

const SRC = { url: 'assets/jar.jpg', w: 1088, h: 1456 };   // the photo's coordinate space
export const BOX = { x: 169, y: 150, w: 746, h: 1160 };    // the jar inside the photo
const LID = { y0: 150, y1: 312, x0: 206, x1: 878 };
export const INSIDE = { x: 183, y: 318, w: 718, h: 978 };   // bounds of the glass interior
export const INTERIOR = 'M228 318 L860 318 L862 410 C880 430 901 455 901 520 L901 1200 C901 1260 870 1292 800 1296'
  + ' L288 1296 C218 1292 183 1260 183 1200 L183 520 C183 455 206 430 226 410 Z';
export const MOUTH = { x: 544, y: 322, rx: 316, ry: 26 };
export const JAR_RATIO = BOX.h / BOX.w;

let layers = null;

function processLayer(img, fn) {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, c.width, c.height);
  fn(data.data, c.width, c.height, c.height / SRC.h);
  ctx.putImageData(data, 0, 0);
  return c;
}

const toUrl = (canvas) => new Promise((resolve) => canvas.toBlob((b) => resolve(URL.createObjectURL(b)), 'image/png'));

/** Load the photo once and build the layers. Call before drawing any jar. */
export async function loadJar() {
  if (layers) return layers;
  const img = new Image();
  await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; img.src = SRC.url; });

  // Glass as ink whose opacity follows how dark the photo is: looks like multiply, with no white box around it.
  const glass = (rgb, strength) => processLayer(img, (d, w, h, s) => {
    const lidBottom = LID.y1 * s;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const lum = (d[i] + d[i + 1] + d[i + 2]) / 3;
        d[i + 3] = y < lidBottom ? 0 : Math.max(0, Math.min(255, (252 - lum) * strength));
        d[i] = rgb[0]; d[i + 1] = rgb[1]; d[i + 2] = rgb[2];
      }
    }
  });
  const ink = glass([30, 28, 25], 1.15);
  const light = glass([236, 230, 220], 3);
  // The lid on its own, white keyed out.
  const lid = processLayer(img, (d, w, h, s) => {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        if (y < (LID.y0 - 4) * s || y > LID.y1 * s) { d[i + 3] = 0; continue; }
        const m = Math.min(d[i], d[i + 1], d[i + 2]);
        d[i + 3] = Math.max(0, Math.min(255, (250 - m) * 6));
      }
    }
  });
  const [inkUrl, lightUrl, lidUrl] = await Promise.all([toUrl(ink), toUrl(light), toUrl(lid)]);
  layers = { ink, light, lid, inkUrl, lightUrl, lidUrl };
  return layers;
}

/** A point in the photo, in a jar drawn `w` wide with its top-left at 0,0. */
export function jarPoint(px, py, w) {
  const s = w / BOX.w;
  return [(px - BOX.x) * s, (py - BOX.y) * s];
}

/** Wavy sand-art layers, one per sky (oldest at the bottom), in photo coordinates. Top-most first. */
export function layerShapes(skies, capacity) {
  const x0 = INSIDE.x, w = INSIDE.w;
  const fillTop = 470, fillBottom = INSIDE.y + INSIDE.h;
  const n = skies.length;
  const unit = (fillBottom - fillTop) / Math.max(capacity, n, 1);
  const amp = Math.min(unit * 0.32, w * 0.022);
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const yb = fillBottom - i * unit;
    const yt = yb - unit;
    let d = `M${x0} ${yb + amp * 2 + 1} L${x0} ${yt}`;
    for (let s = 0; s <= 28; s++) d += ` L${x0 + (w * s) / 28} ${yt + Math.sin((s / 28) * Math.PI * 3 + i * 1.7) * amp}`;
    d += ` L${x0 + w} ${yb + amp * 2 + 1} Z`;
    out.push({ index: i, d, top: yt - amp, bottom: yb, palette: skies[i].palette });
  }
  return out;
}

let uid = 0;

/** The lid with a band of light that can sweep across it to show a twist. */
export function lidSvg() {
  if (!layers) return '<g class="j-lid"><rect class="j-shine" data-travel="0"/></g>';
  return `<g class="j-lid"><image href="${layers.lidUrl}" x="0" y="0" width="${SRC.w}" height="${SRC.h}"/>`
    + `<rect class="j-shine" x="${LID.x0 - 120}" y="${LID.y0}" width="120" height="${LID.y1 - LID.y0}" data-travel="${LID.x1 - LID.x0 + 120}"/></g>`;
}

/** Jar for the app's screens. Light or dark glass is picked by CSS, so it follows the theme. */
export function jarSvg({ href = '', lidded = true, label = '' } = {}) {
  const id = `jar${uid++}`;
  return `<svg class="jar" viewBox="${BOX.x} ${BOX.y} ${BOX.w} ${BOX.h}" ${label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"'}>
    <defs><clipPath id="${id}"><path d="${INTERIOR}"/></clipPath></defs>
    <path class="j-glass" d="${INTERIOR}"/>
    <g clip-path="url(#${id})">
      <g class="j-sky">${href ? `<image href="${href}" x="${INSIDE.x}" y="${INSIDE.y}" width="${INSIDE.w}" height="${INSIDE.h}" preserveAspectRatio="xMidYMid slice"/>` : ''}</g>
      <rect class="j-glow" x="${INSIDE.x}" y="${INSIDE.y}" width="${INSIDE.w}" height="${INSIDE.h}"/>
    </g>
    ${layers
      ? `<image class="j-body j-body-ink" href="${layers.inkUrl}" x="0" y="0" width="${SRC.w}" height="${SRC.h}"/>
    <image class="j-body j-body-light" href="${layers.lightUrl}" x="0" y="0" width="${SRC.w}" height="${SRC.h}"/>`
      : `<path class="j-outline" d="${INTERIOR}"/>`}
    <ellipse class="j-ripple" cx="${MOUTH.x}" cy="${MOUTH.y}" rx="${MOUTH.rx}" ry="${MOUTH.ry}"/>
    ${lidded ? lidSvg() : ''}
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
 * Canvas jar `w` wide at x,y, filled with either a photo or one layer per sky.
 * @returns layer rects for hit-testing taps: [{index, top, bottom}] in the caller's coordinates
 */
export function drawJar(ctx, { x, y, w, image = null, skies = null, capacity = 31, ghost = false, dark = false }) {
  const s = w / BOX.w;
  let layerList = [];
  ctx.save();
  ctx.translate(x - BOX.x * s, y - BOX.y * s);
  ctx.scale(s, s);
  if (ghost) ctx.globalAlpha = 0.35;
  const inside = new Path2D(INTERIOR);
  ctx.fillStyle = dark ? 'rgba(255,255,255,.05)' : 'rgba(255,255,255,.35)';
  ctx.fill(inside);

  ctx.save();
  ctx.clip(inside);
  if (image) {
    const iw = image.naturalWidth || image.width;
    const ih = image.naturalHeight || image.height;
    const k = Math.max(INSIDE.w / iw, INSIDE.h / ih);
    ctx.drawImage(image, INSIDE.x + (INSIDE.w - iw * k) / 2, INSIDE.y + (INSIDE.h - ih * k) / 2, iw * k, ih * k);
  } else if (skies) {
    layerList = layerShapes(skies, capacity);
    for (const l of layerList) {
      const grad = ctx.createLinearGradient(0, l.top, 0, l.bottom);
      l.palette.forEach((c, j) => grad.addColorStop(l.palette.length === 1 ? 0.5 : j / (l.palette.length - 1), c.hex));
      ctx.fillStyle = grad;
      ctx.fill(new Path2D(l.d));
    }
  }
  ctx.restore();

  if (layers) {
    ctx.drawImage(dark ? layers.light : layers.ink, 0, 0, SRC.w, SRC.h);
    ctx.drawImage(layers.lid, 0, 0, SRC.w, SRC.h);
  }
  ctx.restore();

  return layerList.map((l) => ({ index: l.index, top: y + (l.top - BOX.y) * s, bottom: y + (l.bottom - BOX.y) * s }));
}
