// Wind: two live 2D lattice-Boltzmann (D2Q9) flow solutions through the
// funnel: a plan slice at 4 ft (1.2 m) and a vertical section along the
// wind. Both slices are cut from the exact funnel geometry. Each 2D slice
// lets air escape the funnel only one way (around the sides, or over the
// top), and the lattice Reynolds number is low, so treat them as a guide.
import { CONE } from '../sculpture.js';

const EX = [0, 1, 0, -1, 0, 1, -1, -1, 1], EY = [0, 0, 1, 0, -1, 1, 1, -1, -1];
const W = [4 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 36, 1 / 36, 1 / 36, 1 / 36];
const OPP = [0, 3, 4, 1, 2, 7, 8, 5, 6];
const U0 = 0.09;      // inflow speed, lattice units
const TAU = 0.54;     // relaxation time

// Is local point (x,y,z) inside the funnel's shell (panel sandwich + rim)?
function inShell(x, y, z, halfT) {
  if (y < 0 || z > CONE.zm + halfT || z < CONE.zt - halfT) return false;
  const zc = Math.min(CONE.zm, Math.max(CONE.zt, z));
  const t = (CONE.zm - zc) / (CONE.zm - CONE.zt);
  const r = CONE.rm + (CONE.rt - CONE.rm) * t, cy = CONE.ym + (CONE.yt - CONE.ym) * t;
  const d = Math.hypot(x, y - cy) - r;
  if (z > CONE.zm || z < CONE.zt) return Math.abs(d) < halfT && Math.abs(z - zc) < halfT;
  return d > -halfT && d < CONE.thickness + halfT;
}

export class Slice {
  // kind: 'plan' (horizontal at height h) or 'section' (vertical along the wind)
  constructor(kind, nx, ny, cell) {
    Object.assign(this, { kind, nx, ny, cell });
    const n = nx * ny;
    this.f = new Float32Array(9 * n); this.g = new Float32Array(9 * n);
    this.rho = new Float32Array(n); this.ux = new Float32Array(n); this.uy = new Float32Array(n);
    this.solid = new Uint8Array(n);
    this.reset();
  }
  reset() {
    const n = this.nx * this.ny;
    for (let i = 0; i < n; i++) for (let k = 0; k < 9; k++) this.f[k * n + i] = this.feq(k, 1, U0, 0);
    this.ux.fill(U0); this.uy.fill(0); this.rho.fill(1);
  }
  feq(k, r, ux, uy) {
    const eu = EX[k] * ux + EY[k] * uy, uu = ux * ux + uy * uy;
    return W[k] * r * (1 + 3 * eu + 4.5 * eu * eu - 1.5 * uu);
  }
  // Build the obstacle mask from the funnel for a wind arriving `delta` degrees
  // off the mouth's axis (0 = straight into the mouth).
  setGeometry(delta, height = 1.2) {
    const { nx, ny, cell } = this, n = nx * ny;
    this.solid.fill(0);
    const a = delta * Math.PI / 180;
    // upwind points to -X in the domain; the mouth axis (+z local) points upwind rotated by delta
    const ax = -Math.cos(a), ay = Math.sin(a);   // local +z in domain (plan)
    const bx = -ay, by = ax;                      // local +x in domain (plan)
    this.cx = nx * 0.36; this.cy = this.kind === 'plan' ? ny * 0.5 : 0;
    const halfT = Math.max(0.06, cell * 0.75); // thick enough that diagonal walls don't leak
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const X = (i - this.cx) * cell, Y = (j - this.cy) * cell;
      let x, y, z;
      if (this.kind === 'plan') { x = X * bx + Y * by; z = X * ax + Y * ay; y = height; }
      else { x = X * Math.sin(a); z = -X * Math.cos(a); y = Y; } // vertical plane along the wind
      if (inShell(x, y, z, halfT)) this.solid[j * nx + i] = 1;
      if (this.kind === 'section' && j === 0) this.solid[j * nx + i] = 1; // ground
    }
    // probe: the throat centre (and a line across it)
    const tz = CONE.zt + 0.15;
    const probe = (x, y, z) => {
      let X, Y;
      if (this.kind === 'plan') { X = x * bx + z * ax; Y = x * by + z * ay; }
      else { X = -z / Math.max(Math.cos(a), 0.2); Y = y; } // where the section crosses the throat plane
      return [Math.round(this.cx + X / cell), Math.round(this.cy + Y / cell)];
    };
    this.probePts = this.kind === 'plan'
      ? [-0.4, -0.2, 0, 0.2, 0.4].map((x) => probe(x, height, tz))
      : [0.5, 0.9, 1.3].map((y) => probe(0, y, tz));
    this.reset();
  }
  step() {
    const { nx, ny, f, g, solid, rho, ux, uy } = this, n = nx * ny;
    const om = 1 / TAU;
    // collide
    for (let i = 0; i < n; i++) {
      if (solid[i]) continue;
      let r = 0, mx = 0, my = 0;
      for (let k = 0; k < 9; k++) { const v = f[k * n + i]; r += v; mx += v * EX[k]; my += v * EY[k]; }
      const u = mx / r, v = my / r;
      rho[i] = r; ux[i] = u; uy[i] = v;
      const uu = 1.5 * (u * u + v * v);
      for (let k = 0; k < 9; k++) {
        const eu = EX[k] * u + EY[k] * v;
        const fe = W[k] * r * (1 + 3 * eu + 4.5 * eu * eu - uu);
        f[k * n + i] += om * (fe - f[k * n + i]);
      }
    }
    // stream with bounce-back
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const s = j * nx + i;
      if (solid[s]) continue;
      for (let k = 0; k < 9; k++) {
        let ii = i + EX[k], jj = j + EY[k];
        if (ii < 0 || ii >= nx) continue;
        if (jj < 0 || jj >= ny) continue;
        const d = jj * nx + ii;
        if (solid[d]) g[OPP[k] * n + s] = f[k * n + s];
        else g[k * n + d] = f[k * n + s];
      }
    }
    // boundaries: inflow (left), open outflow (right), far field top (and bottom for plan)
    for (let j = 0; j < ny; j++) {
      const s0 = j * nx, s1 = j * nx + nx - 1, s2 = j * nx + nx - 2;
      if (!solid[s0]) for (let k = 0; k < 9; k++) g[k * n + s0] = this.feq(k, 1, U0 * this.profile(j), 0);
      for (let k = 0; k < 9; k++) g[k * n + s1] = g[k * n + s2];
    }
    for (let i = 0; i < nx; i++) {
      const top = (ny - 1) * nx + i;
      for (let k = 0; k < 9; k++) g[k * n + top] = this.feq(k, 1, U0 * this.profile(ny - 1), 0);
      if (this.kind === 'plan') for (let k = 0; k < 9; k++) g[k * n + i] = this.feq(k, 1, U0, 0);
    }
    this.f = g; this.g = f;
  }
  // approach profile: uniform in plan; open-water power law (alpha 0.11) in section
  profile(j) {
    if (this.kind === 'plan') return 1;
    const z = Math.max(j * this.cell, 0.05);
    return Math.min(1.15, Math.pow(z / 1.5, 0.11));
  }
  // mean speed / inflow speed at the throat probe
  throatRatio() {
    let s = 0, c = 0;
    for (const [i, j] of this.probePts) {
      if (i < 0 || j < 0 || i >= this.nx || j >= this.ny) continue;
      const k = j * this.nx + i; if (this.solid[k]) continue;
      s += Math.hypot(this.ux[k], this.uy[k]); c++;
    }
    const ref = this.kind === 'plan' ? U0 : U0 * this.profile(Math.round(1.2 / this.cell));
    return c ? s / c / ref : 0;
  }
  speedAt(x, y) { // bilinear, lattice units
    const i = Math.floor(x), j = Math.floor(y);
    if (i < 0 || j < 0 || i >= this.nx - 1 || j >= this.ny - 1) return [U0, 0];
    const fx = x - i, fy = y - j, nx = this.nx;
    const k = j * nx + i;
    const L = (a) => (a[k] * (1 - fx) + a[k + 1] * fx) * (1 - fy) + (a[k + nx] * (1 - fx) + a[k + nx + 1] * fx) * fy;
    return [L(this.ux), L(this.uy)];
  }
}

// ---------------------------------------------------------------------------
export class WindLab {
  constructor(planCanvas, sectionCanvas, onStats) {
    this.cells = 0.1;
    this.plan = new Slice('plan', 250, 128, this.cells);
    this.section = new Slice('section', 250, 72, this.cells);
    this.views = [[this.plan, planCanvas], [this.section, sectionCanvas]].map(([s, c]) => ({ s, c, ctx: c.getContext('2d'), parts: [], img: null }));
    this.onStats = onStats;
    this.freeMph = 20; this.delta = 19; this.running = true;
    this.setWind(248, 229.4);
    for (const v of this.views) this.seed(v);
    this.frame = 0;
  }
  setWind(fromBearing, facing) {
    let d = ((fromBearing - facing) % 360 + 540) % 360 - 180;
    this.delta = d;
    this.plan.setGeometry(Math.abs(d));
    this.section.setGeometry(Math.abs(d));
    this.warm = 0;
  }
  seed(v) {
    v.parts = [];
    for (let p = 0; p < 1400; p++) v.parts.push([Math.random() * v.s.nx, 1 + Math.random() * (v.s.ny - 2), 100 + Math.random() * 400]);
  }
  tick(steps = 6) {
    if (!this.running) return;
    // settle the start-up swirl quickly before showing steady flow
    if (this.warm < 2400) steps = Math.max(steps, 90);
    for (let k = 0; k < steps; k++) { this.plan.step(); this.section.step(); }
    this.warm += steps;
    for (const v of this.views) this.draw(v);
    if (++this.frame % 10 === 0) {
      const rp = this.plan.throatRatio(), rs = this.section.throatRatio();
      this.onStats({ plan: rp, section: rs, warm: Math.min(1, this.warm / 2400) });
    }
  }
  draw(v) {
    const { s, c, ctx } = v;
    const W = c.width, H = c.height, sx = W / s.nx, sy = H / s.ny;
    // speed field as blueprint shading
    if (!v.img || v.img.width !== s.nx) { v.off = document.createElement('canvas'); v.off.width = s.nx; v.off.height = s.ny; v.img = v.off.getContext('2d').createImageData(s.nx, s.ny); }
    const d = v.img.data, n = s.nx * s.ny;
    for (let j = 0; j < s.ny; j++) for (let i = 0; i < s.nx; i++) {
      const k = j * s.nx + i, p = ((s.ny - 1 - j) * s.nx + i) * 4;
      if (s.solid[k]) { d[p] = 235; d[p + 1] = 244; d[p + 2] = 255; d[p + 3] = 255; continue; }
      const r = Math.hypot(s.ux[k], s.uy[k]) / U0;
      const mph = r * this.freeMph;
      // colour by what a person there would feel against the SF criteria
      let col;
      if (mph < 11) col = [14 + r * 30, 44 + r * 60, 78 + r * 70];
      else if (mph < 26) { const t = (mph - 11) / 15; col = [40 + t * 60, 120 + t * 80, 160 + t * 40]; }
      else if (mph < 36) { const t = (mph - 26) / 10; col = [200 + t * 55, 170 - t * 40, 60]; }
      else col = [255, 90, 70];
      d[p] = col[0]; d[p + 1] = col[1]; d[p + 2] = col[2]; d[p + 3] = 255;
    }
    v.off.getContext('2d').putImageData(v.img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.globalAlpha = 1;
    ctx.drawImage(v.off, 0, 0, W, H);
    // particles (streaklines)
    ctx.strokeStyle = 'rgba(230,245,255,0.55)'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (const p of v.parts) {
      const [u, w] = s.speedAt(p[0], p[1]);
      const k = 9;
      const x0 = p[0], y0 = p[1];
      p[0] += u * k; p[1] += w * k; p[2]--;
      const cellIdx = Math.floor(p[1]) * s.nx + Math.floor(p[0]);
      if (p[0] >= s.nx - 1 || p[0] < 0 || p[1] < 1 || p[1] >= s.ny - 1 || p[2] < 0 || s.solid[cellIdx]) {
        p[0] = Math.random() * 3; p[1] = 1 + Math.random() * (s.ny - 2); p[2] = 250 + Math.random() * 300; continue;
      }
      ctx.moveTo(x0 * sx, H - y0 * sy); ctx.lineTo(p[0] * sx + (u > 0 ? 0.01 : 0), H - p[1] * sy);
    }
    ctx.stroke();
    // grid (1 m)
    ctx.strokeStyle = 'rgba(160,200,235,0.08)';
    ctx.beginPath();
    const m = 1 / s.cell;
    for (let x = (s.cx % m); x < s.nx; x += m) { ctx.moveTo(x * sx, 0); ctx.lineTo(x * sx, H); }
    for (let y = (s.cy % m); y < s.ny; y += m) { ctx.moveTo(0, H - y * sy); ctx.lineTo(W, H - y * sy); }
    ctx.stroke();
    // probe marks
    ctx.fillStyle = '#ffb347';
    for (const [i, j] of s.probePts) ctx.fillRect(i * sx - 2, H - j * sy - 2, 4, 4);
  }
}
