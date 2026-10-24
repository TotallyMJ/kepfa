// Everything about a single sky photo: palette extraction and resizing.

// ---------- color helpers ----------

export function hex([r, g, b]) {
  return '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
}

export function hexToRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
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

// ---------- image prep ----------

export async function loadImage(blob) {
  const url = URL.createObjectURL(blob);
  const img = new Image();
  // onload rather than img.decode(): decode() can stall while the page isn't being painted.
  try {
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error('Image could not be decoded'));
      img.src = url;
    });
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
