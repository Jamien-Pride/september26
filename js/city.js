import * as THREE from 'three';
import { toLocal, elevToY, SITE, M_PER_DEG_LAT, M_PER_DEG_LON } from './geo.js';
import { facadeMaterial } from './facade.js';
import { classify } from './terrain.js';

// San Francisco and East Bay skyline. Named towers are placed at their real
// coordinates and heights; the rest of the urban fabric is generated on the
// DEM wherever the land-cover rules say "urban", with heights rising toward
// the Financial District / Transbay and SoMa.

const TOWERS = [
  // name, lat, lon, height (m), footprint w, d, kind
  ['Salesforce Tower', 37.7897, -122.3972, 326, 52, 52, 'salesforce'],
  ['Transamerica Pyramid', 37.7952, -122.4028, 260, 53, 53, 'pyramid'],
  ['181 Fremont', 37.7898, -122.3953, 244, 30, 30, 'spire'],
  ['555 California', 37.7920, -122.4035, 237, 60, 45, 'dark'],
  ['345 California', 37.7930, -122.4012, 212, 42, 36, 'twin'],
  ['Millennium Tower', 37.7905, -122.3960, 197, 38, 32, 'glass'],
  ['One Rincon Hill', 37.7855, -122.3925, 188, 30, 30, 'glass'],
  ['The Avery', 37.7869, -122.3948, 188, 28, 28, 'glass'],
  ['Park Tower', 37.7893, -122.3933, 184, 40, 40, 'glass'],
  ['101 California', 37.7929, -122.3981, 183, 40, 40, 'cyl'],
  ['50 Fremont', 37.7905, -122.3971, 183, 50, 30, 'box'],
  ['Four Embarcadero', 37.7952, -122.3962, 174, 60, 22, 'box'],
  ['One Embarcadero', 37.7948, -122.3995, 173, 60, 22, 'box'],
  ['Spear Tower', 37.7938, -122.3947, 172, 40, 36, 'box'],
  ['44 Montgomery', 37.7896, -122.4015, 172, 40, 30, 'box'],
  ['Four Seasons', 37.7864, -122.4034, 156, 30, 30, 'box'],
  ['555 Mission', 37.7885, -122.3988, 148, 40, 30, 'glass'],
  ['St. Regis', 37.7858, -122.4012, 147, 30, 30, 'box'],
  ['The Harrison', 37.7856, -122.3919, 140, 28, 28, 'glass'],
  ['350 Mission', 37.7907, -122.3969, 138, 34, 30, 'glass'],
  ['Infinity Towers', 37.7890, -122.3905, 137, 30, 30, 'glass'],
  ['Lumina', 37.7883, -122.3913, 135, 30, 30, 'glass'],
  ['Marriott Marquis', 37.7849, -122.4033, 132, 40, 40, 'box'],
  ['560 Mission', 37.7883, -122.3987, 128, 40, 30, 'glass'],
  ['Two Embarcadero', 37.7950, -122.3983, 125, 55, 22, 'box'],
  ['Three Embarcadero', 37.7950, -122.3973, 125, 55, 22, 'box'],
  ['33 Tehama', 37.7875, -122.3960, 120, 26, 26, 'box'],
  ['Mira', 37.7887, -122.3905, 122, 30, 30, 'box'],
  ['Isle House (Treasure Island)', 0, 0, 0, 0, 0, 'skip'],
];
const DOWNTOWN = toLocal(37.7915, -122.3985);

function taperGeometry(geo, h, topScale) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i), k = THREE.MathUtils.lerp(1, topScale, THREE.MathUtils.clamp(y / h, 0, 1));
    p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k);
  }
  geo.computeVertexNormals();
  return geo;
}
function roundedBox(w, d, h, r) {
  const s = new THREE.Shape();
  const x = w / 2 - r, z = d / 2 - r;
  s.moveTo(-x, -d / 2); s.lineTo(x, -d / 2); s.quadraticCurveTo(w / 2, -d / 2, w / 2, -z); s.lineTo(w / 2, z);
  s.quadraticCurveTo(w / 2, d / 2, x, d / 2); s.lineTo(-x, d / 2); s.quadraticCurveTo(-w / 2, d / 2, -w / 2, z);
  s.lineTo(-w / 2, -z); s.quadraticCurveTo(-w / 2, -d / 2, -x, -d / 2);
  const g = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 6, steps: 12 });
  g.rotateX(-Math.PI / 2);
  return g;
}

export function buildCity(terrain, shared) {
  const group = new THREE.Group();
  group.name = 'city';
  const mats = {
    glass: facadeMaterial({ color: 0x8c979e, glass: 0x3b4c58, curtain: true, floorH: 3.9, bayW: 1.5, glassRough: 0.05, seed: 2, litFrac: 0.35 }, shared),
    box: facadeMaterial({ color: 0xc9c2b4, glass: 0x28323a, floorH: 3.8, bayW: 1.6, windowFrac: 0.55, seed: 4, litFrac: 0.4 }, shared),
    dark: facadeMaterial({ color: 0x4a2e2a, glass: 0x1c1f22, floorH: 3.8, bayW: 1.4, windowFrac: 0.5, seed: 6, litFrac: 0.35 }, shared),
    white: facadeMaterial({ color: 0xe4e1da, glass: 0x2a3440, floorH: 3.9, bayW: 1.8, windowFrac: 0.4, seed: 8, litFrac: 0.4 }, shared),
    salesforce: facadeMaterial({ color: 0xc8c4bb, glass: 0x51616b, floorH: 4.2, bayW: 1.5, windowFrac: 0.7, sillFrac: 0.15, seed: 10, litFrac: 0.3 }, shared),
    fabric: facadeMaterial({ color: 0xffffff, glass: 0x2a2f33, floorH: 3.2, bayW: 2.2, windowFrac: 0.5, seed: 12, litFrac: 0.5 }, shared),
  };
  const add = (geo, mat, x, z, rot = 0) => {
    const m = new THREE.Mesh(geo, mat);
    const base = elevToY(terrain.elevation(x, z));
    m.position.set(x, base - 1, z); m.rotation.y = rot;
    m.layers.enable(2); m.layers.enable(3);
    group.add(m);
    return m;
  };
  for (const [name, lat, lon, h, w, d, kind] of TOWERS) {
    if (kind === 'skip') continue;
    const p = toLocal(lat, lon);
    let geo, mat = mats.glass;
    if (kind === 'salesforce') { geo = taperGeometry(roundedBox(w, w, h, 9), h, 0.72); mat = mats.salesforce; }
    else if (kind === 'pyramid') { geo = new THREE.CylinderGeometry(3, w * 0.7, h, 4, 8); geo.rotateY(Math.PI / 4); geo.translate(0, h / 2, 0); mat = mats.white; }
    else if (kind === 'spire') { geo = taperGeometry(new THREE.BoxGeometry(w, h * 0.87, w, 1, 10, 1).translate(0, h * 0.435, 0), h * 0.87, 0.6); add(new THREE.CylinderGeometry(0.4, 1.2, h * 0.13, 6).translate(0, h * 0.935, 0), mats.white, p.x, p.z); }
    else if (kind === 'cyl') { geo = new THREE.CylinderGeometry(w / 2, w / 2, h, 24).translate(0, h / 2, 0); }
    else if (kind === 'dark') { geo = new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0); mat = mats.dark; }
    else if (kind === 'twin') { geo = new THREE.BoxGeometry(w, h * 0.85, d).translate(0, h * 0.425, 0); mat = mats.box;
      for (const sx of [-1, 1]) add(new THREE.BoxGeometry(2, h * 0.15, 2).translate(sx * 10, h * 0.925, 0), mats.white, p.x, p.z); }
    else if (kind === 'box') { geo = new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0); mat = mats.box; }
    else { geo = new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0); }
    add(geo, mat, p.x, p.z, -0.12);
  }
  // Ferry Building (and its 75 m clock tower), Coit Tower, Sutro Tower
  const fb = toLocal(37.7955, -122.3937);
  add(new THREE.BoxGeometry(200, 14, 45).translate(0, 7, 0), mats.white, fb.x, fb.z, -0.72);
  add(new THREE.BoxGeometry(10, 75, 10).translate(0, 37.5, 0), mats.white, fb.x, fb.z);
  const coit = toLocal(37.8024, -122.4058);
  add(new THREE.CylinderGeometry(5.5, 6, 64, 20).translate(0, 32, 0), new THREE.MeshStandardMaterial({ color: 0xe8e2d4, roughness: 0.8 }), coit.x, coit.z);
  const sutro = toLocal(37.7552, -122.4528);
  const red = new THREE.MeshStandardMaterial({ color: 0xb03a2e, roughness: 0.7 });
  for (const a of [0, 2.094, 4.189]) add(new THREE.CylinderGeometry(1.2, 2.2, 298, 6).translate(Math.cos(a) * 18, 149, Math.sin(a) * 18), red, sutro.x, sutro.z);
  add(new THREE.BoxGeometry(60, 3, 6).translate(0, 230, 0), red, sutro.x, sutro.z);

  // Generated urban fabric
  const g = terrain.far;
  const inst = [];
  let s = 31337; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let j = 0; j < g.nz; j++) for (let i = 0; i < g.nx; i++) {
    const x = g.x0 + i * g.step, z = g.z0 + j * g.step;
    const dSite = Math.hypot(x, z);
    if (dSite < 1300 || dSite > 17000) continue;
    const e = g.h[j * g.nx + i] / 10;
    if (e < 1.5) continue;
    const c = classify(x, z, e);
    if (c.urban < 0.45) continue;
    const dd = Math.hypot(x - DOWNTOWN.x, z - DOWNTOWN.z);
    const core = Math.exp(-(dd * dd) / (1100 * 1100));
    const soma = Math.exp(-(dd * dd) / (2600 * 2600));
    const per = dd < 3000 ? 3 : dSite < 8000 ? 2 : 1;
    for (let k = 0; k < per; k++) {
      if (rnd() > 0.85) continue;
      const bx = x + (rnd() - 0.5) * g.step, bz = z + (rnd() - 0.5) * g.step;
      let h = 8 + rnd() * 9;
      h += soma * rnd() * 40 + core * Math.pow(rnd(), 2) * 150;
      if (dd < 700 && rnd() < 0.5) h = Math.max(h, 60 + rnd() * 90);
      const w = 14 + rnd() * 26 + core * 20, d = 14 + rnd() * 26;
      inst.push([bx, elevToY(terrain.elevation(bx, bz)) - 2, bz, w, h, d]);
    }
  }
  // Port of Oakland container cranes (seen looking east)
  const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), mats.fabric, inst.length);
  const fabricCols = [[0.62, 0.60, 0.56], [0.72, 0.70, 0.66], [0.55, 0.50, 0.45], [0.66, 0.62, 0.52], [0.48, 0.47, 0.46], [0.75, 0.73, 0.70], [0.58, 0.54, 0.48]];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -0.12), sc = new THREE.Vector3(), t = new THREE.Vector3();
  const col = new THREE.Color();
  inst.forEach(([x, y, z, w, h, d], k) => {
    t.set(x, y, z); sc.set(w, h + 2, d); m.compose(t, q, sc); im.setMatrixAt(k, m);
    const c = fabricCols[k % fabricCols.length]; col.setRGB(c[0], c[1], c[2]); im.setColorAt(k, col);
  });
  im.layers.enable(2); im.layers.enable(3);
  im.computeBoundingSphere();
  group.add(im);
  const craneMat = new THREE.MeshStandardMaterial({ color: 0xd8d8d0, roughness: 0.6 });
  const craneRed = new THREE.MeshStandardMaterial({ color: 0xb8382c, roughness: 0.6 });
  for (let i = 0; i < 14; i++) {
    const lat = 37.7955 + (i % 7) * 0.0022, lon = -122.3215 + Math.floor(i / 7) * 0.012 + (i % 3) * 0.0006;
    const p = toLocal(lat, lon);
    const c = new THREE.Group();
    for (const [dx, dz] of [[-8, -12], [8, -12], [-8, 12], [8, 12]]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(1.5, 45, 1.5), i % 2 ? craneRed : craneMat); leg.position.set(dx, 22.5, dz); c.add(leg); }
    const boom = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 110), i % 2 ? craneRed : craneMat); boom.position.set(0, 48, -20); c.add(boom);
    c.position.set(p.x, elevToY(3), p.z); c.rotation.y = 0.9;
    c.traverse((o) => { if (o.isMesh) { o.layers.enable(2); o.layers.enable(3); } });
    group.add(c);
  }
  return group;
}
