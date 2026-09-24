// Solar and lunar ephemeris for the site, plus Pacific-time helpers.
// Sun: NOAA general solar position algorithm (≈0.01° accuracy) with refraction.
// Moon: low-precision Meeus series (≈0.3°), enough for placement and phase.

const D2R = Math.PI / 180, R2D = 180 / Math.PI;

function julianDay(date) { return date.getTime() / 86400000 + 2440587.5; }

export function sunPosition(date, lat, lon) {
  const jd = julianDay(date);
  const T = (jd - 2451545.0) / 36525;
  const L0 = (280.46646 + T * (36000.76983 + T * 0.0003032)) % 360;
  const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
  const Mr = M * D2R;
  const C = Math.sin(Mr) * (1.914602 - T * (0.004817 + 0.000014 * T)) +
    Math.sin(2 * Mr) * (0.019993 - 0.000101 * T) + Math.sin(3 * Mr) * 0.000289;
  const trueLong = L0 + C;
  const omega = 125.04 - 1934.136 * T;
  const lambda = trueLong - 0.00569 - 0.00478 * Math.sin(omega * D2R);
  const eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
  const eps = eps0 + 0.00256 * Math.cos(omega * D2R);
  const decl = Math.asin(Math.sin(eps * D2R) * Math.sin(lambda * D2R));
  const y = Math.tan(eps * D2R / 2) ** 2;
  const L0r = L0 * D2R;
  const eqTime = 4 * R2D * (y * Math.sin(2 * L0r) - 2 * e * Math.sin(Mr) +
    4 * e * y * Math.sin(Mr) * Math.cos(2 * L0r) - 0.5 * y * y * Math.sin(4 * L0r) -
    1.25 * e * e * Math.sin(2 * Mr)); // minutes
  const utcMin = date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60 + date.getUTCMilliseconds() / 60000;
  let tst = (utcMin + eqTime + 4 * lon) % 1440;
  if (tst < 0) tst += 1440;
  let ha = tst / 4 - 180;
  const latr = lat * D2R, har = ha * D2R;
  const cosZ = Math.sin(latr) * Math.sin(decl) + Math.cos(latr) * Math.cos(decl) * Math.cos(har);
  const zen = Math.acos(Math.min(1, Math.max(-1, cosZ)));
  let elev = 90 - zen * R2D;
  // atmospheric refraction (NOAA)
  let refr = 0;
  if (elev > 85) refr = 0;
  else if (elev > 5) { const t = Math.tan(elev * D2R); refr = 58.1 / t - 0.07 / t ** 3 + 0.000086 / t ** 5; }
  else if (elev > -0.575) refr = 1735 + elev * (-518.2 + elev * (103.4 + elev * (-12.79 + elev * 0.711)));
  else refr = -20.772 / Math.tan(elev * D2R);
  elev += refr / 3600;
  let az = Math.atan2(Math.sin(har), Math.cos(har) * Math.sin(latr) - Math.tan(decl) * Math.cos(latr)) * R2D + 180;
  az = (az + 360) % 360;
  return { azimuth: az, elevation: elev, declination: decl * R2D, eqTime };
}

export function moonPosition(date, lat, lon) {
  const d = julianDay(date) - 2451545.0;
  const L = (218.316 + 13.176396 * d) * D2R;
  const M = (134.963 + 13.064993 * d) * D2R;
  const F = (93.272 + 13.229350 * d) * D2R;
  const lng = L + 6.289 * D2R * Math.sin(M);
  const bet = 5.128 * D2R * Math.sin(F);
  const e = 23.4397 * D2R;
  const ra = Math.atan2(Math.sin(lng) * Math.cos(e) - Math.tan(bet) * Math.sin(e), Math.cos(lng));
  const dec = Math.asin(Math.sin(bet) * Math.cos(e) + Math.cos(bet) * Math.sin(e) * Math.sin(lng));
  const lst = (280.16 + 360.9856235 * d) * D2R + lon * D2R;
  const H = lst - ra, phi = lat * D2R;
  const alt = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
  const azS = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi));
  return { azimuth: (azS * R2D + 180 + 360) % 360, elevation: alt * R2D };
}

// Direction vector in scene space (x east, y up, z south) from az/el in degrees.
export function dirFromAzEl(az, el, out) {
  const a = az * D2R, e = el * D2R;
  out.set(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e));
  return out;
}

// Direct-beam colour/strength after passing through the atmosphere, using
// Kasten–Young air mass with Rayleigh + aerosol optical depths for a clear,
// slightly hazy coastal sky. Returns linear RGB (roughly 1.0 at zenith sun).
export function sunTransmittance(elevDeg, turbidity = 2.6) {
  const el = Math.max(elevDeg, -2);
  if (el <= -1.5) return [0, 0, 0];
  const z = (90 - Math.max(el, -0.8)) ;
  const am = 1 / (Math.cos(z * D2R) + 0.50572 * Math.pow(96.07995 - z, -1.6364));
  const lam = [0.680, 0.550, 0.440]; // µm
  const beta = 0.04608 * turbidity - 0.04586; // Ångström turbidity
  const out = [];
  for (let i = 0; i < 3; i++) {
    const tauR = 0.008735 * Math.pow(lam[i], -4.08);
    const tauA = beta * Math.pow(lam[i], -1.3);
    const tauO = [0.02, 0.035, 0.005][i];
    out.push(Math.exp(-(tauR + tauA + tauO) * am));
  }
  const fade = el < 0 ? Math.max(0, 1 + el / 1.5) : 1;
  return out.map((v) => v * fade);
}

// ---- Pacific time helpers ------------------------------------------------
const TZ = 'America/Los_Angeles';
const fmt = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
});
function tzOffsetMinutes(date) {
  const p = Object.fromEntries(fmt.formatToParts(date).map((x) => [x.type, x.value]));
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
  return (asUTC - date.getTime()) / 60000;
}
// y, m (1-12), d, minutes after local midnight -> Date (UTC instant)
export function pacificToDate(y, m, d, minutes) {
  const guess = Date.UTC(y, m - 1, d, 0, 0, 0) + minutes * 60000;
  let off = tzOffsetMinutes(new Date(guess + 8 * 3600000));
  let t = guess - off * 60000;
  const off2 = tzOffsetMinutes(new Date(t));
  if (off2 !== off) t = guess - off2 * 60000;
  return new Date(t);
}
export function pacificParts(date) {
  const p = Object.fromEntries(fmt.formatToParts(date).map((x) => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, minutes: (+p.hour % 24) * 60 + +p.minute + +p.second / 60 };
}
export function tzAbbrev(date) {
  return tzOffsetMinutes(date) === -420 ? 'PDT' : 'PST';
}

// Find local-minute times of sunrise/sunset/civil twilight/solar noon for a day.
export function dayEvents(y, m, d, lat, lon) {
  const samples = [];
  for (let min = 0; min <= 1440; min += 2) samples.push([min, sunPosition(pacificToDate(y, m, d, min), lat, lon).elevation]);
  const cross = (thr, rising) => {
    for (let i = 1; i < samples.length; i++) {
      const [m0, e0] = samples[i - 1], [m1, e1] = samples[i];
      if (rising ? (e0 < thr && e1 >= thr) : (e0 >= thr && e1 < thr)) return m0 + (thr - e0) / (e1 - e0) * (m1 - m0);
    }
    return null;
  };
  let noon = 0, best = -99;
  for (const [mm, e] of samples) if (e > best) { best = e; noon = mm; }
  return {
    civilDawn: cross(-6, true), sunrise: cross(-0.833, true), goldenAmEnd: cross(6, true),
    noon, maxElevation: best,
    goldenPmStart: cross(6, false), sunset: cross(-0.833, false), civilDusk: cross(-6, false),
    samples,
  };
}
