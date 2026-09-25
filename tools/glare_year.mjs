import * as THREE from 'three';
import { sunPosition, pacificToDate } from '../js/sun.js';
import { ReflectedLight } from '../js/caustics.js';
import { writeFileSync } from 'fs';
const LAT = 37.81958, LON = -122.37321, FACE = 229.4, R = Math.PI / 180;
// world->sculpture-local rotation (sculpture rotation.y = atan2(fx, fz))
const f = { x: Math.sin(FACE * R), z: -Math.cos(FACE * R) };
const ry = Math.atan2(f.x, f.z);
const toLocal = (v) => new THREE.Vector3(v.x * Math.cos(-ry) + v.z * Math.sin(-ry), v.y, -v.x * Math.sin(-ry) + v.z * Math.cos(-ry));
const near = new ReflectedLight();               // ±22 m, 0.125 m cells
const wide = new ReflectedLight(); wide.half = 90; wide.res = 360; // ±90 m, 0.5 m cells
wide.data = new Float32Array(wide.res * wide.res); wide.half16 = new Uint16Array(wide.res * wide.res);
wide.texture = { needsUpdate: false }; wide.upload = () => {}; near.upload = () => {};
const rows = [];
const STEP = +(process.argv[2] || 3), RAYS = +(process.argv[3] || 60000);
for (let day = 0; day < 365; day += STEP) {
  const dt = new Date(Date.UTC(2026, 0, 1 + day)); const y = dt.getUTCFullYear(), m = dt.getUTCMonth() + 1, d = dt.getUTCDate();
  for (let min = 300; min <= 1260; min += 10) {
    const s = sunPosition(pacificToDate(y, m, d, min), LAT, LON);
    if (s.elevation < 0.5) continue;
    const w = new THREE.Vector3(Math.sin(s.azimuth * R) * Math.cos(s.elevation * R), Math.sin(s.elevation * R), -Math.cos(s.azimuth * R) * Math.cos(s.elevation * R));
    const sl = toLocal(w);
    const st = near.compute(sl, RAYS);
    const sw = wide.compute(sl, RAYS);
    // where does head-height reflected light (>0.3 sun) land? distance & bearing of farthest and centroid
    const g = wide.headGrid, res = wide.res, cell = 2 * wide.half / res;
    let far = 0, farB = 0, cx = 0, cz = 0, cw = 0, area03 = 0;
    for (let iz = 0; iz < res; iz++) for (let ix = 0; ix < res; ix++) {
      const v = g[iz * res + ix]; if (v < 0.3) continue;
      const lx = -wide.half + (ix + 0.5) * cell, lz = -wide.half + (iz + 0.5) * cell;
      area03 += cell * cell; cx += lx * v; cz += lz * v; cw += v;
      const dist = Math.hypot(lx, lz); if (dist > far) { far = dist; farB = Math.atan2(lx, lz); }
    }
    // local (x,z) -> world bearing: local +z = FACE, +x = FACE+90
    const brg = (a) => ((FACE + a / R) % 360 + 360) % 360;
    rows.push({ day, m, d, min, az: +s.azimuth.toFixed(1), el: +s.elevation.toFixed(1), head: +st.headPeak.toFixed(2), headArea1: +st.headArea.toFixed(2), ground: +st.groundPeak.toFixed(2), share: +st.reflectedShare.toFixed(3),
      reach03: +far.toFixed(1), reachBrg: +brg(farB).toFixed(0), area03: +area03.toFixed(1), centroidBrg: cw ? +brg(Math.atan2(cx, cz)).toFixed(0) : null, centroidDist: cw ? +Math.hypot(cx / cw, cz / cw).toFixed(1) : null });
  }
  process.stderr.write(`day ${day}\r`);
}
writeFileSync(process.argv[4] || 'glare_year.json', JSON.stringify(rows));
const worst = rows.slice().sort((a, b) => b.head - a.head).slice(0, 8);
console.log('rows', rows.length); console.log(worst);
const over1 = rows.filter((r) => r.head >= 1).length, over15 = rows.filter((r) => r.head >= 1.5).length;
console.log('fraction of daylight samples with head>=1 sun', (over1 / rows.length).toFixed(3), ' >=1.5', (over15 / rows.length).toFixed(3), ' hours/yr >=1:', (over1 * 10 / 60 * STEP).toFixed(0), ' >=1.5:', (over15 * 10 / 60 * STEP).toFixed(0));
console.log('max ground', Math.max(...rows.map((r) => r.ground)), 'max reach03', Math.max(...rows.map((r) => r.reach03)));
