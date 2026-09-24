import * as THREE from 'three';
import { CONE } from './sculpture.js';

// Reflected-sunlight analysis. Sun rays (with the 0.53° solar disk and the
// finish's micro-roughness) are traced against the polished panels, bounced up
// to three times, and binned where they land on the ground and where they
// cross head height (1.7 m). The ground map is drawn into the scene as extra
// light, so reflected patches appear on the pad and lawn the way they would on
// site. Values are in "suns": 1.0 = the irradiance of direct sunlight.

const STRIP_DEG = 360 / CONE.strips, STRIP0 = 90 - STRIP_DEG / 2;
const L = CONE.zm - CONE.zt, dY = CONE.yt - CONE.ym, dR = CONE.rt - CONE.rm;

function hit(o, d) {
  const a = (CONE.zm - o[2]) / L, b = -d[2] / L;
  const p0 = o[1] - CONE.ym - dY * a, p1 = d[1] - dY * b;
  const r0 = CONE.rm + dR * a, r1 = dR * b;
  const A = d[0] * d[0] + p1 * p1 - r1 * r1;
  const B = 2 * (o[0] * d[0] + p0 * p1 - r0 * r1);
  const C = o[0] * o[0] + p0 * p0 - r0 * r0;
  const disc = B * B - 4 * A * C;
  if (disc < 0 || Math.abs(A) < 1e-9) return -1;
  const sq = Math.sqrt(disc);
  let l1 = (-B - sq) / (2 * A), l2 = (-B + sq) / (2 * A);
  if (l1 > l2) { const t = l1; l1 = l2; l2 = t; }
  for (const l of [l1, l2]) {
    if (l > 1e-4) {
      const y = o[1] + d[1] * l, z = o[2] + d[2] * l;
      const t = (CONE.zm - z) / L;
      if (t >= 0 && t <= 1 && y >= 0) return l;
    }
  }
  return -1;
}

export class ReflectedLight {
  constructor() {
    this.half = 22; // map covers ±22 m around the pad
    this.res = 352;
    this.data = new Float32Array(this.res * this.res);
    this.half16 = new Uint16Array(this.res * this.res);
    this.texture = new THREE.DataTexture(this.half16, this.res, this.res, THREE.RedFormat, THREE.HalfFloatType);
    this.texture.magFilter = THREE.LinearFilter; this.texture.minFilter = THREE.LinearFilter;
    this.texture.needsUpdate = true;
    this.rect = new THREE.Vector4(-this.half, -this.half, 2 * this.half, 2 * this.half);
    this.stats = { groundPeak: 0, headPeak: 0, headArea: 0, reflectedShare: 0 };
    this.reflectance = 0.62;
    this.roughness = 0.03;
    this.enabled = true;
  }

  // sunL: sun direction in sculpture-local space (unit, pointing toward the sun)
  compute(sunL, rays = 160000) {
    const res = this.res, half = this.half, cell = (2 * half) / res;
    const grid = this.data; grid.fill(0);
    const head = new Float32Array(res * res);
    const count = new Float32Array(res * res);
    this.stats = { groundPeak: 0, headPeak: 0, headArea: 0, reflectedShare: 0 };
    if (!this.enabled || sunL.y <= 0.01) { this.upload(); return this.stats; }
    // Ray origins on a disk perpendicular to the sun covering the sculpture.
    const cx = 0, cy = 2.2, cz = 0, R = 3.9;
    const s = new THREE.Vector3(sunL.x, sunL.y, sunL.z).normalize();
    const t1 = new THREE.Vector3().crossVectors(s, Math.abs(s.y) < 0.95 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)).normalize();
    const t2 = new THREE.Vector3().crossVectors(s, t1);
    const areaPer = Math.PI * R * R / rays;
    const cellArea = cell * cell;
    const sunRad = 0.00465; // solar angular radius (rad)
    const rough = this.roughness * this.roughness * 0.9;
    const o = [0, 0, 0], d = [0, 0, 0];
    let reflectedFlux = 0, incidentFlux = 0;
    for (let i = 0; i < rays; i++) {
      // stratified-ish disk sample (golden angle)
      const rr = R * Math.sqrt((i + 0.5) / rays), aa = i * 2.399963229728653;
      const u = rr * Math.cos(aa), v = rr * Math.sin(aa);
      o[0] = cx + t1.x * u + t2.x * v + s.x * 12; o[1] = cy + t1.y * u + t2.y * v + s.y * 12; o[2] = cz + t1.z * u + t2.z * v + s.z * 12;
      // direction: toward -sun, jittered within the solar disk
      const ja = Math.random() * 6.283, jr = sunRad * Math.sqrt(Math.random());
      d[0] = -s.x + (t1.x * Math.cos(ja) + t2.x * Math.sin(ja)) * jr;
      d[1] = -s.y + (t1.y * Math.cos(ja) + t2.y * Math.sin(ja)) * jr;
      d[2] = -s.z + (t1.z * Math.cos(ja) + t2.z * Math.sin(ja)) * jr;
      let energy = 1, bounced = false;
      for (let b = 0; b < 4; b++) {
        const l = hit(o, d);
        if (l < 0) break;
        if (b === 0) incidentFlux += areaPer;
        const px = o[0] + d[0] * l, py = o[1] + d[1] * l, pz = o[2] + d[2] * l;
        const t = (CONE.zm - pz) / L;
        const cyy = CONE.ym + dY * t, r = CONE.rm + dR * t;
        let th = Math.atan2(py - cyy, px) * 180 / Math.PI;
        const j = Math.floor((((th - STRIP0) % 360) + 360) % 360 / STRIP_DEG);
        if (j % 2 === 0) { energy = 0; break; } // painted panel: absorbed / diffused
        // outward normal
        let nx = px, ny = py - cyy, nz = ((py - cyy) * dY + r * dR) / L;
        const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
        let dn = d[0] * nx + d[1] * ny + d[2] * nz;
        if (dn > 0) { nx = -nx; ny = -ny; nz = -nz; dn = -dn; }
        d[0] -= 2 * dn * nx; d[1] -= 2 * dn * ny; d[2] -= 2 * dn * nz;
        if (rough > 0) { d[0] += (Math.random() - 0.5) * rough * 2; d[1] += (Math.random() - 0.5) * rough * 2; d[2] += (Math.random() - 0.5) * rough * 2; }
        const dl = Math.hypot(d[0], d[1], d[2]); d[0] /= dl; d[1] /= dl; d[2] /= dl;
        o[0] = px + nx * 1e-3; o[1] = py + ny * 1e-3; o[2] = pz + nz * 1e-3;
        energy *= this.reflectance; bounced = true;
      }
      if (!bounced || energy <= 0 || d[1] >= -1e-4) continue;
      reflectedFlux += energy * areaPer;
      const flux = energy * areaPer / cellArea;
      // head-height crossing (1.7 m), only when descending through it
      if (o[1] > 1.7) {
        const lh = (1.7 - o[1]) / d[1];
        const hx = o[0] + d[0] * lh, hz = o[2] + d[2] * lh;
        const ix = Math.floor((hx + half) / cell), iz = Math.floor((hz + half) / cell);
        if (ix >= 0 && iz >= 0 && ix < res && iz < res) head[iz * res + ix] += flux / Math.max(Math.abs(d[1]), 0.25);
      }
      const lg = -o[1] / d[1];
      const gx = o[0] + d[0] * lg, gz = o[2] + d[2] * lg;
      const ix = Math.floor((gx + half) / cell), iz = Math.floor((gz + half) / cell);
      // irradiance on a horizontal surface = flux per horizontal area
      if (ix >= 0 && iz >= 0 && ix < res && iz < res) { grid[iz * res + ix] += flux; count[iz * res + ix] += 1; }
    }
    // Scale for the true horizontal irradiance of direct sun: our flux unit is
    // per area normal to the beam, while "1 sun on the ground" = sin(elevation).
    // Adaptive density estimate: keep fine detail where many rays landed,
    // widen the kernel where only a few did (avoids Monte-Carlo speckle).
    const coarse = grid.slice(), cc = count.slice();
    boxBlur(coarse, res, 6); boxBlur(cc, res, 6);
    const fineC = count.slice(); boxBlur(fineC, res, 1);
    blur(grid, res);
    for (let i = 0; i < grid.length; i++) {
      const t = Math.min(1, Math.max(0, (fineC[i] - 2) / 10));
      grid[i] = grid[i] * t + coarse[i] * (1 - t);
    }
    boxBlur(head, res, 2);
    const norm = 1; // already in beam-normal suns
    let gp = 0, hp = 0, ha = 0;
    for (let i = 0; i < grid.length; i++) {
      grid[i] *= norm; if (grid[i] > gp) gp = grid[i];
      if (head[i] > hp) hp = head[i];
      if (head[i] > 1.0) ha += cellArea;
    }
    this.stats = {
      groundPeak: gp, headPeak: hp, headArea: ha,
      reflectedShare: incidentFlux > 0 ? reflectedFlux / incidentFlux : 0,
      directGround: Math.max(0, s.y),
    };
    this.upload();
    return this.stats;
  }

  upload() {
    for (let i = 0; i < this.data.length; i++) this.half16[i] = THREE.DataUtils.toHalfFloat(this.data[i]);
    this.texture.needsUpdate = true;
  }
}

function boxBlur(g, res, r) {
  const tmp = new Float32Array(g.length), n = 2 * r + 1;
  for (let z = 0; z < res; z++) {
    let acc = 0;
    for (let x = -r; x <= r; x++) acc += g[z * res + Math.min(res - 1, Math.max(0, x))];
    for (let x = 0; x < res; x++) {
      tmp[z * res + x] = acc / n;
      acc += g[z * res + Math.min(res - 1, x + r + 1)] - g[z * res + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < res; x++) {
    let acc = 0;
    for (let z = -r; z <= r; z++) acc += tmp[Math.min(res - 1, Math.max(0, z)) * res + x];
    for (let z = 0; z < res; z++) {
      g[z * res + x] = acc / n;
      acc += tmp[Math.min(res - 1, z + r + 1) * res + x] - tmp[Math.max(0, z - r) * res + x];
    }
  }
}
function blur(g, res) {
  const tmp = new Float32Array(g.length);
  const k = [0.25, 0.5, 0.25];
  for (let pass = 0; pass < 2; pass++) {
    for (let z = 0; z < res; z++) for (let x = 0; x < res; x++) {
      let s = 0;
      for (let i = -1; i <= 1; i++) { const xx = Math.min(res - 1, Math.max(0, x + i)); s += g[z * res + xx] * k[i + 1]; }
      tmp[z * res + x] = s;
    }
    for (let z = 0; z < res; z++) for (let x = 0; x < res; x++) {
      let s = 0;
      for (let i = -1; i <= 1; i++) { const zz = Math.min(res - 1, Math.max(0, z + i)); s += tmp[zz * res + x] * k[i + 1]; }
      g[z * res + x] = s;
    }
  }
}
