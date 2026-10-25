// Stamps: small wins collected from the skies kept on this device. Each one is a rule that counts skies;
// once a count reaches its number the stamp is earned and remembered, even if those skies are deleted later.

import { sunTimes } from './sun.js';
import { CHALLENGE_SIZE } from './strings.js';

const KEY = 'kepfa.stamps';
const DAY = 864e5;

/** Hue (0-360), saturation and value (0-1) of an [r, g, b]. */
function hsv([r, g, b]) {
  const max = Math.max(r, g, b) / 255, min = Math.min(r, g, b) / 255, d = max - min;
  let h = 0;
  if (d) {
    if (max === r / 255) h = ((g - b) / 255 / d) % 6;
    else if (max === g / 255) h = (b - r) / 255 / d + 2;
    else h = (r - g) / 255 / d + 4;
  }
  return { h: (h * 60 + 360) % 360, s: max ? d / max : 0, v: max };
}

/** How much of a sky's palette (the frame minus its skyline) matches a test of hue, saturation and value. */
const share = (sky, test) => (sky.palette || []).reduce((sum, c) => sum + (test(hsv(c.rgb)) ? c.weight : 0), 0);

// Warm light covers part of the frame; blue fills most of it; pink and violet only need a patch.
const isOrange = (s) => share(s, ({ h, s: sat, v }) => h <= 48 && sat >= 0.35 && v >= 0.45) >= 0.15;
const isBlue = (s) => share(s, ({ h, s: sat, v }) => h >= 185 && h <= 235 && sat >= 0.22 && v >= 0.45) >= 0.5;
const isCandy = (s) => share(s, ({ h, s: sat, v }) => h >= 260 && sat >= 0.15 && v >= 0.45) >= 0.15;
// Grey: washed-out or heavy, dim slate over most of the frame (a storm is still bluish). Night skies are dark for another reason.
const isGrey = (s, place) => sunPart(s, place) !== 'night'
  && share(s, ({ s: sat, v }) => v >= 0.2 && (sat < 0.18 || (v < 0.5 && sat < 0.55))) >= 0.6;

const placeOf = (s) => (s.place || '').trim().toLowerCase();

/** The longest run of calendar days in a row with at least one sky. */
function bestStreak(skies) {
  const days = [...new Set(skies.map((s) => new Date(s.takenAt).toDateString()))].map((d) => new Date(d).getTime()).sort((a, b) => a - b);
  let best = 0, run = 0;
  days.forEach((d, i) => { run = i && Math.round((d - days[i - 1]) / DAY) === 1 ? run + 1 : 1; best = Math.max(best, run); });
  return best;
}

/** Where the sun was for this sky: 'rise' near sunrise, 'night' once the dusk after sunset has gone, or ''. */
function sunPart(sky, place) {
  const at = new Date(sky.takenAt);
  const sun = sunTimes(at, place.lat, place.lon);
  if (!sun) return '';
  const t = at.getTime(), rise = sun.sunrise.getTime();
  if (t >= rise - 30 * 60000 && t <= rise + 60 * 60000) return 'rise';
  if (t > sun.sunset.getTime() + 20 * 60000 || t < rise - 30 * 60000) return 'night';
  return '';
}

/** The most prompt days kept within one themed month. */
function bestThemeMonth(skies, hasTheme) {
  const months = new Map();
  for (const s of skies) {
    if (!s.prompt) continue;
    const [y, m] = s.prompt.split('-').map(Number);
    if (!hasTheme(y, m - 1)) continue;
    const k = `${y}-${m}`;
    if (!months.has(k)) months.set(k, new Set());
    months.get(k).add(s.prompt);
  }
  return Math.max(0, ...[...months.values()].map((d) => d.size));
}

const count = (skies, test) => skies.filter(test).length;
const mostOfOnePlace = (skies) => {
  const n = new Map();
  for (const s of skies) if (placeOf(s)) n.set(placeOf(s), (n.get(placeOf(s)) || 0) + 1);
  return Math.max(0, ...n.values());
};

/** The 15 stamps, in album order. `count(skies, ctx)` says how far along it is; `need` is the number to reach. */
export const STAMPS = [
  { id: 'first', need: 1, count: (sk) => sk.length },
  { id: 'week', need: 7, count: (sk) => bestStreak(sk) },
  { id: 'thirty', need: CHALLENGE_SIZE, count: (sk) => new Set(sk.filter((s) => s.prompt).map((s) => s.prompt)).size },
  { id: 'orange', need: 5, count: (sk) => count(sk, isOrange) },
  { id: 'blue', need: 7, count: (sk) => count(sk, isBlue) },
  { id: 'candy', need: 3, count: (sk) => count(sk, isCandy) },
  { id: 'grey', need: 3, count: (sk, ctx) => count(sk, (s) => isGrey(s, ctx.place)) },
  { id: 'early', need: 3, count: (sk, ctx) => count(sk, (s) => sunPart(s, ctx.place) === 'rise') },
  { id: 'owl', need: 3, count: (sk, ctx) => count(sk, (s) => sunPart(s, ctx.place) === 'night') },
  { id: 'poet', need: 7, count: (sk) => count(sk, (s) => (s.note || '').trim()) },
  { id: 'wanderer', need: 3, count: (sk) => new Set(sk.map(placeOf).filter(Boolean)).size },
  { id: 'home', need: 7, count: (sk) => mostOfOnePlace(sk) },
  { id: 'moving', need: 3, count: (sk) => count(sk, (s) => s.live) },
  { id: 'me', need: 3, count: (sk) => count(sk, (s) => s.front) },
  { id: 'theme', need: 7, count: (sk, ctx) => bestThemeMonth(sk, ctx.hasTheme) },
];

/** Stamps earned so far: { id: { at, sky } }, or null before the first check on this device. */
function earned() {
  try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; }
}

/** The sky that first brought a stamp to its number, replaying the skies in the order they were taken. */
function earningSky(stamp, skies, ctx) {
  const sorted = skies.slice().sort((a, b) => a.takenAt - b.takenAt);
  for (let i = 1; i <= sorted.length; i++) if (stamp.count(sorted.slice(0, i), ctx) >= stamp.need) return sorted[i - 1];
  return sorted[sorted.length - 1];
}

/**
 * Brings the album up to date with the skies kept (samples don't count) and returns the ids of stamps just earned.
 * The very first check on a device files what's already earned quietly, so nobody gets a pile of stamps at once.
 */
export function checkStamps(allSkies, ctx) {
  const skies = allSkies.filter((s) => !s.sample);
  const had = earned();
  const book = had || {};
  const fresh = [];
  for (const st of STAMPS) {
    if (book[st.id] || st.count(skies, ctx) < st.need) continue;
    const sky = earningSky(st, skies, ctx);
    book[st.id] = { at: had ? Date.now() : sky.takenAt, sky: sky.id };
    fresh.push(st.id);
  }
  try { localStorage.setItem(KEY, JSON.stringify(book)); } catch { /* stamps are counted again next time */ }
  return had ? fresh : [];
}

/** Keeps what the owner wrote on a stamp's postcard ({ card, to }), next to when it was earned. */
export function writeCard(id, words) {
  const book = earned();
  if (!book?.[id]) return;
  book[id] = { ...book[id], ...words };
  try { localStorage.setItem(KEY, JSON.stringify(book)); } catch { /* the default words show again */ }
}

/** Every stamp with where it stands: earned (when, and with which sky) or how far along. */
export function album(allSkies, ctx) {
  const skies = allSkies.filter((s) => !s.sample);
  const book = earned() || {};
  return STAMPS.map((st) => ({ ...st, got: book[st.id] || null, have: Math.min(st.count(skies, ctx), st.need) }));
}
