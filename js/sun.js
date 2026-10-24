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
