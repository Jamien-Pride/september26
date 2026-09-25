import { sunPosition, pacificToDate, dayEvents } from '../js/sun.js';
const LAT = 37.81958, LON = -122.37321, FACE = 229.4;
for (const [m, d, n] of [[3, 20, 'Mar equinox'], [6, 21, 'Jun solstice'], [9, 22, 'Sep equinox'], [12, 21, 'Dec solstice']]) {
  const ev = dayEvents(2026, m, d, LAT, LON);
  const at = (min) => sunPosition(pacificToDate(2026, m, d, min), LAT, LON);
  const f = (x) => `${Math.floor(x / 60)}:${String(Math.round(x % 60)).padStart(2, '0')}`;
  console.log(n, 'sunrise', f(ev.sunrise), at(ev.sunrise).azimuth.toFixed(1), 'noon', f(ev.noon), ev.maxElevation.toFixed(1), 'sunset', f(ev.sunset), at(ev.sunset).azimuth.toFixed(1));
}
// Annual hours the sun is within 45° of the mouth axis (sun "in the mouth"), and above 0°
let hrs = 0, low = 0, byMonth = Array(12).fill(0);
for (let day = 0; day < 365; day++) {
  const dt = new Date(Date.UTC(2026, 0, 1 + day));
  const y = dt.getUTCFullYear(), m = dt.getUTCMonth() + 1, d = dt.getUTCDate();
  for (let min = 0; min < 1440; min += 10) {
    const s = sunPosition(pacificToDate(y, m, d, min), LAT, LON);
    if (s.elevation <= 0) continue;
    const r = Math.PI / 180;
    const sx = Math.sin(s.azimuth * r) * Math.cos(s.elevation * r), sz = Math.cos(s.azimuth * r) * Math.cos(s.elevation * r), sy = Math.sin(s.elevation * r);
    const ax = Math.sin(FACE * r), az = Math.cos(FACE * r);
    const cosang = sx * ax + sz * az; // angle between sun and horizontal mouth axis
    if (cosang > Math.cos(45 * r)) { hrs += 1 / 6; byMonth[m - 1] += 1 / 6; if (s.elevation < 15) low += 1 / 6; }
  }
}
console.log('hours/yr sun within 45deg of mouth axis', hrs.toFixed(0), 'of which sun below 15deg', low.toFixed(0));
console.log('by month', byMonth.map((h) => h.toFixed(0)).join(' '));
