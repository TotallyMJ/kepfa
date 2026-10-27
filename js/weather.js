// The sky outside right now, painted: the sun's phase from sun.js and the weather from Open-Meteo (free, no key).
// Only a rounded location (about 10 km) leaves the device, and the answer is kept for half an hour.

import { sunTimes } from './sun.js';

const KEY = 'kepfa.weather';
const FRESH_MS = 30 * 60e3;

/** dawn, golden, day, dusk or night, from where the sun is at `now`. */
export function sunPhase(now, place) {
  const sun = sunTimes(now, place.lat, place.lon);
  if (!sun) return 'day';
  const t = now.getTime();
  const near = 40 * 60e3;
  if (t < sun.sunrise - near || t >= sun.sunset.getTime() + near) return 'night';
  if (t < sun.sunrise) return 'dawn';
  if (t >= sun.sunset) return 'dusk';
  if (now < sun.goldenMorningEnd || now >= sun.goldenEveningStart) return 'golden';
  return 'day';
}

/** WMO weather code → the kind of sky we paint. */
export function skyKind(code) {
  if (code == null || code === 0) return 'clear';
  if (code <= 2) return 'partly';
  if (code === 3) return 'cloudy';
  if (code === 45 || code === 48) return 'fog';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code >= 95) return 'storm';
  return 'rain';
}

const round = (n) => Math.round(n * 10) / 10;
const fahrenheit = () => /-US$/.test(navigator.language || '');

function cached(place) {
  try {
    const w = JSON.parse(localStorage.getItem(KEY));
    if (w && w.lat === round(place.lat) && w.lon === round(place.lon)) return w;
  } catch { /* nothing kept */ }
  return null;
}

/** The last weather we know for this place (any age), so the sky paints at once; null before the first fetch. */
export const lastWeather = (place) => cached(place);

/** Current weather for `place`, from the half-hour cache or the network; null when offline or it fails. */
export async function currentWeather(place) {
  const old = cached(place);
  if (old && Date.now() - old.at < FRESH_MS) return old;
  const lat = round(place.lat), lon = round(place.lon);
  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}`
      + `&current=weather_code,temperature_2m${fahrenheit() ? '&temperature_unit=fahrenheit' : ''}`);
    if (!res.ok) return old;
    const { current } = await res.json();
    const w = { at: Date.now(), lat, lon, code: current.weather_code, temp: Math.round(current.temperature_2m) };
    try { localStorage.setItem(KEY, JSON.stringify(w)); } catch { /* paints again next time */ }
    return w;
  } catch {
    return old;
  }
}

const CLOUDS = { clear: 0, partly: 3, cloudy: 6, fog: 2, rain: 6, storm: 6, snow: 5 };

/** The painted layers; the look lives in CSS under .sky-paint.is-<phase>.is-<kind>. */
export function skyLayers(kind) {
  return `<i class="sky-sun"></i><i class="sky-stars"></i>
    ${Array.from({ length: CLOUDS[kind] }, (_, i) => `<i class="sky-cloud c${i + 1}"></i>`).join('')}
    ${kind === 'rain' || kind === 'storm' ? '<i class="sky-rain"></i><i class="sky-rain far"></i>' : ''}
    ${kind === 'snow' ? '<i class="sky-snow"></i><i class="sky-snow far"></i>' : ''}
    ${kind === 'fog' ? '<i class="sky-fog"></i><i class="sky-fog low"></i>' : ''}
    ${kind === 'storm' ? '<i class="sky-flash"></i>' : ''}
    <i class="sky-grain"></i>`;
}
