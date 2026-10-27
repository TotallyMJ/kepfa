// Sunrise, sunset and golden hour from latitude/longitude, computed on the device (NOAA approximation).

const RAD = Math.PI / 180;

/** Times for the local calendar day of `date`. Returns null near the poles when the sun doesn't cross the needed altitude. */
export function sunTimes(date, lat, lon) {
  const dayUtc = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const n = Math.round((dayUtc - Date.UTC(date.getFullYear(), 0, 0)) / 864e5);
  const g = ((2 * Math.PI) / 365) * (n - 1);
  const eqTime = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g)
    - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
  const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g)
    + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const noon = 720 - 4 * lon - eqTime;

  const at = (altitude) => {
    const c = (Math.sin(altitude * RAD) - Math.sin(lat * RAD) * Math.sin(decl)) / (Math.cos(lat * RAD) * Math.cos(decl));
    if (c < -1 || c > 1) return null;
    const ha = Math.acos(c) / RAD;
    return [new Date(dayUtc + (noon - 4 * ha) * 60000), new Date(dayUtc + (noon + 4 * ha) * 60000)];
  };
  const horizon = at(-0.833);
  const golden = at(6);
  if (!horizon || !golden) return null;
  return { sunrise: horizon[0], sunset: horizon[1], goldenMorningEnd: golden[0], goldenEveningStart: golden[1] };
}

// A city for the phone's time zone, so sun times are close before anyone shares a location.
export const CITIES = {
  'Asia/Bangkok': ['Bangkok', 13.75, 100.5], 'Asia/Ho_Chi_Minh': ['Ho Chi Minh City', 10.8, 106.7], 'Asia/Saigon': ['Ho Chi Minh City', 10.8, 106.7],
  'Asia/Vientiane': ['Vientiane', 17.97, 102.6], 'Asia/Phnom_Penh': ['Phnom Penh', 11.55, 104.9], 'Asia/Yangon': ['Yangon', 16.8, 96.15],
  'Asia/Jakarta': ['Jakarta', -6.2, 106.8], 'Asia/Singapore': ['Singapore', 1.35, 103.8], 'Asia/Kuala_Lumpur': ['Kuala Lumpur', 3.14, 101.7],
  'Asia/Manila': ['Manila', 14.6, 121], 'Asia/Hong_Kong': ['Hong Kong', 22.3, 114.2], 'Asia/Shanghai': ['Shanghai', 31.2, 121.5],
  'Asia/Taipei': ['Taipei', 25.03, 121.5], 'Asia/Seoul': ['Seoul', 37.57, 126.98], 'Asia/Tokyo': ['Tokyo', 35.68, 139.69],
  'Asia/Kolkata': ['Kolkata', 22.57, 88.36], 'Asia/Calcutta': ['Kolkata', 22.57, 88.36], 'Asia/Dhaka': ['Dhaka', 23.8, 90.4],
  'Asia/Kathmandu': ['Kathmandu', 27.7, 85.3], 'Asia/Karachi': ['Karachi', 24.86, 67], 'Asia/Dubai': ['Dubai', 25.2, 55.27],
  'Europe/London': ['London', 51.5, -0.13], 'Europe/Paris': ['Paris', 48.86, 2.35], 'Europe/Berlin': ['Berlin', 52.52, 13.4],
  'Europe/Madrid': ['Madrid', 40.4, -3.7], 'Europe/Rome': ['Rome', 41.9, 12.5], 'Europe/Amsterdam': ['Amsterdam', 52.37, 4.9],
  'Europe/Stockholm': ['Stockholm', 59.33, 18.07], 'Europe/Istanbul': ['Istanbul', 41, 28.98], 'Europe/Moscow': ['Moscow', 55.75, 37.6],
  'Africa/Cairo': ['Cairo', 30.04, 31.24], 'Africa/Lagos': ['Lagos', 6.5, 3.4], 'Africa/Nairobi': ['Nairobi', -1.29, 36.8],
  'Africa/Johannesburg': ['Johannesburg', -26.2, 28.05], 'America/New_York': ['New York', 40.71, -74], 'America/Toronto': ['Toronto', 43.65, -79.38],
  'America/Chicago': ['Chicago', 41.88, -87.63], 'America/Denver': ['Denver', 39.74, -104.99], 'America/Los_Angeles': ['Los Angeles', 34.05, -118.24],
  'America/Vancouver': ['Vancouver', 49.28, -123.12], 'America/Mexico_City': ['Mexico City', 19.43, -99.13], 'America/Bogota': ['Bogotá', 4.71, -74.07],
  'America/Lima': ['Lima', -12.05, -77.04], 'America/Sao_Paulo': ['São Paulo', -23.55, -46.63], 'America/Argentina/Buenos_Aires': ['Buenos Aires', -34.6, -58.38],
  'Pacific/Honolulu': ['Honolulu', 21.3, -157.86], 'Australia/Perth': ['Perth', -31.95, 115.86], 'Australia/Brisbane': ['Brisbane', -27.47, 153.03],
  'Australia/Sydney': ['Sydney', -33.87, 151.21], 'Australia/Melbourne': ['Melbourne', -37.81, 144.96], 'Pacific/Auckland': ['Auckland', -36.85, 174.76],
};

/** { name, lat, lon } for the device's time zone. Unknown zones take their own name and a longitude from the UTC offset. */
export function guessPlace() {
  let zone = '';
  try { zone = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch { /* no Intl zone */ }
  const hit = CITIES[zone];
  if (hit) return { name: hit[0], lat: hit[1], lon: hit[2] };
  const name = zone.includes('/') ? zone.split('/').pop().replace(/_/g, ' ') : '';
  return { name, lat: 20, lon: (-new Date().getTimezoneOffset() / 60) * 15, rough: true };
}
