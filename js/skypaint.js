// The sky behind today's jar, painted on a canvas: the light from the sun's phase, the weather from its kind.
// Soft cumulus from layered noise (lit on top, shaded underneath), the real moon phase at night, falling rain or
// snow, drifting fog, then film grain and a faint vignette, so it reads as a print rather than a gradient.

const PHASES = {
  //        sky top → bottom                                   horizon glow       cloud lit / shade
  dawn:   { sky: ['#27325f', '#6f6799', '#d99ea0', '#f6cfad'], glow: '#ffd2a8', lit: '#fbe1d6', shade: '#8a82a6' },
  day:    { sky: ['#2c5fa8', '#5a8fd0', '#a6c9e8', '#e1edf6'], glow: '#ffffff', lit: '#ffffff', shade: '#b4c3d8' },
  golden: { sky: ['#4a5a9c', '#9d82b0', '#eb9d87', '#fbd39b'], glow: '#ffd89c', lit: '#ffe5cc', shade: '#a6879f' },
  dusk:   { sky: ['#171f4c', '#463e76', '#a8678a', '#ee9f7d'], glow: '#f7a27c', lit: '#e9a79b', shade: '#4a4474' },
  night:  { sky: ['#060b20', '#101a40', '#1f2c5a', '#313f6c'], glow: '#4a5a8c', lit: '#46517e', shade: '#141b38' },
};

// How each kind of weather greys the light, how much of the sky its clouds cover, and what falls.
const KINDS = {
  clear:  { grey: 0,   to: null,      cover: 0.12, soft: 1 },
  partly: { grey: 0,   to: null,      cover: 0.42, soft: 1 },
  cloudy: { grey: 0.5, to: '#9ba4b3', cover: 0.78, soft: 1.3, lit: '#f1f3f6', shade: '#8b94a4' },
  fog:    { grey: 0.6, to: '#d6dadf', cover: 0.55, soft: 2.2, lit: '#f4f5f6', shade: '#c3c8cf' },
  rain:   { grey: 0.6, to: '#68738a', cover: 0.85, soft: 1.4, lit: '#c8ced8', shade: '#5c6576' },
  storm:  { grey: 0.72, to: '#262b3d', cover: 0.92, soft: 1.3, lit: '#8a90a0', shade: '#272c3e' },
  snow:   { grey: 0.45, to: '#c6cfdc', cover: 0.75, soft: 1.5, lit: '#f6f8fb', shade: '#a9b3c2' },
};

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, k) => { const x = hex(a), y = hex(b); return `#${x.map((v, i) => Math.round(v + (y[i] - v) * k).toString(16).padStart(2, '0')).join('')}`; };
const rgb = (h, a = 1) => `rgba(${hex(h).join(',')},${a})`;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// A small seeded random, so the same day paints the same clouds and stars.
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = Math.imul(s ^ (s >>> 15), 2246822519) ^ Math.imul(s ^ (s >>> 13), 3266489917)) >>> 0) / 4294967296;
}

/** Value noise that wraps every `period` cells in x, so a cloud band can drift and loop without a seam. */
function makeNoise(seed, period) {
  const r = rng(seed);
  const n = 256, lat = new Float32Array(n * n);
  for (let i = 0; i < lat.length; i++) lat[i] = r();
  const at = (x, y) => lat[(((y % n) + n) % n) * n + (((x % period) + period) % period)];
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
}
function fbm(noise, x, y, octaves) {
  let sum = 0, amp = 0.55, f = 1;
  for (let o = 0; o < octaves; o++) { sum += amp * noise(x * f, y * f); amp *= 0.42; f *= 2; }
  return sum;   // each octave's lattice still wraps at `period`, and twice the frequency fits twice in it
}

/**
 * One band of clouds, twice as wide as the sky so it can drift and wrap: density from noise above a coverage
 * threshold, shaped to thin out toward the top, lit by comparing with the density a little toward the light.
 */
function cloudBand(w, h, { seed, cover, soft, lit, shade, scale, alpha, low, rising }) {
  const cw = Math.max(64, Math.round(w / 2)), ch = Math.max(32, Math.round(h / 2));
  const c = document.createElement('canvas');
  c.width = cw * 2; c.height = ch;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(c.width, ch);
  const period = 8;
  const noise = makeNoise(seed, period);
  const L = hex(lit), S = hex(shade);
  // A whole number of periods across the band, so it wraps without a seam; `scale` sets how fine the clouds are.
  const kx = (period * Math.max(1, Math.round(scale))) / c.width, ky = (period * scale * 1.6) / c.width;
  const cut = 0.72 - cover * 0.42, edge = 0.1 * soft;
  for (let y = 0; y < ch; y++) {
    const fy = y / ch;
    // Fair-weather clouds sit in the middle of the sky; heavy weather fills it from the top down.
    const shape = rising ? 0.35 + 0.75 * smooth(0.15, 0.85, fy)
      : low ? smooth(0.05, 0.4, fy) * (1 - smooth(0.8, 1, fy)) : 1 - 0.35 * smooth(0.6, 1, fy);
    for (let x = 0; x < c.width; x++) {
      const nx = x * kx, ny = y * ky;
      const n = fbm(noise, nx, ny, 4) * shape;
      const d = smooth(cut, cut + edge, n);
      if (d <= 0) continue;
      const above = fbm(noise, nx, ny - 0.18 * scale, 3) * shape;
      const light = Math.min(1, Math.max(0, 0.62 + (n - above) * 4 - fy * 0.3));
      const i = (y * c.width + x) * 4;
      img.data[i] = S[0] + (L[0] - S[0]) * light;
      img.data[i + 1] = S[1] + (L[1] - S[1]) * light;
      img.data[i + 2] = S[2] + (L[2] - S[2]) * light;
      img.data[i + 3] = 255 * d * alpha;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** The moon's age as a fraction of its cycle (0 new, 0.5 full), from a known new moon. */
export function moonPhase(date) {
  const synodic = 29.530588853;
  const days = (date.getTime() - Date.UTC(2000, 0, 6, 18, 14)) / 864e5;
  return (((days / synodic) % 1) + 1) % 1;
}

function drawMoon(ctx, cx, cy, r, age) {
  // Glow first, then the dark disc, then the lit part bounded by the terminator ellipse.
  const g = ctx.createRadialGradient(cx, cy, r * 0.8, cx, cy, r * 4.2);
  g.addColorStop(0, 'rgba(220,228,255,.28)');
  g.addColorStop(1, 'rgba(220,228,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy, r * 4.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(40,48,80,.55)';
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
  const waxing = age < 0.5;
  const f = Math.cos(age * Math.PI * 2);   // 1 new, -1 full
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, -Math.PI / 2, Math.PI / 2, !waxing);
  // The terminator bows toward the lit edge for a crescent and away from it for a gibbous moon.
  ctx.ellipse(cx, cy, Math.abs(f) * r, r, 0, Math.PI / 2, -Math.PI / 2, waxing ? f > 0 : f < 0);
  ctx.closePath();
  const m = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
  m.addColorStop(0, '#fbf8ef');
  m.addColorStop(1, '#e3ddcc');
  ctx.fillStyle = m;
  ctx.fill();
  // A few soft maria.
  ctx.clip();
  ctx.fillStyle = 'rgba(160,150,130,.18)';
  [[-0.25, -0.2, 0.32], [0.2, 0.15, 0.24], [-0.05, 0.38, 0.18]].forEach(([dx, dy, s]) => {
    ctx.beginPath(); ctx.arc(cx + dx * r, cy + dy * r, s * r, 0, Math.PI * 2); ctx.fill();
  });
  ctx.restore();
}

function drawSun(ctx, w, h, phase, dim) {
  const at = { day: [0.76, 0.15, 0.065], golden: [0.8, 0.86, 0.1], dawn: [0.18, 1.02, 0.16], dusk: [0.82, 1.02, 0.16] }[phase];
  if (!at) return;
  const [fx, fy, fr] = at;
  const cx = w * fx, cy = h * fy, r = Math.min(w, h) * fr;
  const warm = phase === 'day' ? [255, 252, 238] : [255, 222, 170];
  ctx.save();
  ctx.globalAlpha = dim;
  ctx.globalCompositeOperation = 'screen';
  for (const [rr, a] of [[r * 9, 0.18], [r * 4, 0.3], [r * 1.8, 0.55]]) {
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rr);
    g.addColorStop(0, `rgba(${warm.join(',')},${a})`);
    g.addColorStop(1, `rgba(${warm.join(',')},0)`);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.fill();
  }
  if (phase === 'day' || phase === 'golden') {
    // The disc itself, with a soft rim; at golden hour it's half sunk in its own glow.
    ctx.globalCompositeOperation = 'source-over';
    const core = phase === 'day' ? '255,253,244' : '255,238,205';
    const d = ctx.createRadialGradient(cx, cy, r * 0.7, cx, cy, r * 1.15);
    d.addColorStop(0, `rgba(${core},${phase === 'day' ? 1 : 0.85})`);
    d.addColorStop(1, `rgba(${core},0)`);
    ctx.fillStyle = d;
    ctx.beginPath(); ctx.arc(cx, cy, r * 1.15, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function grainTile() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(128, 128);
  const r = rng(7);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 128 + (r() - 0.5) * 120;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/**
 * Paint the sky into `canvas` (sized to its box) and keep it gently alive: clouds drift, stars twinkle, rain and
 * snow fall, a storm flashes now and then. Still with reduced motion. Stops by itself once the canvas leaves the page.
 * @returns {{ stop(): void }}
 */
export function paintSky(canvas, { phase, kind, date = new Date(), still = false }) {
  const P = PHASES[phase] || PHASES.day;
  const K = KINDS[kind] || KINDS.clear;
  const night = phase === 'night';
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const box = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.round(box.width * dpr)), h = Math.max(1, Math.round(box.height * dpr));
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  const seed = Math.floor(date.getTime() / 864e5);
  const r = rng(seed * 31 + 3);

  // The still part: sky, horizon glow, sun or moon.
  const bg = document.createElement('canvas');
  bg.width = w; bg.height = h;
  const b = bg.getContext('2d');
  const grey = (c) => (K.to ? mix(c, night ? '#1a2036' : K.to, K.grey) : c);
  const sky = b.createLinearGradient(0, 0, 0, h);
  P.sky.forEach((c, i) => sky.addColorStop(i / (P.sky.length - 1), grey(c)));
  b.fillStyle = sky;
  b.fillRect(0, 0, w, h);
  const glow = b.createRadialGradient(w * 0.5, h * 1.15, 0, w * 0.5, h * 1.15, h * 0.9);
  glow.addColorStop(0, rgb(P.glow, K.to ? 0.12 : 0.38));
  glow.addColorStop(1, rgb(P.glow, 0));
  b.fillStyle = glow;
  b.fillRect(0, 0, w, h);
  const clearish = kind === 'clear' || kind === 'partly';
  if (night) {
    // Stars, most of them faint, a few bright; fewer near the horizon glow.
    const n = clearish ? 140 : 0;
    for (let i = 0; i < n; i++) {
      const x = r() * w, y = r() * h * 0.8, big = r() > 0.92;
      b.fillStyle = `rgba(255,255,255,${(big ? 0.9 : 0.25 + r() * 0.45) * (1 - y / h)})`;
      b.beginPath(); b.arc(x, y, (big ? 1.4 : 0.6 + r() * 0.5) * dpr, 0, Math.PI * 2); b.fill();
    }
    if (kind !== 'storm' && kind !== 'rain') drawMoon(b, w * 0.2, h * 0.17, Math.min(w, h) * 0.055, moonPhase(date));
  } else {
    drawSun(b, w, h, phase, clearish ? 1 : kind === 'fog' ? 0.5 : 0.22);
  }

  // Clouds: a high, faint band and a nearer, fuller one, drifting at different speeds.
  // Grey weather keeps a little of the hour's colour: warm at dawn, golden hour and dusk; dim and blue at night.
  const warm = phase === 'dawn' || phase === 'golden' || phase === 'dusk';
  const tint = (weather, hour, k) => (weather ? (warm ? mix(weather, hour, k) : weather) : hour);
  const lit = night ? mix(K.lit || P.lit, '#1d2546', 0.62) : tint(K.lit, P.lit, 0.4);
  const shade = night ? mix(K.shade || P.shade, '#0b1028', 0.55) : tint(K.shade, P.shade, 0.3);
  const fair = kind === 'clear' || kind === 'partly';
  const bands = [
    cloudBand(w, h, { seed: seed + 1, cover: K.cover * 0.8, soft: K.soft * 1.6, lit, shade: mix(shade, lit, 0.4), scale: 1.4, alpha: 0.55, low: fair }),
    cloudBand(w, h, { seed: seed + 2, cover: K.cover, soft: K.soft, lit, shade, scale: 0.9, alpha: kind === 'clear' ? 0.6 : 0.97, low: fair }),
  ];
  const fogLit = night ? '#3b4568' : warm ? mix('#f5f6f7', P.glow, 0.3) : '#f5f6f7';
  const fogShade = night ? '#283152' : warm ? mix('#dde0e4', P.shade, 0.3) : '#dde0e4';
  const fog = kind === 'fog' ? cloudBand(w, h, { seed: seed + 3, cover: 0.8, soft: 3, lit: fogLit, shade: fogShade, scale: 0.6, alpha: 0.9, rising: true }) : null;

  // What falls.
  const drops = (kind === 'rain' || kind === 'storm') ? Array.from({ length: kind === 'storm' ? 160 : 110 }, () => ({ x: r() * w, y: r() * h, z: 0.4 + r() * 0.6 })) : [];
  const flakes = kind === 'snow' ? Array.from({ length: 90 }, () => ({ x: r() * w, y: r() * h, z: 0.35 + r() * 0.65, p: r() * 6.28 })) : [];
  const twinkle = night && clearish ? Array.from({ length: 14 }, () => ({ x: r() * w, y: r() * h * 0.6, p: r() * 6.28 })) : [];

  const grain = grainTile();
  const pattern = ctx.createPattern(grain, 'repeat');
  const vignette = ctx.createRadialGradient(w / 2, h * 0.45, Math.min(w, h) * 0.35, w / 2, h * 0.5, Math.max(w, h) * 0.78);
  vignette.addColorStop(0, 'rgba(10,12,30,0)');
  vignette.addColorStop(1, `rgba(10,12,30,${night ? 0.35 : 0.18})`);

  let raf = 0, last = 0, flash = 0, nextFlash = 2500 + r() * 4000;
  const frame = (t) => {
    if (!canvas.isConnected) return;
    raf = requestAnimationFrame(frame);
    if (!still && t - last < 33) return;   // about 30 frames a second is plenty for weather
    const dt = last ? Math.min(100, t - last) : 16;
    last = t;
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.drawImage(bg, 0, 0);
    twinkle.forEach((s) => {
      ctx.fillStyle = `rgba(255,255,255,${0.35 + 0.45 * Math.sin(t / 900 + s.p) ** 2})`;
      ctx.beginPath(); ctx.arc(s.x, s.y, 1.1 * dpr, 0, Math.PI * 2); ctx.fill();
    });
    bands.forEach((band, i) => {
      const speed = (i ? 6 : 3) * dpr;   // px per second
      const off = ((t / 1000) * speed) % band.width;
      ctx.drawImage(band, -off, 0, band.width, h);
      ctx.drawImage(band, band.width - off, 0, band.width, h);
    });
    if (fog) {
      const off = ((t / 1000) * 4 * dpr) % fog.width;
      ctx.globalAlpha = 0.85;
      ctx.drawImage(fog, -off, 0, fog.width, h);
      ctx.drawImage(fog, fog.width - off, 0, fog.width, h);
      ctx.globalAlpha = 1;
    }
    if (drops.length) {
      ctx.strokeStyle = 'rgba(225,232,245,.5)';
      ctx.lineCap = 'round';
      drops.forEach((d) => {
        d.y += dt * 0.9 * d.z * dpr; d.x -= dt * 0.12 * d.z * dpr;
        if (d.y > h) { d.y = -20; d.x = Math.random() * w * 1.1; }
        ctx.globalAlpha = 0.25 + 0.5 * d.z;
        ctx.lineWidth = (0.6 + d.z * 0.6) * dpr;
        ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(d.x + 2.6 * d.z * dpr, d.y - 14 * d.z * dpr); ctx.stroke();
      });
      ctx.globalAlpha = 1;
    }
    flakes.forEach((f) => {
      f.y += dt * 0.05 * f.z * dpr; f.x += Math.sin(t / 1200 + f.p) * 0.25 * dpr;
      if (f.y > h) { f.y = -6; f.x = Math.random() * w; }
      ctx.fillStyle = `rgba(255,255,255,${0.5 + 0.5 * f.z})`;
      ctx.beginPath(); ctx.arc(f.x, f.y, (0.8 + f.z * 1.6) * dpr, 0, Math.PI * 2); ctx.fill();
    });
    if (kind === 'storm' && !still) {
      nextFlash -= dt;
      if (nextFlash < 0) { flash = 1; nextFlash = 3500 + Math.random() * 6000; }
      if (flash > 0) {
        ctx.fillStyle = `rgba(225,232,255,${flash * 0.55})`;
        ctx.fillRect(0, 0, w, h);
        flash = Math.max(0, flash - dt / 220);
      }
    }
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    if (still) cancelAnimationFrame(raf);
  };
  raf = requestAnimationFrame(frame);
  return { stop: () => cancelAnimationFrame(raf) };
}
