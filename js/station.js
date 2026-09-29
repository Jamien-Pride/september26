import { CONFIG, GEO } from './config.js';
import { makeLayer, rng, roundRectPath, hsl, dotText } from './util.js';

// Static layers are rendered once per resize, with a margin so parallax never exposes an edge.
export const MX = 140;
export const MY = 70;

const E = GEO.eye;
const C = GEO.ceiling;
const ZW = GEO.zWall;
const Z_EDGE = GEO.zTrain - GEO.edgeGap;
const Z_GRANITE = Z_EDGE - GEO.graniteWidth;
const Z_YELLOW = Z_GRANITE - GEO.yellowWidth;
const TRENCH_Y = -GEO.trackDrop - 0.6;
const BAND0 = 10.9;
const BAND1 = 13.0;

export const FONT = '"Hind", "Frutiger", "Segoe UI", "Helvetica Neue", Arial, sans-serif';

export class Station {
  build(cam) {
    this.cam = cam;
    const W = cam.w + 2 * MX;
    const H = cam.h + 2 * MY;
    const d = cam.dpr;
    this.ceiling = makeLayer(W, H, d);
    this.wall = makeLayer(W, H, d);
    this.trench = makeLayer(W, H, d);
    this.floor = makeLayer(W, H, d);
    renderCeiling(this.ceiling, cam);
    renderWall(this.wall, cam);
    renderTrench(this.trench, cam);
    renderFloor(this.floor, cam);
    this.buildStaticRefl(cam);
    this.buildEnv(cam);
    this.buildVignette(cam);
    this.buildGrain();
    this.buildSign(cam);
  }

  // ---- per-frame helpers -------------------------------------------------

  // Vertical plane at depth z: parallax is a pure translation.
  drawVertical(ctx, layer, z) {
    const cam = this.cam, d = cam.dpr;
    const dx = -cam.camX * cam.f / z + cam.ox;
    const dy = cam.dEye * cam.f / z + cam.oy;
    ctx.setTransform(d, 0, 0, d, d * (dx - MX), d * (dy - MY));
    ctx.drawImage(layer.c, 0, 0, layer.w, layer.h);
  }

  // Horizontal plane at height y: parallax is an exact skew + scale about the horizon.
  drawHorizontal(ctx, layer, y) {
    const cam = this.cam, d = cam.dpr, hy = cam.hy;
    const a = -cam.camX / (E - y);
    const b = 1 + cam.dEye / (E - y);
    ctx.setTransform(d, 0, d * a, d * b,
      d * (-MX - a * (MY + hy) + cam.ox),
      d * (hy - b * (MY + hy) + cam.oy));
    ctx.drawImage(layer.c, 0, 0, layer.w, layer.h);
  }

  drawBackground(ctx) {
    this.drawHorizontal(ctx, this.ceiling, C);
    this.drawHorizontal(ctx, this.trench, TRENCH_Y);
    this.drawVertical(ctx, this.wall, ZW);
  }

  drawFloor(ctx) {
    this.drawHorizontal(ctx, this.floor, 0);
  }

  // ---- reflections -------------------------------------------------------

  // Mirror images of the ceiling and far wall as seen in the polished floor (unmasked, low-res).
  buildStaticRefl(cam) {
    const rs = 0.28;
    const R = makeLayer(cam.w, cam.h, rs);
    const r = R.ctx;
    const hy = cam.hy;
    if ('filter' in r) r.filter = 'blur(1px)';
    // Ceiling mirrored through the floor: a (negative) vertical scale about the horizon.
    const kc = (E + C) / (E - C);
    r.setTransform(rs, 0, 0, rs * kc, -rs * MX, rs * (hy - kc * (MY + hy)));
    r.drawImage(this.ceiling.c, 0, 0, this.ceiling.w, this.ceiling.h);
    // Far wall mirrored about the line where it meets the floor plane (only the part above y=0).
    const yW0 = cam.by(0, ZW);
    r.setTransform(rs, 0, 0, rs, 0, 0);
    r.save();
    r.beginPath();
    r.rect(0, yW0, cam.w, cam.h - yW0);
    r.clip();
    r.setTransform(rs, 0, 0, -rs, -rs * MX, rs * (2 * yW0 + MY));
    r.drawImage(this.wall.c, 0, 0, this.wall.w, this.wall.h);
    r.restore();
    this.reflStatic = R;
    this.refl = makeLayer(cam.w, cam.h, rs);
    this.reflScale = rs;
    this.reflMaskFill = reflGradient(this.refl.ctx, cam, 0);
  }

  // Composite floor reflections; the train (if any) occludes the wall in the mirror too.
  drawReflection(ctx, trainImg, y0) {
    const cam = this.cam, R = this.refl, r = R.ctx, rs = this.reflScale;
    r.setTransform(1, 0, 0, 1, 0, 0);
    r.globalCompositeOperation = 'copy';
    r.drawImage(this.reflStatic.c, 0, 0);
    r.globalCompositeOperation = 'source-over';
    if (trainImg) {
      r.setTransform(rs, 0, 0, -rs, 0, rs * 2 * y0);
      r.drawImage(trainImg.c, 0, 0, cam.w, cam.h);
    }
    r.setTransform(rs, 0, 0, rs, 0, 0);
    r.globalCompositeOperation = 'destination-in';
    r.fillStyle = this.reflMaskFill;
    r.fillRect(0, 0, cam.w, cam.h);
    r.globalCompositeOperation = 'source-over';
    const d = cam.dpr;
    ctx.setTransform(d, 0, 0, d, cam.ox, cam.oy);
    ctx.drawImage(R.c, 0, 0, cam.w, cam.h);
  }

  // Screen-fixed reflections for glass. Because the train slides parallel to the glass,
  // the reflected platform stays put while the train moves under it.
  buildEnv(cam) {
    const L = makeLayer(cam.w, cam.h, Math.min(cam.dpr, 1));
    const ctx = L.ctx;
    const T = GEO.zTrain;
    const top = cam.by(6.3, T), bot = cam.by(2.8, T);
    let g = ctx.createLinearGradient(0, top, 0, bot);
    g.addColorStop(0, 'rgba(120,130,140,0.30)');
    g.addColorStop(0.35, 'rgba(70,78,86,0.10)');
    g.addColorStop(1, 'rgba(40,44,50,0.0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, top, cam.w, bot - top);
    // Ceiling light rows behind the viewer, reflected as soft horizontal streaks.
    const rows = [5.75, 5.25];
    rows.forEach((y, i) => {
      const yy = cam.by(y, T);
      const hh = cam.s(T) * (i ? 0.1 : 0.14);
      const gg = ctx.createLinearGradient(0, yy - hh * 3, 0, yy + hh * 3);
      gg.addColorStop(0, 'rgba(255,255,255,0)');
      gg.addColorStop(0.5, `rgba(235,240,245,${i ? 0.18 : 0.32})`);
      gg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gg;
      ctx.fillRect(0, yy - hh * 3, cam.w, hh * 6);
    });
    // A couple of vertical columns (station pillars behind us) breaking up the streaks.
    ctx.globalCompositeOperation = 'destination-out';
    for (const fx of [0.18, 0.63, 0.91]) {
      const x = cam.w * fx, wv = cam.s(T) * 1.6;
      const gv = ctx.createLinearGradient(x - wv, 0, x + wv, 0);
      gv.addColorStop(0, 'rgba(0,0,0,0)');
      gv.addColorStop(0.5, 'rgba(0,0,0,0.75)');
      gv.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gv;
      ctx.fillRect(x - wv, 0, wv * 2, cam.h);
    }
    this.env = L;

    // Semi-gloss paint mirrors the platform at a grazing angle: the yellow strip lands
    // as a warm band just above the car floor line (exact placement from the mirror geometry).
    const P = makeLayer(cam.w, cam.h, Math.min(cam.dpr, 1));
    const p = P.ctx;
    const mirrorRow = (z) => cam.by(0, 2 * T - z);
    const yl0 = mirrorRow(Z_YELLOW), yl1 = mirrorRow(Z_GRANITE), ye = mirrorRow(Z_EDGE);
    const band = (ya, yb, c, a) => {
      const g2 = p.createLinearGradient(0, ya - 3, 0, yb + 3);
      g2.addColorStop(0, `rgba(${c},0)`);
      g2.addColorStop(0.2, `rgba(${c},${a})`);
      g2.addColorStop(0.8, `rgba(${c},${a})`);
      g2.addColorStop(1, `rgba(${c},0)`);
      p.fillStyle = g2;
      p.fillRect(0, ya - 3, cam.w, yb - ya + 6);
    };
    band(yl0, yl1, '235,180,20', 0.14);
    band(yl1, ye, '240,238,230', 0.1);
    // tiles beyond the strip, fading with distance
    band(cam.by(0, 2 * T - 4), yl0, '200,198,190', 0.06);
    this.paintEnv = P;
  }

  buildVignette(cam) {
    const L = makeLayer(cam.w, cam.h, Math.min(cam.dpr, 1));
    const ctx = L.ctx;
    const r = Math.hypot(cam.w, cam.h) * 0.62;
    const g = ctx.createRadialGradient(cam.w / 2, cam.h * 0.48, r * 0.35, cam.w / 2, cam.h * 0.48, r);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.7, 'rgba(5,6,8,0.28)');
    g.addColorStop(1, 'rgba(5,6,8,0.7)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, cam.w, cam.h);
    const t = ctx.createLinearGradient(0, 0, 0, cam.h * 0.22);
    t.addColorStop(0, 'rgba(8,9,12,0.25)');
    t.addColorStop(1, 'rgba(8,9,12,0)');
    ctx.fillStyle = t;
    ctx.fillRect(0, 0, cam.w, cam.h * 0.22);
    this.vignette = L;
  }

  buildGrain() {
    if (this.grain) return;
    const n = 192;
    const c = document.createElement('canvas');
    c.width = c.height = n;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(n, n);
    for (let i = 0; i < n * n; i++) {
      const v = 128 + (Math.random() - 0.5) * 255;
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
      img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    this.grain = c;
  }

  drawPost(ctx, t) {
    const cam = this.cam, d = cam.dpr;
    ctx.setTransform(d, 0, 0, d, 0, 0);
    ctx.drawImage(this.vignette.c, 0, 0, cam.w, cam.h);
    if (!this.grainPattern) this.grainPattern = ctx.createPattern(this.grain, 'repeat');
    ctx.save();
    ctx.globalAlpha = 0.07;
    ctx.globalCompositeOperation = 'overlay';
    const ox = (Math.random() * 192) | 0, oy = (Math.random() * 192) | 0;
    ctx.translate(-ox, -oy);
    ctx.fillStyle = this.grainPattern;
    ctx.fillRect(0, 0, cam.w + ox, cam.h + oy);
    ctx.restore();
  }

  // ---- hanging platform sign ---------------------------------------------

  buildSign(cam) {
    const z = 9.2;
    const box = { x0: 3.7, x1: 9.3, y0: 7.95, y1: 9.05 };
    this.signGeo = { z, box, cols: 118, rows: 17 };
    const s = cam.f / z;
    const pad = 20;
    const wCss = (box.x1 - box.x0) * s + pad * 2;
    const topY = cam.by(C, z);
    const hCss = cam.by(box.y0, z) - topY + pad;
    const L = makeLayer(wCss, Math.max(10, hCss), cam.dpr);
    const ctx = L.ctx;
    // local drawing: world plane with origin at box.x0 / ceiling
    const d = cam.dpr;
    ctx.setTransform(d * s, 0, 0, -d * s, d * (pad - box.x0 * s), d * (cam.by(0, z) - topY));
    // hangers
    ctx.fillStyle = '#1b1c1f';
    for (const hx of [box.x0 + 0.6, box.x1 - 0.6]) ctx.fillRect(hx - 0.04, box.y1, 0.08, C - box.y1 + 1);
    // housing
    ctx.beginPath();
    roundRectPath(ctx, box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0, 0.07);
    const g = ctx.createLinearGradient(0, box.y1, 0, box.y0);
    g.addColorStop(0, '#2e3035');
    g.addColorStop(0.08, '#141518');
    g.addColorStop(0.92, '#0e0f11');
    g.addColorStop(1, '#3a3c40');
    ctx.fillStyle = g;
    ctx.fill();
    // face
    const fx0 = box.x0 + 0.12, fx1 = box.x1 - 0.12, fy0 = box.y0 + 0.1, fy1 = box.y1 - 0.1;
    ctx.fillStyle = '#060607';
    ctx.fillRect(fx0, fy0, fx1 - fx0, fy1 - fy0);
    const { cols, rows } = this.signGeo;
    const pitch = Math.min((fx1 - fx0 - 0.1) / cols, (fy1 - fy0 - 0.08) / rows);
    const gx0 = (fx0 + fx1) / 2 - (cols * pitch) / 2;
    const gy1 = (fy0 + fy1) / 2 + (rows * pitch) / 2;
    ctx.fillStyle = '#26100b';
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        ctx.beginPath();
        ctx.arc(gx0 + (i + 0.5) * pitch, gy1 - (j + 0.5) * pitch, pitch * 0.32, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    this.sign = L;
    this.signPx = { pad, topY, s, pitch, gx0, gy1, wCss, hCss };
  }

  drawSign(ctx, grid) {
    const cam = this.cam, d = cam.dpr;
    const { z, box } = this.signGeo;
    const P = this.signPx;
    const dx = -cam.camX * cam.f / z + cam.ox;
    const dy = cam.dEye * cam.f / z + cam.oy;
    const left = cam.cx + box.x0 * P.s - P.pad + dx;
    const top = P.topY + dy;
    ctx.setTransform(d, 0, 0, d, 0, 0);
    ctx.drawImage(this.sign.c, left, top, this.sign.w, this.sign.h);
    if (!grid) return;
    // lit LEDs: bloom first, then crisp dots
    const ox = left + P.pad + (P.gx0 - box.x0) * P.s;
    const y0 = cam.by(P.gy1, z) + dy;
    const pitchPx = P.pitch * P.s;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(255,60,20,0.18)';
    for (let i = 0; i < grid.length; i++) {
      const col = grid[i];
      for (let j = 0; j < col.length; j++) {
        if (!col[j]) continue;
        ctx.fillRect(ox + i * pitchPx - pitchPx * 0.6, y0 + j * pitchPx - pitchPx * 0.6, pitchPx * 2.2, pitchPx * 2.2);
      }
    }
    ctx.restore();
    ctx.fillStyle = '#ff5a2a';
    const r = Math.max(0.6, pitchPx * 0.36);
    ctx.beginPath();
    for (let i = 0; i < grid.length; i++) {
      const col = grid[i];
      for (let j = 0; j < col.length; j++) {
        if (!col[j]) continue;
        const x = ox + (i + 0.5) * pitchPx, y = y0 + (j + 0.5) * pitchPx;
        ctx.moveTo(x + r, y);
        ctx.arc(x, y, r, 0, Math.PI * 2);
      }
    }
    ctx.fill();
  }

  // Compose two lines of text into the sign's dot grid. `scroll` (in columns) scrolls line 2.
  composeSign(l1left, l1right, l2, scroll = null) {
    const { cols, rows } = this.signGeo;
    const grid = Array.from({ length: cols }, () => new Array(rows).fill(false));
    const blit = (g, x0, y0) => {
      for (let i = 0; i < g.length; i++) {
        const x = x0 + i;
        if (x < 0 || x >= cols) continue;
        for (let j = 0; j < 7; j++) if (g[i][j]) grid[x][y0 + j] = true;
      }
    };
    blit(dotText(l1left), 1, 1);
    if (l1right) {
      const r = dotText(l1right);
      blit(r, cols - 1 - r.length, 1);
    }
    const t2 = dotText(l2);
    if (scroll === null) blit(t2, 1, 10);
    else blit(t2, cols - Math.floor(scroll) % (cols + t2.length), 10);
    return grid;
  }
}

function reflGradient(ctx, cam, offY) {
  const yE = cam.by(0, Z_EDGE) + offY;
  const yG = cam.by(0, Z_GRANITE) + offY;
  const yY = cam.by(0, Z_YELLOW) + offY;
  const yB = cam.h + MY + offY;
  const g = ctx.createLinearGradient(0, yE, 0, Math.max(yB, yY + 10));
  const n = (y) => Math.min(1, Math.max(0, (y - yE) / (Math.max(yB, yY + 10) - yE)));
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(n(yE + 1), 'rgba(0,0,0,0.16)');
  g.addColorStop(n(yG - 0.5), 'rgba(0,0,0,0.13)');
  g.addColorStop(n(yG + 0.5), 'rgba(0,0,0,0.12)');
  g.addColorStop(n(yY - 0.5), 'rgba(0,0,0,0.1)');
  g.addColorStop(n(yY + 0.5), 'rgba(0,0,0,0.34)');
  g.addColorStop(n(yY + (yB - yY) * 0.45), 'rgba(0,0,0,0.18)');
  g.addColorStop(1, 'rgba(0,0,0,0.05)');
  return g;
}

// ---------------------------------------------------------------------------
// Ceiling: slatted baffles running toward the viewer with fluorescent rows between.

function renderCeiling(L, cam) {
  const ctx = L.ctx, d = cam.dpr;
  ctx.setTransform(d, 0, 0, d, d * MX, d * MY);
  const top = -MY - 4, left = -MX, right = cam.w + MX;
  const yJ = cam.by(C, ZW);
  const zTop = cam.zAtRow(top, C);
  const R = rng(11);

  const base = ctx.createLinearGradient(0, top, 0, yJ);
  base.addColorStop(0, '#4c4d4c');
  base.addColorStop(1, '#2b2c2c');
  ctx.fillStyle = base;
  ctx.fillRect(left, top, right - left, yJ - top + 6);

  const rows = [];
  for (let z = 7.8; z < ZW - 1.5; z += 3.8) if (z > zTop) rows.push(z);

  // soft light pooled on the ceiling around each fixture row
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const z of rows) {
    const y1 = cam.by(C, z - 1.4), y2 = cam.by(C, z + 1.4);
    const g = ctx.createLinearGradient(0, y1, 0, y2);
    g.addColorStop(0, 'rgba(255,246,225,0)');
    g.addColorStop(0.5, 'rgba(255,246,225,0.16)');
    g.addColorStop(1, 'rgba(255,246,225,0)');
    ctx.fillStyle = g;
    ctx.fillRect(left, y1, right - left, y2 - y1);
  }
  ctx.restore();

  // baffles (perpendicular to track) hanging below the ceiling
  const drop = 0.45;
  const zNear = Math.max(1.5, zTop * 0.95);
  const xa = (left - cam.cx) * ZW / cam.f - 2, xb = (right - cam.cx) * ZW / cam.f + 2;
  for (let x = Math.floor(xa) ; x <= xb; x += 1) {
    const tf = [cam.bx(x, ZW), cam.by(C, ZW)];
    const tn = [cam.bx(x, zNear), cam.by(C, zNear)];
    const bn = [cam.bx(x, zNear), cam.by(C - drop, zNear)];
    const bf = [cam.bx(x, ZW), cam.by(C - drop, ZW)];
    ctx.beginPath();
    ctx.moveTo(...tf); ctx.lineTo(...tn); ctx.lineTo(...bn); ctx.lineTo(...bf); ctx.closePath();
    const g = ctx.createLinearGradient(0, top, 0, yJ);
    g.addColorStop(0, '#6d6e6b');
    g.addColorStop(1, '#3d3e3d');
    ctx.fillStyle = g;
    ctx.fill();
  }

  // fluorescent fixtures (parallel to the track), hung just below the baffles
  for (const z of rows) {
    const yc = C - drop - 0.05;
    const y1 = cam.by(yc, z - 0.3), y2 = cam.by(yc, z + 0.3);
    const lip = cam.by(yc - 0.2, z - 0.3);
    const xa2 = (left - cam.cx) * z / cam.f, xb2 = (right - cam.cx) * z / cam.f;
    for (let x = Math.floor(xa2 / 4.6) * 4.6; x < xb2; x += 4.6) {
      const sx0 = cam.bx(x + 0.08, z), sx1 = cam.bx(x + 4.52, z);
      const dim = R() < 0.05 ? 0.5 : 1;
      // housing
      ctx.fillStyle = '#7d7e7b';
      ctx.fillRect(sx0 - 1, y1, sx1 - sx0 + 2, lip - y1);
      ctx.fillStyle = '#2a2b2b';
      ctx.fillRect(sx1, y1, cam.bx(x + 4.6, z) - sx1, y2 - y1);
      // diffuser (overexposed core)
      ctx.fillStyle = `rgba(255,252,240,${dim})`;
      ctx.fillRect(sx0, y1, sx1 - sx0, y2 - y1);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(255,240,210,${0.35 * dim})`;
      ctx.fillRect(sx0 - 2, y1 - 2, sx1 - sx0 + 4, y2 - y1 + 4);
      ctx.restore();
    }
    // bloom
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const cy = (y1 + y2) / 2, hh = Math.max(4, (y2 - y1) * 4.5);
    const g = ctx.createLinearGradient(0, cy - hh, 0, cy + hh);
    g.addColorStop(0, 'rgba(255,248,230,0)');
    g.addColorStop(0.5, 'rgba(255,248,230,0.4)');
    g.addColorStop(1, 'rgba(255,248,230,0)');
    ctx.fillStyle = g;
    ctx.fillRect(left, cy - hh, right - left, hh * 2);
    ctx.restore();
  }

  // shadow where ceiling meets wall
  const sh = ctx.createLinearGradient(0, yJ - 24 * cam.k, 0, yJ);
  sh.addColorStop(0, 'rgba(8,9,10,0)');
  sh.addColorStop(1, 'rgba(8,9,10,0.6)');
  ctx.fillStyle = sh;
  ctx.fillRect(left, yJ - 24 * cam.k, right - left, 24 * cam.k + 6);
}

// ---------------------------------------------------------------------------
// Far trackside wall: concrete, poster frames, cream panels, navy name band.

function renderWall(L, cam) {
  const ctx = L.ctx, d = cam.dpr;
  const s = cam.f / ZW;
  const toWorld = () => ctx.setTransform(d * s, 0, 0, -d * s, d * (MX + cam.cx), d * (MY + cam.hy + E * s));
  const toScreen = () => ctx.setTransform(d, 0, 0, d, d * MX, d * MY);
  toWorld();
  const xa = (-MX - cam.cx) / s - 2, xb = (cam.w + MX - cam.cx) / s + 2;
  const R = rng(7);

  // concrete base
  ctx.fillStyle = '#3a3833';
  ctx.fillRect(xa, TRENCH_Y - 0.2, xb - xa, 3.3);
  // poster zone backing
  ctx.fillStyle = '#4a4740';
  ctx.fillRect(xa, -1.9, xb - xa, 5.9);
  // cream panels
  ctx.fillStyle = '#ddd4bf';
  ctx.fillRect(xa, 4.0, xb - xa, BAND0 - 4.0);
  // navy band
  ctx.fillStyle = '#1a2a57';
  ctx.fillRect(xa, BAND0, xb - xa, BAND1 - BAND0);
  // top trim
  ctx.fillStyle = '#1f2227';
  ctx.fillRect(xa, BAND1, xb - xa, C - BAND1 + 0.2);

  // soft stains (drawn blurred so they read as weathering, not stripes)
  ctx.save();
  if ('filter' in ctx) ctx.filter = `blur(${Math.max(1, 0.25 * s * d)}px)`;
  for (let i = 0; i < (xb - xa) * 0.5; i++) {
    const x = xa + R() * (xb - xa);
    const w = 0.15 + R() * 0.9;
    const h = 0.8 + R() * 3.5;
    const g = ctx.createLinearGradient(0, 4.1, 0, 4.1 + h);
    g.addColorStop(0, `rgba(70,58,40,${0.03 + R() * 0.04})`);
    g.addColorStop(1, 'rgba(70,58,40,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, 4.1, w, h);
  }
  for (let i = 0; i < 10; i++) {
    const x = xa + R() * (xb - xa);
    ctx.fillStyle = `rgba(90,80,60,${0.015 + R() * 0.025})`;
    ctx.beginPath();
    ctx.ellipse(x, 4.5 + R() * 5, 1 + R() * 3, 0.6 + R() * 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < (xb - xa) * 1.5; i++) {
    const x = xa + R() * (xb - xa);
    ctx.fillStyle = `rgba(0,0,0,${0.05 + R() * 0.1})`;
    ctx.fillRect(x, TRENCH_Y, 0.08 + R() * 0.4, 0.5 + R() * 2.2);
  }
  ctx.restore();

  // panel joints
  ctx.strokeStyle = 'rgba(90,80,62,0.3)';
  ctx.lineWidth = 0.035;
  for (let x = Math.floor(xa / 4) * 4; x < xb; x += 4) {
    ctx.beginPath(); ctx.moveTo(x, 4.0); ctx.lineTo(x, BAND0); ctx.stroke();
  }
  for (const y of [6.3, 8.6]) { ctx.beginPath(); ctx.moveTo(xa, y); ctx.lineTo(xb, y); ctx.stroke(); }
  // band edge highlights
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.fillRect(xa, BAND1 - 0.05, xb - xa, 0.05);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(xa, BAND0 - 0.03, xb - xa, 0.06);

  // conduits along the base
  for (const [y, w, c] of [[-2.6, 0.22, '#55534d'], [-2.2, 0.14, '#4a4843'], [-3.2, 0.3, '#2e2d29']]) {
    ctx.fillStyle = c;
    ctx.fillRect(xa, y, xb - xa, w);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(xa, y + w * 0.65, xb - xa, w * 0.15);
  }

  // lighting falloff: ceiling rows above the track wash the upper wall
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  const lg = ctx.createLinearGradient(0, C, 0, TRENCH_Y);
  lg.addColorStop(0, 'rgb(170,170,172)');
  lg.addColorStop(0.1, 'rgb(250,248,244)');
  lg.addColorStop(0.35, 'rgb(236,232,224)');
  lg.addColorStop(0.62, 'rgb(170,166,160)');
  lg.addColorStop(0.8, 'rgb(120,118,114)');
  lg.addColorStop(1, 'rgb(60,60,60)');
  ctx.fillStyle = lg;
  ctx.fillRect(xa, TRENCH_Y - 0.2, xb - xa, C - TRENCH_Y + 0.4);
  ctx.restore();

  // poster frames (backlit, so drawn after the falloff)
  const pitch = 13;
  let idx = 0;
  const startJ = Math.floor(xa / pitch) - 1;
  for (let j = startJ; j * pitch < xb + pitch; j++, idx++) {
    const xc = j * pitch;
    drawFrame(ctx, cam, xc, j, toWorld, toScreen, s);
  }

  toScreen();
  // conduits and a cable tray running along the top of the far wall
  const pipe = (y, z, r, c) => {
    const left = -MX, right = cam.w + MX;
    const y1 = cam.by(y + r, z), y2 = cam.by(y - r, z);
    const g = ctx.createLinearGradient(0, y1, 0, y2);
    g.addColorStop(0, c[0]);
    g.addColorStop(0.35, c[1]);
    g.addColorStop(1, c[2]);
    ctx.fillStyle = g;
    ctx.fillRect(left, y1, right - left, y2 - y1);
  };
  pipe(C - 0.55, ZW - 0.8, 0.22, ['#6b6d6c', '#8d8f8d', '#2b2c2c']);
  pipe(C - 0.5, ZW - 1.5, 0.12, ['#5c5e5e', '#7c7e7e', '#252626']);
  pipe(C - 1.0, ZW - 0.5, 0.16, ['#4b4d4d', '#6b6d6d', '#1d1e1e']);

  // station name on the band
  toScreen();
  ctx.fillStyle = '#f3f2ec';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const fontPx = 1.85 * s;
  ctx.font = `500 ${fontPx}px ${FONT}`;
  for (let x = -56; x <= 56; x += 56) {
    ctx.fillText(CONFIG.station, cam.bx(x, ZW), cam.by((BAND0 + BAND1) / 2 - 0.05, ZW));
  }
}

function drawFrame(ctx, cam, xc, j, toWorld, toScreen, s) {
  toWorld();
  const fx0 = xc - 6.1, fy0 = -1.5, fw = 12.2, fh = 5.2;
  ctx.fillStyle = '#161513';
  ctx.fillRect(fx0, fy0, fw, fh);
  ctx.strokeStyle = '#34322e';
  ctx.lineWidth = 0.08;
  ctx.strokeRect(fx0 + 0.12, fy0 + 0.12, fw - 0.24, fh - 0.24);
  const n = CONFIG.posters.length;
  for (let k = 0; k < 2; k++) {
    const i = (((j * 2 + k) % n) + n) % n;
    const px = xc + (k ? 0.3 : -5.75), py = -1.0, pw = 5.45, ph = 4.25;
    drawPoster(ctx, cam, CONFIG.posters[i], i, px, py, pw, ph, toWorld, toScreen, s);
  }
  // small plate under frame
  toWorld();
  ctx.fillStyle = '#8d8a82';
  ctx.fillRect(xc - 0.5, fy0 + 0.15, 1, 0.14);
}

function drawPoster(ctx, cam, p, i, x, y, w, h, toWorld, toScreen, s) {
  toWorld();
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  const hue = p.hue;
  const variant = i % 3;
  ctx.fillStyle = hsl(hue, 42, variant === 1 ? 20 : 58);
  ctx.fillRect(x, y, w, h);
  if (variant === 0) {
    ctx.fillStyle = hsl(hue + 180, 45, 48);
    ctx.beginPath(); ctx.arc(x + w * 0.66, y + h * 0.6, h * 0.42, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = hsl(hue + 30, 60, 86);
    for (let k = 0; k < 5; k++) ctx.fillRect(x, y + h * (0.08 + k * 0.09), w * 0.5, h * 0.035);
  } else if (variant === 1) {
    ctx.fillStyle = hsl(hue, 50, 52);
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + h * 0.9); ctx.closePath(); ctx.fill();
    ctx.fillStyle = hsl(hue + 40, 70, 68);
    ctx.beginPath(); ctx.arc(x + w * 0.78, y + h * 0.25, h * 0.14, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.lineWidth = h * 0.06;
    for (let k = 0; k < 6; k++) {
      ctx.strokeStyle = hsl(hue + k * 18, 52, 38 + k * 8);
      ctx.beginPath(); ctx.arc(x + w * 0.5, y, h * (0.2 + k * 0.12), 0, Math.PI); ctx.stroke();
    }
  }
  // lightbox falloff + inner shadow from the frame lip
  const lb = ctx.createLinearGradient(0, y + h, 0, y);
  lb.addColorStop(0, 'rgba(0,0,0,0.28)');
  lb.addColorStop(0.12, 'rgba(0,0,0,0.05)');
  lb.addColorStop(0.8, 'rgba(0,0,0,0.0)');
  lb.addColorStop(1, 'rgba(0,0,0,0.25)');
  ctx.fillStyle = lb;
  ctx.fillRect(x, y, w, h);
  // glass sheen
  const g = ctx.createLinearGradient(x, y + h, x + w, y);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.0)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.13)');
  g.addColorStop(0.75, 'rgba(255,255,255,0.03)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  ctx.restore();

  toScreen();
  const dark = variant === 1;
  ctx.fillStyle = dark ? '#f6f1e6' : '#15171c';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `700 ${0.95 * s}px ${FONT}`;
  ctx.fillText(p.kicker, cam.bx(x + 0.3, ZW), cam.by(y + h - 1.05, ZW));
  ctx.font = `600 ${0.42 * s}px ${FONT}`;
  ctx.fillText(p.title, cam.bx(x + 0.3, ZW), cam.by(y + 0.35, ZW));
}

// ---------------------------------------------------------------------------
// Trackbed: concrete invert, the far running rail and the covered third rail.

function renderTrench(L, cam) {
  const ctx = L.ctx, d = cam.dpr;
  ctx.setTransform(d, 0, 0, d, d * MX, d * MY);
  const left = -MX, right = cam.w + MX;
  const yTop = cam.by(TRENCH_Y, ZW) - 3;
  const yBot = cam.by(0, Z_EDGE) + 40;
  const R = rng(5);

  const g = ctx.createLinearGradient(0, yTop, 0, yBot);
  g.addColorStop(0, '#34312b');
  g.addColorStop(0.5, '#24221e');
  g.addColorStop(1, '#0d0c0b');
  ctx.fillStyle = g;
  ctx.fillRect(left, yTop, right - left, yBot - yTop);

  const band = (y1, y2, fill) => { ctx.fillStyle = fill; ctx.fillRect(left, Math.min(y1, y2), right - left, Math.abs(y2 - y1)); };
  const hStrip = (y, z1, z2, fill) => band(cam.by(y, z1), cam.by(y, z2), fill);
  const vFace = (z, y1, y2, fill) => band(cam.by(y1, z), cam.by(y2, z), fill);
  const xRangeAt = (z) => [(left - cam.cx) * z / cam.f - 1, (right - cam.cx) * z / cam.f + 1];

  // debris / stains on the invert
  for (let i = 0; i < 500; i++) {
    const z = GEO.zTrain + R() * (ZW - GEO.zTrain);
    const [a, b] = xRangeAt(z);
    const x = a + R() * (b - a);
    const sx = cam.bx(x, z), sy = cam.by(TRENCH_Y, z);
    ctx.fillStyle = R() < 0.5 ? 'rgba(0,0,0,0.25)' : 'rgba(150,140,120,0.12)';
    ctx.fillRect(sx, sy, (0.1 + R() * 0.5) * cam.f / z, 0.05 * cam.f / z);
  }

  for (const rz of [...GEO.railZ].reverse()) {
    // concrete plinth
    vFace(rz - 0.55, TRENCH_Y + 0.18, TRENCH_Y, '#3b3833');
    hStrip(TRENCH_Y + 0.18, rz - 0.55, rz + 0.55, '#45423b');
    // fasteners
    const [a, b] = xRangeAt(rz);
    for (let x = Math.floor(a / 2.5) * 2.5; x < b; x += 2.5) {
      const sx0 = cam.bx(x - 0.35, rz - 0.4), sx1 = cam.bx(x + 0.35, rz - 0.4);
      ctx.fillStyle = '#1a1917';
      ctx.fillRect(sx0, cam.by(TRENCH_Y + 0.32, rz - 0.4), sx1 - sx0, cam.by(TRENCH_Y + 0.18, rz - 0.4) - cam.by(TRENCH_Y + 0.32, rz - 0.4));
    }
    // rail web + head
    vFace(rz - 0.1, -GEO.trackDrop - 0.12, TRENCH_Y + 0.18, '#3a2b22');
    vFace(rz - 0.12, -GEO.trackDrop, -GEO.trackDrop - 0.14, '#6d6a64');
    hStrip(-GEO.trackDrop, rz - 0.12, rz + 0.12, '#d8dcde');
  }

  // third rail with coverboard, on the far side
  const tz = GEO.thirdRailZ;
  const [a3, b3] = xRangeAt(tz);
  for (let x = Math.floor(a3 / 7) * 7; x < b3; x += 7) {
    const sx0 = cam.bx(x - 0.15, tz - 0.3), sx1 = cam.bx(x + 0.15, tz - 0.3);
    ctx.fillStyle = '#6a6559';
    ctx.fillRect(sx0, cam.by(-GEO.trackDrop + 0.55, tz - 0.3), sx1 - sx0, cam.by(TRENCH_Y + 0.1, tz - 0.3) - cam.by(-GEO.trackDrop + 0.55, tz - 0.3));
  }
  vFace(tz - 0.2, -GEO.trackDrop + 0.2, -GEO.trackDrop - 0.25, '#4d4b47');
  vFace(tz - 0.55, -GEO.trackDrop + 0.62, -GEO.trackDrop + 0.5, '#6e6348');
  hStrip(-GEO.trackDrop + 0.62, tz - 0.55, tz + 0.5, '#9a8a62');

  // deep shadow under the platform lip
  const sh = ctx.createLinearGradient(0, cam.by(TRENCH_Y, GEO.zTrain + 3), 0, cam.by(0, Z_EDGE));
  sh.addColorStop(0, 'rgba(0,0,0,0)');
  sh.addColorStop(1, 'rgba(0,0,0,0.7)');
  ctx.fillStyle = sh;
  ctx.fillRect(left, cam.by(TRENCH_Y, GEO.zTrain + 3), right - left, cam.by(0, Z_EDGE) - cam.by(TRENCH_Y, GEO.zTrain + 3) + 40);
}

// ---------------------------------------------------------------------------
// Platform: granite edge, yellow truncated-dome strip, glossy tile field.

function renderFloor(L, cam) {
  const ctx = L.ctx, d = cam.dpr;
  ctx.setTransform(d, 0, 0, d, d * MX, d * MY);
  const left = -MX, right = cam.w + MX, bottom = cam.h + MY;
  const R = rng(3);
  const yE = cam.by(0, Z_EDGE), yG = cam.by(0, Z_GRANITE), yY = cam.by(0, Z_YELLOW);
  const zBot = cam.zAtRow(bottom, 0);
  const P = (x, z) => [cam.bx(x, z), cam.by(0, z)];
  const xRangeAt = (z) => [(left - cam.cx) * z / cam.f - 2, (right - cam.cx) * z / cam.f + 2];

  // --- tiles
  ctx.fillStyle = '#c9c7c0';
  ctx.fillRect(left, yY, right - left, bottom - yY);
  const T = 2;
  for (let k = 0; ; k++) {
    const z0 = Z_YELLOW - k * T;
    const z1 = Math.max(Z_YELLOW - (k + 1) * T, zBot * 0.9);
    if (z0 <= zBot * 0.9) break;
    const [a, b] = xRangeAt(z1);
    for (let x = Math.floor((a - 1) / T) * T + 1; x < b; x += T) {
      const q = [P(x, z0), P(x + T, z0), P(x + T, z1), P(x, z1)];
      ctx.beginPath();
      ctx.moveTo(...q[0]); ctx.lineTo(...q[1]); ctx.lineTo(...q[2]); ctx.lineTo(...q[3]); ctx.closePath();
      const l = 76 + R() * 6;
      ctx.fillStyle = hsl(40 + R() * 10, 5 + R() * 3, l);
      ctx.fill();
      // terrazzo speckle
      for (let i = 0; i < 70; i++) {
        const zz = z1 + R() * (z0 - z1), xx = x + R() * T;
        const r = Math.max(0.35, 0.018 * cam.f / zz);
        const [sx, sy] = P(xx, zz);
        ctx.fillStyle = R() < 0.6 ? `rgba(70,66,60,${0.2 + R() * 0.3})` : `rgba(255,255,250,${0.3 + R() * 0.3})`;
        ctx.fillRect(sx, sy, r, r * E / zz);
      }
    }
    if (z1 <= zBot * 0.9) break;
  }
  // grout
  ctx.fillStyle = 'rgba(120,116,108,0.55)';
  for (let z = Z_YELLOW - T; z > zBot * 0.9; z -= T) {
    const y1 = cam.by(0, z + 0.025), y2 = cam.by(0, z - 0.025);
    ctx.fillRect(left, y1, right - left, Math.max(0.6, y2 - y1));
  }
  {
    const [a, b] = xRangeAt(zBot * 0.9);
    for (let x = Math.floor((a - 1) / T) * T + 1; x < b; x += T) {
      const zf = Z_YELLOW, zn = zBot * 0.9;
      ctx.beginPath();
      ctx.moveTo(...P(x - 0.025, zf)); ctx.lineTo(...P(x + 0.025, zf));
      ctx.lineTo(...P(x + 0.025, zn)); ctx.lineTo(...P(x - 0.025, zn)); ctx.closePath();
      ctx.fill();
    }
  }
  // scuffs & foot-traffic haze
  for (let i = 0; i < 90; i++) {
    const z = zBot + R() * (Z_YELLOW - zBot);
    const [a, b] = xRangeAt(z);
    const [sx, sy] = P(a + R() * (b - a), z);
    const r = (0.6 + R() * 2.5) * cam.f / z;
    const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
    g.addColorStop(0, `rgba(80,74,64,${0.04 + R() * 0.05})`);
    g.addColorStop(1, 'rgba(80,74,64,0)');
    ctx.fillStyle = g;
    ctx.save(); ctx.translate(sx, sy); ctx.scale(1, E / z); ctx.translate(-sx, -sy);
    ctx.fillRect(sx - r, sy - r, r * 2, r * 2);
    ctx.restore();
  }

  // --- yellow detectable warning strip
  const yg = ctx.createLinearGradient(0, yG, 0, yY);
  yg.addColorStop(0, '#c99a0c');
  yg.addColorStop(1, '#e0ae14');
  ctx.fillStyle = yg;
  ctx.fillRect(left, yG, right - left, yY - yG);
  const pitch = 0.2;
  const shadows = new Path2D(), domes = new Path2D(), hi = new Path2D();
  for (let zc = Z_GRANITE - pitch / 2; zc > Z_YELLOW; zc -= pitch) {
    const [a, b] = xRangeAt(zc);
    const rx = 0.068 * cam.f / zc, ry = rx * E / zc;
    for (let x = Math.floor(a / pitch) * pitch + pitch / 2; x < b; x += pitch) {
      const [sx, sy] = P(x, zc);
      shadows.moveTo(sx + rx, sy + ry * 0.45);
      shadows.ellipse(sx, sy + ry * 0.45, rx, ry, 0, 0, Math.PI * 2);
      domes.moveTo(sx + rx, sy);
      domes.ellipse(sx, sy, rx, ry, 0, 0, Math.PI * 2);
      hi.moveTo(sx - rx * 0.15 + rx * 0.42, sy - ry * 0.35);
      hi.ellipse(sx - rx * 0.15, sy - ry * 0.35, rx * 0.42, ry * 0.38, 0, 0, Math.PI * 2);
    }
  }
  ctx.fillStyle = 'rgba(110,80,0,0.55)';
  ctx.fill(shadows);
  ctx.fillStyle = '#efbf22';
  ctx.fill(domes);
  ctx.fillStyle = 'rgba(255,240,180,0.75)';
  ctx.fill(hi);
  // grime on the strip
  for (let i = 0; i < 160; i++) {
    const z = Z_YELLOW + R() * (Z_GRANITE - Z_YELLOW);
    const [a, b] = xRangeAt(z);
    const [sx, sy] = P(a + R() * (b - a), z);
    const r = (0.2 + R() * 1.2) * cam.f / z;
    const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
    g.addColorStop(0, `rgba(60,45,10,${0.06 + R() * 0.1})`);
    g.addColorStop(1, 'rgba(60,45,10,0)');
    ctx.fillStyle = g;
    ctx.fillRect(sx - r, sy - r, r * 2, r * 2);
  }

  // --- granite edge
  const gg = ctx.createLinearGradient(0, yE, 0, yG);
  gg.addColorStop(0, '#9e9b93');
  gg.addColorStop(0.35, '#cfccc3');
  gg.addColorStop(1, '#d6d3ca');
  ctx.fillStyle = gg;
  ctx.fillRect(left, yE, right - left, yG - yE);
  for (let i = 0; i < 1400; i++) {
    const z = Z_GRANITE + R() * (Z_EDGE - Z_GRANITE);
    const [a, b] = xRangeAt(z);
    const [sx, sy] = P(a + R() * (b - a), z);
    ctx.fillStyle = R() < 0.5 ? 'rgba(60,58,54,0.35)' : 'rgba(255,255,255,0.4)';
    ctx.fillRect(sx, sy, 1, 0.8);
  }
  // paver joints
  ctx.strokeStyle = 'rgba(80,76,70,0.5)';
  ctx.lineWidth = 0.8;
  {
    const [a, b] = xRangeAt(Z_GRANITE);
    for (let x = Math.floor(a / 3) * 3; x < b; x += 3) {
      ctx.beginPath(); ctx.moveTo(...P(x, Z_EDGE)); ctx.lineTo(...P(x, Z_GRANITE)); ctx.stroke();
    }
  }
  // seams between bands
  ctx.fillStyle = 'rgba(40,36,30,0.6)';
  ctx.fillRect(left, yG - 0.5, right - left, 1.2);
  ctx.fillRect(left, yY - 0.5, right - left, 1.4);
  // nosing: dark lip then a bright bevel catch-light
  ctx.fillStyle = 'rgba(20,18,16,0.85)';
  ctx.fillRect(left, yE - 1.2, right - left, 1.6);
  ctx.fillStyle = 'rgba(255,255,248,0.55)';
  ctx.fillRect(left, yE + 0.6, right - left, 1);

  // overall light falloff toward the viewer (lights are overhead, a bit ahead of us)
  const lf = ctx.createLinearGradient(0, yE, 0, bottom);
  lf.addColorStop(0, 'rgba(0,0,0,0)');
  lf.addColorStop(0.6, 'rgba(0,0,0,0.05)');
  lf.addColorStop(1, 'rgba(0,0,0,0.3)');
  ctx.fillStyle = lf;
  ctx.fillRect(left, yE, right - left, bottom - yE);
}

export const ZONES = { Z_EDGE, Z_GRANITE, Z_YELLOW, TRENCH_Y };
