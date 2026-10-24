// Everything about a single sky photo: palette extraction, sky-type guess, resizing,
// and procedurally drawn sample skies for the first-run demo shelf.

export const SKY_TYPES = {
  sunrise:  { th: 'ฟ้ายามเช้า', en: 'Sunrise',      grad: ['#7d97cf', '#f4b6a6', '#ffe1a8'] },
  clear:    { th: 'ฟ้าใส',      en: 'Clear blue',   grad: ['#3f7fd8', '#8fc1f0', '#dcefff'] },
  cloudy:   { th: 'ฟ้าเมฆ',     en: 'Cloudy',       grad: ['#8d9cb0', '#c3ccd7', '#eceff3'] },
  pink:     { th: 'ฟ้าสีชมพู',  en: 'Cotton candy', grad: ['#8a7fd6', '#e8a6cc', '#ffd5bd'] },
  sunset:   { th: 'ฟ้ายามเย็น', en: 'Sunset',       grad: ['#3b3f78', '#ef7f7a', '#ffbf6b'] },
  bluehour: { th: 'บลูอาวร์',   en: 'Blue hour',    grad: ['#16245a', '#36559e', '#8b98cc'] },
  storm:    { th: 'ฟ้าครึ้ม',   en: 'Stormy',       grad: ['#353b45', '#5d6570', '#8f959e'] },
  night:    { th: 'ฟ้ากลางคืน', en: 'Night',        grad: ['#070b1f', '#18224d', '#363b6b'] },
  rainbow:  { th: 'ฟ้ามีรุ้ง',  en: 'Rainbow',      grad: ['#7fb2e8', '#f3a9c4', '#ffe08a'] },
};
export const TYPE_ORDER = Object.keys(SKY_TYPES);

// ---------- color helpers ----------

export function hex([r, g, b]) {
  return '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
}

export function hexToRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}

/** Relative luminance 0..1, good enough to pick dark or light text. */
export function luminance([r, g, b]) {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

export function mix(a, b, t) {
  return [0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * t);
}

// ---------- palette ----------

/**
 * k-means over a downscaled copy of the photo. Returns up to k colors ordered
 * top-to-bottom by where they sit in the frame, so a palette reads like the sky itself.
 */
export function extractPalette(src, k = 5) {
  const sw = src.naturalWidth || src.width;
  const sh = src.naturalHeight || src.height;
  const scale = 56 / Math.max(sw, sh);
  const w = Math.max(8, Math.round(sw * scale));
  const h = Math.max(8, Math.round(sh * scale));
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(src, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);

  // Phone sky shots usually have rooftops or trees along the bottom; leave that strip out
  // so the palette is the sky, not the skyline.
  const skyRows = Math.max(4, Math.round(h * 0.8));
  const pts = [];
  for (let y = 0; y < skyRows; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (data[i + 3] < 128) continue;
      pts.push([data[i], data[i + 1], data[i + 2], y / (skyRows - 1)]);
    }
  }

  const lum = (p) => p[0] * 0.3 + p[1] * 0.59 + p[2] * 0.11;
  const sorted = pts.slice().sort((a, b) => lum(a) - lum(b));
  let centers = Array.from({ length: k }, (_, j) => sorted[Math.floor(((j + 0.5) / k) * sorted.length)].slice(0, 4));
  let counts = new Array(k).fill(0);

  for (let iter = 0; iter < 12; iter++) {
    const acc = centers.map(() => [0, 0, 0, 0]);
    counts = new Array(centers.length).fill(0);
    for (const q of pts) {
      let best = 0, bd = Infinity;
      for (let j = 0; j < centers.length; j++) {
        const cc = centers[j];
        const d = (q[0] - cc[0]) ** 2 + (q[1] - cc[1]) ** 2 + (q[2] - cc[2]) ** 2;
        if (d < bd) { bd = d; best = j; }
      }
      const a = acc[best];
      a[0] += q[0]; a[1] += q[1]; a[2] += q[2]; a[3] += q[3];
      counts[best]++;
    }
    centers = acc.map((a, j) => (counts[j] ? a.map((v) => v / counts[j]) : centers[j]));
  }

  // Drop empty clusters and merge near-duplicates so flat skies don't show five identical swatches.
  let clusters = centers.map((cc, j) => ({ rgb: cc.slice(0, 3), y: cc[3], n: counts[j] })).filter((cl) => cl.n > 0);
  for (let i = 0; i < clusters.length; i++) {
    for (let j = i + 1; j < clusters.length; j++) {
      const a = clusters[i], b = clusters[j];
      const d = Math.hypot(a.rgb[0] - b.rgb[0], a.rgb[1] - b.rgb[1], a.rgb[2] - b.rgb[2]);
      if (d < 22) {
        const t = b.n / (a.n + b.n);
        a.rgb = mix(a.rgb, b.rgb, t);
        a.y = a.y + (b.y - a.y) * t;
        a.n += b.n;
        clusters.splice(j, 1);
        j--;
      }
    }
  }

  const total = clusters.reduce((s, cl) => s + cl.n, 0);
  return clusters
    .sort((a, b) => a.y - b.y)
    .map((cl) => ({ hex: hex(cl.rgb), rgb: cl.rgb.map(Math.round), weight: cl.n / total, y: cl.y }));
}

export function dominant(palette) {
  return palette.reduce((a, b) => (b.weight > a.weight ? b : a), palette[0]);
}

/** Best guess at the sky type from palette + time of day. The user can always change it. */
export function classify(palette, date = new Date()) {
  const hour = date.getHours() + date.getMinutes() / 60;
  let L = 0, S = 0, warm = 0, pink = 0, blue = 0;
  for (const c of palette) {
    const [h, s, l] = rgbToHsl(...c.rgb);
    L += l * c.weight;
    S += s * c.weight;
    if (s > 0.28 && l > 0.25 && l < 0.92) {
      if (h < 55 || h >= 345) warm += c.weight;
      else if (h >= 275) pink += c.weight;
      else if (h >= 185 && h < 255) blue += c.weight;
    }
  }
  if (L < 0.17) return 'night';
  if (S < 0.2 && L < 0.42) return 'storm';
  if (warm > 0.22) return hour >= 4 && hour < 11 ? 'sunrise' : 'sunset';
  if (pink > 0.25) return 'pink';
  if (blue > 0.3 && L < 0.38) return 'bluehour';
  if (S < 0.18) return 'cloudy';
  return 'clear';
}

// ---------- image prep ----------

export async function loadImage(blob) {
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
  try {
    await img.decode();
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
  return { img, release: () => URL.revokeObjectURL(url) };
}

function resizeToBlob(img, maxSide, quality) {
  const sw = img.naturalWidth || img.width;
  const sh = img.naturalHeight || img.height;
  const s = Math.min(1, maxSide / Math.max(sw, sh));
  const c = document.createElement('canvas');
  c.width = Math.round(sw * s);
  c.height = Math.round(sh * s);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return new Promise((resolve) => c.toBlob(resolve, 'image/jpeg', quality));
}

/** Turn a picked/captured image into what we store: a capped photo, a thumbnail and its palette. */
export async function prepareImage(blob) {
  const { img, release } = await loadImage(blob);
  try {
    const [photo, thumb] = await Promise.all([resizeToBlob(img, 1440, 0.86), resizeToBlob(img, 360, 0.8)]);
    const palette = extractPalette(img);
    return { photo, thumb, palette, width: img.naturalWidth, height: img.naturalHeight };
  } finally {
    release();
  }
}

// ---------- sample skies ----------

function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function cloud(ctx, x, y, size, color, rand) {
  for (let i = 0; i < 6; i++) {
    const cx = x + (rand() - 0.5) * size * 1.6;
    const cy = y + (rand() - 0.5) * size * 0.35;
    const r = size * (0.35 + rand() * 0.4);
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, cy, r * 1.4, r * 0.75, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Paint a believable phone-photo sky (gradient, sun, clouds, rooftops) for the demo shelf. */
export function makeSampleSky(kind, seed) {
  const W = 720, H = 960;
  const rand = rng(seed);
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const [a, b, d] = SKY_TYPES[kind].grad;

  const g = ctx.createLinearGradient(0, 0, 0, H * 0.9);
  g.addColorStop(0, a);
  g.addColorStop(0.55 + (rand() - 0.5) * 0.15, b);
  g.addColorStop(1, d);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  if (kind === 'night' || kind === 'bluehour') {
    const stars = kind === 'night' ? 140 : 30;
    for (let i = 0; i < stars; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.3 + rand() * 0.6})`;
      ctx.beginPath();
      ctx.arc(rand() * W, rand() * H * 0.7, rand() * 1.8 + 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    if (kind === 'night') {
      const mx = W * (0.25 + rand() * 0.5), my = H * (0.15 + rand() * 0.15);
      const glow = ctx.createRadialGradient(mx, my, 10, mx, my, 120);
      glow.addColorStop(0, 'rgba(255,248,220,.5)');
      glow.addColorStop(1, 'rgba(255,248,220,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#fff6dc';
      ctx.beginPath(); ctx.arc(mx, my, 26, 0, Math.PI * 2); ctx.fill();
    }
  }

  if (kind === 'sunset' || kind === 'sunrise' || kind === 'pink') {
    const sx = W * (0.25 + rand() * 0.5), sy = H * (0.66 + rand() * 0.08);
    const sun = ctx.createRadialGradient(sx, sy, 0, sx, sy, 320);
    sun.addColorStop(0, 'rgba(255,236,190,.85)');
    sun.addColorStop(0.18, 'rgba(255,214,150,.45)');
    sun.addColorStop(1, 'rgba(255,200,140,0)');
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, W, H);
  }

  if (kind === 'rainbow') {
    const cols = ['#ff6b6b', '#ffa94d', '#ffe066', '#69db7c', '#4dabf7', '#9775fa'];
    ctx.globalAlpha = 0.32;
    ctx.lineWidth = 16;
    cols.forEach((col, i) => {
      ctx.strokeStyle = col;
      ctx.beginPath();
      ctx.arc(W * 0.55, H * 0.95, 520 - i * 16, Math.PI * 1.08, Math.PI * 1.92);
      ctx.stroke();
    });
    ctx.globalAlpha = 1;
  }

  const cloudCount = { cloudy: 16, storm: 18, clear: 4, sunset: 6, sunrise: 5, pink: 7, bluehour: 3, night: 2, rainbow: 6 }[kind];
  const cloudColor = {
    storm: 'rgba(70,76,86,.75)',
    cloudy: 'rgba(250,251,253,.8)',
    sunset: 'rgba(255,190,170,.6)',
    sunrise: 'rgba(255,225,215,.6)',
    pink: 'rgba(255,210,230,.65)',
    night: 'rgba(80,90,140,.35)',
    bluehour: 'rgba(150,160,210,.35)',
  }[kind] || 'rgba(255,255,255,.75)';
  for (let i = 0; i < cloudCount; i++) {
    cloud(ctx, rand() * W, H * (0.08 + rand() * 0.6), 60 + rand() * 90, cloudColor, rand);
  }

  // Rooftops and a few trees along the bottom, like a phone held up from the street.
  const dark = kind === 'night' ? '#04060e' : kind === 'bluehour' ? '#0b1230' : 'rgba(24,26,48,.9)';
  ctx.fillStyle = dark;
  let x = 0;
  const base = H * 0.9;
  ctx.beginPath();
  ctx.moveTo(0, H);
  while (x < W) {
    const bw = 40 + rand() * 90;
    const bh = 20 + rand() * 90;
    ctx.lineTo(x, base - bh);
    ctx.lineTo(x + bw, base - bh);
    x += bw;
  }
  ctx.lineTo(W, H);
  ctx.closePath();
  ctx.fill();
  for (let i = 0; i < 3; i++) {
    const tx = rand() * W;
    ctx.beginPath();
    ctx.arc(tx, base - 40 - rand() * 30, 30 + rand() * 25, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillRect(0, base, W, H - base);

  return new Promise((resolve) => c.toBlob(resolve, 'image/jpeg', 0.86));
}
