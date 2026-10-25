// A broad place name for a position, worked out on the device: the nearest Thai province (by its capital),
// else the nearest big city from sun.js. Coordinates never leave the phone, so it's approximate near borders.

import { CITIES } from './sun.js';

// [name, lat, lon]. Bangkok is large, so it has a few points of its own; so do towns far from their capital (Hua Hin, Pak Chong).
const PROVINCES = [
  ['Prachuap Khiri Khan', 12.57, 99.96], ['Nakhon Ratchasima', 14.71, 101.42],
  ['Bangkok', 13.75, 100.5], ['Bangkok', 13.67, 100.62], ['Bangkok', 13.72, 100.75], ['Bangkok', 13.81, 100.73],
  ['Bangkok', 13.87, 100.6], ['Bangkok', 13.91, 100.59], ['Bangkok', 13.72, 100.48], ['Bangkok', 13.62, 100.43], ['Bangkok', 13.78, 100.42],
  ['Amnat Charoen', 15.86, 104.63], ['Ang Thong', 14.59, 100.45], ['Ayutthaya', 14.35, 100.57], ['Bueng Kan', 18.36, 103.65],
  ['Buriram', 14.99, 103.1], ['Chachoengsao', 13.69, 101.07], ['Chai Nat', 15.19, 100.12], ['Chaiyaphum', 15.81, 102.03],
  ['Chanthaburi', 12.61, 102.1], ['Chiang Mai', 18.79, 98.98], ['Chiang Rai', 19.91, 99.83], ['Chonburi', 13.36, 100.98],
  ['Chumphon', 10.49, 99.18], ['Kalasin', 16.43, 103.51], ['Kamphaeng Phet', 16.48, 99.52], ['Kanchanaburi', 14.02, 99.53],
  ['Khon Kaen', 16.43, 102.83], ['Krabi', 8.09, 98.91], ['Lampang', 18.29, 99.49], ['Lamphun', 18.58, 99.01],
  ['Loei', 17.49, 101.72], ['Lopburi', 14.8, 100.65], ['Mae Hong Son', 19.3, 97.97], ['Maha Sarakham', 16.18, 103.3],
  ['Mukdahan', 16.54, 104.72], ['Nakhon Nayok', 14.2, 101.21], ['Nakhon Pathom', 13.82, 100.06], ['Nakhon Phanom', 17.41, 104.78],
  ['Nakhon Ratchasima', 14.97, 102.1], ['Nakhon Sawan', 15.7, 100.14], ['Nakhon Si Thammarat', 8.43, 99.96], ['Nan', 18.78, 100.78],
  ['Narathiwat', 6.43, 101.82], ['Nong Bua Lamphu', 17.2, 102.44], ['Nong Khai', 17.88, 102.74], ['Nonthaburi', 13.86, 100.52],
  ['Pathum Thani', 14.02, 100.53], ['Pattani', 6.87, 101.25], ['Phang Nga', 8.45, 98.53], ['Phatthalung', 7.62, 100.08],
  ['Phayao', 19.17, 99.9], ['Phetchabun', 16.42, 101.16], ['Phetchaburi', 13.11, 99.94], ['Phichit', 16.44, 100.35],
  ['Phitsanulok', 16.82, 100.26], ['Phrae', 18.14, 100.14], ['Phuket', 7.88, 98.39], ['Prachinburi', 14.05, 101.37],
  ['Prachuap Khiri Khan', 11.81, 99.8], ['Ranong', 9.96, 98.64], ['Ratchaburi', 13.54, 99.82], ['Rayong', 12.68, 101.28],
  ['Roi Et', 16.05, 103.65], ['Sa Kaeo', 13.82, 102.07], ['Sakon Nakhon', 17.16, 104.15], ['Samut Prakan', 13.6, 100.6],
  ['Samut Sakhon', 13.55, 100.27], ['Samut Songkhram', 13.41, 100], ['Saraburi', 14.53, 100.91], ['Satun', 6.62, 100.07],
  ['Sing Buri', 14.89, 100.4], ['Sisaket', 15.12, 104.32], ['Songkhla', 7.19, 100.6], ['Sukhothai', 17.01, 99.82],
  ['Suphan Buri', 14.47, 100.12], ['Surat Thani', 9.14, 99.33], ['Surin', 14.88, 103.49], ['Tak', 16.88, 99.13],
  ['Trang', 7.56, 99.61], ['Trat', 12.24, 102.52], ['Ubon Ratchathani', 15.24, 104.85], ['Udon Thani', 17.41, 102.79],
  ['Uthai Thani', 15.38, 100.02], ['Uttaradit', 17.62, 100.1], ['Yala', 6.54, 101.28], ['Yasothon', 15.79, 104.15],
];

/** Kilometres between two points (haversine). */
function km(lat1, lon1, lat2, lon2) {
  const r = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * r) / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(a));
}

const nearest = (list, lat, lon) => list.reduce((best, [name, la, lo]) => {
  const d = km(lat, lon, la, lo);
  return d < best.d ? { name, d } : best;
}, { name: '', d: Infinity });

/** "Chiang Mai", "Tokyo", or '' when nothing on the lists is near enough to be honest about. */
export function placeNear(lat, lon) {
  const province = nearest(PROVINCES, lat, lon);
  if (province.d < 120) return province.name;
  const city = nearest(Object.values(CITIES), lat, lon);
  return city.d < 50 ? city.name : '';
}
