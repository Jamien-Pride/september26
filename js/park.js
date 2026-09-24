import * as THREE from 'three';
import { planToWorld, planPxToWorld, worldToPlan, PLAN, toLocal } from './geo.js';
import { facadeMaterial, prism } from './facade.js';

// Cityside Park, laid out from the landscape plan in the proposal (plan pixels,
// ~0.25 m each, bay at the bottom), rotated onto Treasure Island's real west
// seawall. Ground materials are painted into a splat map and shaded
// procedurally so edges stay crisp at 10–20 cm scale.

const U0 = -400, U1 = 400, V0 = -260, V1 = 140; // plan metres covered by the ground
const CW = 4096, CH = 2048;
const px2u = (px) => (px - PLAN.originPx[0]) * PLAN.scale;
const py2v = (py) => (py - PLAN.originPx[1]) * PLAN.scale;
const toC = (px, py) => [(px2u(px) - U0) / (U1 - U0) * CW, (py2v(py) - V0) / (V1 - V0) * CH];
const M = CW / (U1 - U0); // canvas px per metre

// ---- Plan geometry (plan pixel coordinates) ---------------------------------
export const LAYOUT = {
  vRiprapTop: py2v(992), vWater: py2v(1046),
  promenade: (px) => px < 650 ? 925 : px > 1050 ? 862 : 925 - (63 * (1 - Math.cos(Math.PI * (px - 650) / 400)) / 2),
  road: { top: 492, bottom: 533 }, median: [538, 556], lane: [558, 586], sidewalkTop: [462, 490], sidewalkPark: [590, 600],
  lawn: [[255, 862], [262, 800], [300, 752], [360, 722], [440, 700], [520, 674], [575, 664], [630, 653], [690, 650], [735, 672], [758, 730], [758, 780], [735, 830], [690, 876], [630, 904], [560, 910], [420, 910], [300, 906], [262, 890]],
  paths: [
    { w: 3.2, pts: [[182, 778], [240, 746], [330, 708], [430, 676], [526, 663], [573, 652], [620, 641], [672, 614], [722, 596]] },
    { w: 3.2, pts: [[690, 600], [800, 600], [930, 602], [985, 614], [1010, 652], [1020, 702], [1014, 760], [1000, 812], [992, 860]] },
    { w: 3.0, pts: [[976, 640], [950, 672], [912, 718], [868, 760], [800, 810], [740, 850], [684, 884], [640, 908]] },
    { w: 7.0, pts: [[96, 596], [150, 750], [214, 912]] },
    { w: 3.0, pts: [[1100, 600], [1160, 700], [1215, 830], [1230, 860]] },
    { w: 3.0, pts: [[-300, 600], [-200, 700], [-120, 860], [-100, 912]] },
    { w: 3.0, pts: [[1600, 600], [1700, 720], [1760, 900]] },
  ],
  // planted berms (height in m) – mounded native planting
  berms: [
    { pts: [[120, 604], [700, 600], [640, 624], [520, 646], [420, 662], [320, 700], [230, 740], [170, 760]], h: 1.2 },
    { pts: [[770, 612], [960, 612], [990, 660], [900, 700], [830, 760], [760, 820], [720, 800], [760, 740], [770, 680]], h: 1.4 },
    { pts: [[1015, 640], [1080, 612], [1090, 700], [1050, 800], [1010, 830], [1030, 720]], h: 0.9 },
    { pts: [[-600, 606], [60, 606], [40, 700], [-100, 760], [-400, 720]], h: 1.1 },
  ],
  courtyards: [
    [[50, 225], [360, 225], [360, 262], [50, 262]],
    [[660, 140], [1000, 140], [1000, 455], [890, 455], [890, 350], [660, 350]],
    [[1130, 262], [1480, 262], [1480, 352], [1130, 352]],
  ],
  buildings: [
    { pts: [[0, 140], [410, 140], [410, 205], [0, 205]], h: 21 },
    { pts: [[5, 285], [100, 270], [150, 390], [185, 350], [330, 350], [330, 270], [410, 270], [410, 445], [60, 445]], h: 21 },
    { pts: [[480, 355], [830, 355], [890, 398], [890, 445], [480, 445]], h: 17 },
    { pts: [[500, 150], [637, 150], [637, 358], [500, 358]], h: 23 },
    { pts: [[380, 15], [640, 15], [640, 65], [380, 65]], h: 24 },
    { pts: [[-40, -20], [300, -20], [300, 60], [-40, 60]], h: 20 },
    { pts: [[955, 0], [1170, 0], [1170, 130], [1010, 130]], h: 24 },
    { pts: [[1175, 0], [1310, 0], [1310, 122], [1175, 122]], h: 26 },
    { pts: [[1030, 215], [1488, 215], [1488, 262], [1030, 262]], h: 22 },
    { pts: [[1110, 352], [1488, 352], [1488, 445], [1110, 445]], h: 22 },
    { pts: [[1400, -20], [1560, -20], [1560, 70], [1400, 70]], h: 20 },
    { pts: [[-420, 140], [-60, 140], [-60, 440], [-420, 440]], h: 19 },
    { pts: [[1560, 140], [1900, 140], [1900, 440], [1560, 440]], h: 19 },
  ],
  palms: [195, 262, 330, 393, 488, 540, 596, 662, 733, 797, 862, 930, 995, 1060, 1125, 1190, 1255, 1320, 1385, 1450, 130, 65, 0, -65, -130, -195, -260],
  oaks: [[225, 628], [300, 652], [362, 626], [428, 614], [505, 606], [160, 655], [255, 704], [395, 764], [340, 792],
    [636, 706], [690, 694], [604, 738], [796, 642], [872, 628], [944, 652], [818, 762], [768, 706], [856, 704], [905, 762],
    [312, 894], [1100, 650], [1300, 652], [1430, 706], [1062, 790], [-40, 640], [-120, 700], [-220, 650], [1560, 660], [1650, 700]],
  benches: [[470, 668, 18], [300, 916, 0], [520, 916, 0], [760, 911, 0], [980, 866, -10], [880, 606, 0]],
  poles: [[440, 676], [680, 614], [300, 718], [200, 768], [820, 606], [990, 640], [1016, 760], [930, 694], [780, 830],
    [160, 918], [360, 918], [560, 918], [760, 914], [960, 876], [1160, 862], [1360, 862], [-40, 918], [-240, 918]],
};

// Is world point inside the modelled park ground (so the DEM mesh can yield)?
export function parkExclusion(x, z) {
  const { u, v } = worldToPlan(x, z);
  return u > U0 + 4 && u < U1 - 4 && v > V0 + 4 && v < V1 - 8;
}

function polyPath(ctx, pts) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => { const [cx, cy] = toC(x, y); if (i) ctx.lineTo(cx, cy); else ctx.moveTo(cx, cy); });
  ctx.closePath();
}
function strokePath(ctx, pts, wM) {
  ctx.beginPath();
  pts.forEach(([x, y], i) => { const [cx, cy] = toC(x, y); if (i) ctx.lineTo(cx, cy); else ctx.moveTo(cx, cy); });
  ctx.lineWidth = wM * M; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.stroke();
}
function band(ctx, py0, py1, pxA = -1100, pxB = 2300) {
  const [ax, ay] = toC(pxA, py0), [bx, by] = toC(pxB, py1);
  ctx.fillRect(Math.min(ax, bx), Math.min(ay, by), Math.abs(bx - ax), Math.abs(by - ay));
}
function curveBand(ctx, fnTop, fnBot, pxA = -1100, pxB = 2300) {
  ctx.beginPath();
  for (let px = pxA; px <= pxB; px += 10) { const [x, y] = toC(px, fnTop(px)); if (px === pxA) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
  for (let px = pxB; px >= pxA; px -= 10) { const [x, y] = toC(px, fnBot(px)); ctx.lineTo(x, y); }
  ctx.closePath(); ctx.fill();
}
function mk(w = CW, h = CH) { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d', { willReadFrequently: true }); x.fillStyle = '#000'; x.fillRect(0, 0, w, h); x.fillStyle = '#fff'; x.strokeStyle = '#fff'; return [c, x]; }

export function buildSplat() {
  const L = LAYOUT;
  // --- surface class masks
  const [cPave, xPave] = mk(), [cLawn, xLawn] = mk(), [cPlant, xPlant] = mk(), [cDG, xDG] = mk();
  const [cConc, xConc] = mk(), [cMark, xMark] = mk(), [cBerm, xBerm] = mk(CW / 4, CH / 4);
  const prom = L.promenade;
  // inland urban blocks: concrete plazas & sidewalks
  band(xPave, -800, L.road.top); band(xConc, -800, L.road.top);
  xPave.fillStyle = xConc.fillStyle = '#000';
  for (const c of L.courtyards) { polyPath(xPave, c); xPave.fill(); polyPath(xConc, c); xConc.fill(); }
  xPave.fillStyle = xConc.fillStyle = '#fff';
  for (const c of L.courtyards) { polyPath(xPlant, c); xPlant.fill(); }
  // road asphalt, median, bike lane, sidewalks
  band(xPave, L.road.top, L.road.bottom); band(xPave, L.lane[0], L.lane[1]);
  band(xPlant, L.median[0], L.median[1]);
  band(xPave, L.road.bottom, L.median[0]); band(xConc, L.road.bottom, L.median[0]);
  band(xPave, L.median[1], L.lane[0]); band(xConc, L.median[1], L.lane[0]);
  band(xPave, L.sidewalkTop[0], L.sidewalkTop[1] + 2); band(xConc, L.sidewalkTop[0], L.sidewalkTop[1] + 2);
  band(xPave, L.sidewalkPark[0] - 4, L.sidewalkPark[1]); band(xConc, L.sidewalkPark[0] - 4, L.sidewalkPark[1]);
  // park interior: planting by default, lawn on top
  curveBand(xPlant, () => L.sidewalkPark[1], (px) => prom(px) - 18);
  xPlant.fillStyle = '#000'; polyPath(xPlant, L.lawn); xPlant.fill(); xPlant.fillStyle = '#fff';
  polyPath(xLawn, L.lawn); xLawn.fill();
  // secondary lawns beyond the plan edges
  for (const poly of [
    [[1040, 760], [1480, 700], [1488, 840], [1060, 850]], [[1120, 620], [1480, 620], [1480, 690], [1150, 690]],
    [[-700, 760], [-160, 740], [-140, 890], [-700, 900]], [[1500, 620], [2200, 620], [2200, 850], [1520, 850]],
    [[-40, 720], [80, 700], [120, 880], [-20, 890]],
  ]) {
    xLawn.beginPath(); polyPath(xLawn, poly); xLawn.fill();
    xPlant.fillStyle = '#000'; polyPath(xPlant, poly); xPlant.fill(); xPlant.fillStyle = '#fff';
  }
  // promenade: paved bike/walk trail + decomposed-granite strip
  curveBand(xPave, (px) => prom(px) - 18, (px) => prom(px) + 1); curveBand(xConc, (px) => prom(px) - 18, (px) => prom(px) + 1);
  curveBand(xDG, (px) => prom(px) + 1, (px) => prom(px) + 23);
  xPlant.fillStyle = '#000'; curveBand(xPlant, (px) => prom(px) - 18, (px) => prom(px) + 23); xPlant.fillStyle = '#fff';
  // dune planting between promenade and riprap
  curveBand(xPlant, (px) => prom(px) + 23, () => 992);
  curveBand(xDG, (px) => prom(px) + 23, () => 992);
  // park paths (concrete)
  for (const p of L.paths) {
    strokePath(xPave, p.pts, p.w); strokePath(xConc, p.pts, p.w);
    for (const x of [xLawn, xPlant]) { x.strokeStyle = '#000'; strokePath(x, p.pts, p.w + 0.1); x.strokeStyle = '#fff'; }
  }
  // sculpture pad: 20' x 10' flush concrete, long side along the path
  // (drawn by the sculpture itself; keep ground under it paved)
  // markings: centre line (double yellow), edge lines, crosswalks, bike lane
  xMark.fillStyle = '#808080';
  const cyl = (L.road.top + L.road.bottom) / 2;
  band(xMark, cyl - 0.9, cyl - 0.5); band(xMark, cyl + 0.5, cyl + 0.9);
  xMark.fillStyle = '#fff';
  band(xMark, L.road.bottom - 1.2, L.road.bottom - 0.8);
  band(xMark, L.lane[0] + 1.0, L.lane[0] + 1.4);
  for (const cx of [70, 990, 1100]) for (let k = 0; k < 7; k++) {
    const x0 = cx - 12 + k * 4;
    band(xMark, L.road.top + 1, L.lane[1] - 1, x0, x0 + 2);
  }
  // berms (height field, blurred)
  xBerm.fillStyle = '#000'; xBerm.fillRect(0, 0, CW / 4, CH / 4);
  xBerm.filter = 'blur(10px)';
  for (const b of L.berms) {
    const g = Math.round(255 * b.h / 1.6);
    xBerm.fillStyle = `rgb(${g},${g},${g})`;
    xBerm.beginPath();
    b.pts.forEach(([x, y], i) => { const [cx, cy] = toC(x, y); if (i) xBerm.lineTo(cx / 4, cy / 4); else xBerm.moveTo(cx / 4, cy / 4); });
    xBerm.closePath(); xBerm.fill();
  }
  xBerm.filter = 'none';
  // paths and lawn cut through berms: flatten there
  xBerm.globalCompositeOperation = 'multiply';
  xBerm.drawImage(invert(cPave, CW / 4, CH / 4), 0, 0);
  xBerm.globalCompositeOperation = 'source-over';

  // pack
  const a = [cPave, cLawn, cPlant, cDG].map((c) => c.getContext('2d').getImageData(0, 0, CW, CH).data);
  const b = [cConc, cMark].map((c) => c.getContext('2d').getImageData(0, 0, CW, CH).data);
  const berm = xBerm.getImageData(0, 0, CW / 4, CH / 4).data;
  const s1 = new Uint8Array(CW * CH * 4), s2 = new Uint8Array(CW * CH * 4);
  for (let i = 0, n = CW * CH; i < n; i++) {
    const k = i * 4;
    s1[k] = a[0][k]; s1[k + 1] = a[1][k]; s1[k + 2] = a[2][k]; s1[k + 3] = a[3][k];
    s2[k] = b[0][k]; s2[k + 1] = b[1][k];
    const x = (i % CW) >> 2, y = ((i / CW) | 0) >> 2;
    s2[k + 2] = berm[(y * (CW / 4) + x) * 4]; s2[k + 3] = 255;
  }
  const t1 = new THREE.DataTexture(s1, CW, CH, THREE.RGBAFormat);
  const t2 = new THREE.DataTexture(s2, CW, CH, THREE.RGBAFormat);
  for (const t of [t1, t2]) {
    t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
    t.anisotropy = 8; t.flipY = false; t.needsUpdate = true;
  }
  const bermH = (u, v) => {
    const x = Math.floor((u - U0) / (U1 - U0) * CW / 4), y = Math.floor((v - V0) / (V1 - V0) * CH / 4);
    if (x < 0 || y < 0 || x >= CW / 4 || y >= CH / 4) return 0;
    return berm[(y * (CW / 4) + x) * 4] / 255 * 1.6;
  };
  const sampleMask = (u, v) => {
    const x = Math.floor((u - U0) / (U1 - U0) * CW), y = Math.floor((v - V0) / (V1 - V0) * CH);
    if (x < 0 || y < 0 || x >= CW || y >= CH) return [0, 0, 0, 0];
    const k = (y * CW + x) * 4;
    return [s1[k] / 255, s1[k + 1] / 255, s1[k + 2] / 255, s1[k + 3] / 255];
  };
  return { t1, t2, bermH, sampleMask };
}
function invert(src, w, h) {
  const [c, x] = mk(w, h);
  x.filter = 'blur(2px)';
  x.drawImage(src, 0, 0, w, h);
  x.filter = 'none';
  x.globalCompositeOperation = 'difference'; x.fillStyle = '#fff'; x.fillRect(0, 0, w, h);
  return c;
}

// ---- ground height ----------------------------------------------------------
export function makeHeightFn(splat, waterY) {
  const L = LAYOUT;
  return (x, z) => {
    const { u, v } = worldToPlan(x, z);
    let y = splat.bermH(u, v);
    // gentle crown to the lawn so it drains
    if (v > L.vRiprapTop) {
      const t = (v - L.vRiprapTop) / (L.vWater - L.vRiprapTop);
      y = THREE.MathUtils.lerp(-0.25, waterY.value - 0.1, Math.min(t, 1)) + Math.min(0, (1 - t)) * 4.0;
      if (t > 1) y = waterY.value - 0.1 - (t - 1) * 2.8;
    }
    return y;
  };
}

// ---- ground mesh + material ---------------------------------------------------
export function buildGround(splat, heightFn, shared) {
  const nu = 640, nv = 400;
  const pos = new Float32Array((nu + 1) * (nv + 1) * 3), uvs = new Float32Array((nu + 1) * (nv + 1) * 2);
  for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
    // denser rows near the sculpture/lawn band (v ≈ -40..110)
    const u = U0 + (U1 - U0) * i / nu;
    const v = V0 + (V1 - V0) * j / nv;
    const w = planToWorld(u, v);
    const k = (j * (nu + 1) + i);
    pos[k * 3] = w.x; pos[k * 3 + 1] = heightFn(w.x, w.z); pos[k * 3 + 2] = w.z;
    uvs[k * 2] = (u - U0) / (U1 - U0); uvs[k * 2 + 1] = (v - V0) / (V1 - V0);
  }
  const idx = [];
  for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
    const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1;
    idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // make sure the triangles face up
  const n = g.attributes.normal; let flip = 0;
  for (let i = 0; i < n.count; i += 997) if (n.getY(i) < 0) flip++;
  if (flip > n.count / 997 / 2) { for (let i = 0; i < idx.length; i += 3) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; } g.setIndex(idx); g.computeVertexNormals(); }
  const mat = groundMaterial(splat, shared);
  const mesh = new THREE.Mesh(g, mat);
  mesh.receiveShadow = true;
  mesh.name = 'ground';
  return mesh;
}

export const GROUND_GLSL_COMMON = /* glsl */`
  float gh(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*0.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
  float gn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
    return mix(mix(gh(i),gh(i+vec2(1,0)),f.x), mix(gh(i+vec2(0,1)),gh(i+vec2(1,1)),f.x), f.y); }
  float gfbm(vec2 p){ float a=0.5,s=0.0; for(int i=0;i<4;i++){ s+=a*gn(p); p*=2.07; a*=0.5; } return s; }
  uniform mat4 uW2L; uniform sampler2D uCaustic; uniform vec4 uCausticRect; uniform vec3 uSunRad;
  uniform vec3 uPoles[24]; uniform float uPoleOn;
  vec3 extraLight(vec3 wp){
    vec3 lp = (uW2L * vec4(wp,1.0)).xyz;
    vec2 cuv = (lp.xz - uCausticRect.xy)/uCausticRect.zw;
    vec3 e = vec3(0.0);
    if (all(greaterThan(cuv, vec2(0.0))) && all(lessThan(cuv, vec2(1.0)))) e += uSunRad * texture2D(uCaustic, cuv).r;
    if (uPoleOn > 0.001) {
      for (int i=0;i<24;i++){ vec3 d = uPoles[i] - wp; float r2 = dot(d,d); e += vec3(1.0,0.84,0.66) * uPoleOn * d.y / (r2*sqrt(r2)+0.5); }
    }
    return e;
  }
`;

function groundMaterial(splat, shared) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, {
      tS1: { value: splat.t1 }, tS2: { value: splat.t2 },
      uW2L: shared.w2l, uCaustic: shared.caustic, uCausticRect: shared.causticRect, uSunRad: shared.sunRad,
      uPoles: shared.poles, uPoleOn: shared.poleOn, uWet: shared.wet,
    });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGW; varying vec2 vGUv;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvGW = (modelMatrix*vec4(transformed,1.0)).xyz; vGUv = uv;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vGW; varying vec2 vGUv; uniform sampler2D tS1, tS2; uniform float uWet;
        ${GROUND_GLSL_COMMON}
        float gRough; float gBump;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec4 s1 = texture2D(tS1, vGUv); vec4 s2 = texture2D(tS2, vGUv);
        // sharpen anti-aliased mask edges
        float fw = fwidth(vGUv.x) * ${CW.toFixed(1)};
        float sh = clamp(0.8 / max(fw, 0.15), 1.0, 6.0);
        vec4 m = clamp((s1 - 0.5) * sh + 0.5, 0.0, 1.0);
        float conc = clamp((s2.r - 0.5) * sh + 0.5, 0.0, 1.0);
        vec2 p = vGW.xz;
        // plan-aligned axes for mowing stripes and control joints
        vec2 pa = vec2(dot(p, vec2(${PLAN.right.x.toFixed(5)}, ${PLAN.right.z.toFixed(5)})), dot(p, vec2(${PLAN.down.x.toFixed(5)}, ${PLAN.down.z.toFixed(5)})));
        float n1 = gfbm(p*0.35), n2 = gn(p*4.0), n3 = gh(floor(p*60.0));
        // lawn: irrigated cool-season turf, mowing stripes, a little wear
        vec3 lawn = mix(vec3(0.085,0.16,0.035), vec3(0.13,0.21,0.05), n1);
        lawn *= 0.93 + 0.07*step(0.5, fract(pa.x/1.6));
        lawn = mix(lawn, vec3(0.20,0.19,0.08), smoothstep(0.72, 0.9, gfbm(p*0.8+3.0))*0.35);
        lawn *= 0.85 + 0.3*n2;
        // planting beds: bark mulch between plants
        vec3 bed = mix(vec3(0.075,0.055,0.035), vec3(0.13,0.10,0.065), n2) * (0.8+0.4*n3);
        bed = mix(bed, vec3(0.12,0.14,0.06), smoothstep(0.45,0.7,n1)*0.6);
        // asphalt with exposed aggregate
        vec3 asph = vec3(0.075,0.075,0.078) * (0.8 + 0.5*n3) * (0.9 + 0.2*n1);
        // broom-finish concrete with scored joints every 1.8 m
        float jx = smoothstep(0.012, 0.0, abs(fract(pa.x/1.8)-0.5)-0.488);
        float jy = smoothstep(0.012, 0.0, abs(fract(pa.y/1.8)-0.5)-0.488);
        vec3 concrete = vec3(0.42,0.41,0.385) * (0.9 + 0.12*n3 + 0.1*n1) * (1.0 - 0.35*max(jx,jy));
        // decomposed granite / sand
        vec3 dg = mix(vec3(0.36,0.29,0.19), vec3(0.47,0.39,0.27), n3) * (0.9+0.2*n1);
        vec3 paved = mix(asph, concrete, conc);
        vec3 col = vec3(0.10,0.09,0.07);
        col = mix(col, bed, m.b);
        col = mix(col, dg, m.a);
        col = mix(col, lawn, m.g);
        col = mix(col, paved, m.r);
        // lane markings (retroreflective paint)
        float mk = clamp((s2.g - 0.25) * sh + 0.5, 0.0, 1.0);
        vec3 mcol = s2.g > 0.75 ? vec3(0.78,0.78,0.74) : vec3(0.75,0.55,0.08);
        col = mix(col, mcol, mk * step(0.1, s2.g));
        // riprap bed below the promenade
        float rip = smoothstep(${(LAYOUT.vRiprapTop - 1).toFixed(2)}, ${(LAYOUT.vRiprapTop + 1).toFixed(2)}, pa.y);
        col = mix(col, vec3(0.16,0.15,0.14)*(0.7+0.6*n3), rip);
        // wet band at the tide line
        diffuseColor.rgb = col;
        gRough = mix(0.95, 0.8, m.r) * mix(1.0, 0.35, uWet*m.r);
        gRough = mix(gRough, 0.97, m.g);
        gBump = n3;`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = gRough;')
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
        reflectedLight.directDiffuse += diffuseColor.rgb * RECIPROCAL_PI * extraLight(vGW);`);
  };
  mat.customProgramCacheKey = () => 'parkGround';
  return mat;
}

// ---- riprap -------------------------------------------------------------------
export function buildRiprap(heightFn, waterY) {
  const base = new THREE.IcosahedronGeometry(1, 1);
  const p = base.attributes.position;
  // lumpy quarry stone
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 0.78 + 0.35 * Math.abs(Math.sin(x * 3.1 + y * 1.7) * Math.cos(z * 2.3 - x));
    p.setXYZ(i, x * k * 1.15, y * k * 0.7, z * k);
  }
  base.computeVertexNormals();
  const count = 9000;
  const mat = new THREE.MeshStandardMaterial({ color: 0x77726b, roughness: 0.92, flatShading: true });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uWaterY = waterY;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vRW;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvRW = (modelMatrix * instanceMatrix * vec4(transformed,1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vRW; uniform float uWaterY;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        float wet = 1.0 - smoothstep(uWaterY + 0.2, uWaterY + 1.3, vRW.y);
        diffuseColor.rgb *= mix(1.0, 0.45, wet);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.10,0.12,0.06), wet * 0.5 * step(vRW.y, uWaterY + 0.6));`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.3, 1.0 - smoothstep(uWaterY + 0.1, uWaterY + 0.8, vRW.y));`);
  };
  const mesh = new THREE.InstancedMesh(base, mat, count);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), t = new THREE.Vector3();
  const col = new THREE.Color();
  let rng = 12345; const rnd = () => (rng = (rng * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < count; i++) {
    const u = U0 + 10 + rnd() * (U1 - U0 - 20);
    const v = LAYOUT.vRiprapTop - 0.5 + rnd() * (LAYOUT.vWater - LAYOUT.vRiprapTop + 6);
    const w = planToWorld(u, v);
    const sc = 0.35 + Math.pow(rnd(), 1.6) * 0.75;
    t.set(w.x, heightFn(w.x, w.z) + sc * 0.25, w.z);
    e.set(rnd() * 6.28, rnd() * 6.28, rnd() * 6.28); q.setFromEuler(e);
    s.set(sc * (0.8 + rnd() * 0.5), sc * (0.7 + rnd() * 0.4), sc * (0.8 + rnd() * 0.5));
    m.compose(t, q, s); mesh.setMatrixAt(i, m);
    const g = 0.75 + rnd() * 0.4; col.setRGB(g, g * (0.96 + rnd() * 0.05), g * (0.9 + rnd() * 0.08)); mesh.setColorAt(i, col);
  }
  mesh.castShadow = true; mesh.receiveShadow = true;
  mesh.name = 'riprap';
  return mesh;
}

// ---- site furniture -------------------------------------------------------------
export function buildFurniture(heightFn, shared) {
  const group = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x7a4a2a, roughness: 0.72 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x1b1c1d, roughness: 0.45, metalness: 0.6 });
  const pole = new THREE.MeshStandardMaterial({ color: 0xd8d8d4, roughness: 0.35, metalness: 0.2 });
  // bench: slatted seat & back on three black steel frames (as in the proposal)
  const bench = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.035, 0.075), wood);
    slat.position.set(0, 0.45, -0.2 + i * 0.09); bench.add(slat);
  }
  for (let i = 0; i < 4; i++) {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.075, 0.035), wood);
    slat.position.set(0, 0.55 + i * 0.1, 0.24 + i * 0.012); slat.rotation.x = -0.15; bench.add(slat);
  }
  for (const x of [-1.0, 0, 1.0]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.43, 0.5), steel); leg.position.set(x, 0.215, 0); bench.add(leg);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.45, 0.05), steel); back.position.set(x, 0.66, 0.27); back.rotation.x = -0.15; bench.add(back);
  }
  bench.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.layers.enable(2); o.layers.enable(3); } });
  for (const [px, py, rot] of LAYOUT.benches) {
    const b = bench.clone();
    const w = planPxToWorld(px, py);
    b.position.set(w.x, heightFn(w.x, w.z), w.z);
    // face the lawn/bay (plan "down")
    b.rotation.y = Math.atan2(PLAN.down.x, PLAN.down.z) + Math.PI + rot * Math.PI / 180;
    group.add(b);
  }
  // pedestrian lights: slim pole with disc luminaire (as drawn in the proposal)
  const poles = [];
  const shaft = new THREE.CylinderGeometry(0.05, 0.065, 4.2, 12); shaft.translate(0, 2.1, 0);
  const disc = new THREE.CylinderGeometry(0.42, 0.36, 0.07, 32); disc.translate(0, 4.25, 0);
  const lensG = new THREE.CylinderGeometry(0.34, 0.34, 0.01, 32); lensG.translate(0, 4.21, 0);
  const lensMat = new THREE.MeshStandardMaterial({ color: 0xeeeeee, emissive: 0xffe2b8, emissiveIntensity: 0, roughness: 0.4 });
  shared.poleLensMat = lensMat;
  for (const [px, py] of LAYOUT.poles) {
    const w = planPxToWorld(px, py);
    const y = heightFn(w.x, w.z);
    const g = new THREE.Group();
    for (const [geo, mt] of [[shaft, pole], [disc, pole], [lensG, lensMat]]) {
      const m = new THREE.Mesh(geo, mt); m.castShadow = true; m.layers.enable(2); m.layers.enable(3); g.add(m);
    }
    g.position.set(w.x, y, w.z);
    group.add(g);
    poles.push(new THREE.Vector3(w.x, y + 4.2, w.z));
  }
  while (poles.length < 24) poles.push(new THREE.Vector3(0, -1000, 0));
  shared.poles.value = poles.slice(0, 24);
  return group;
}

// ---- buildings --------------------------------------------------------------------
export function buildBuildings(shared, heightFn) {
  const group = new THREE.Group();
  const white = facadeMaterial({ color: 0xe6e3dc, glass: 0x22303a, floorH: 3.3, bayW: 1.7, windowFrac: 0.58, sillFrac: 0.28, seed: 3 }, shared);
  const warm = facadeMaterial({ color: 0xcfc6b8, glass: 0x1d2a33, floorH: 3.3, bayW: 1.5, windowFrac: 0.5, sillFrac: 0.3, seed: 9 }, shared);
  const glass = facadeMaterial({ color: 0x9aa7ad, glass: 0x2a3b47, floorH: 3.2, bayW: 1.5, curtain: true, glassRough: 0.04, seed: 5 }, shared);
  LAYOUT.buildings.forEach((b, i) => {
    const pts = b.pts.map(([x, y]) => { const w = planPxToWorld(x, y); return [w.x, w.z]; });
    const mesh = new THREE.Mesh(prism(pts, b.h, 0), b.curtain ? glass : (i % 2 ? warm : white));
    mesh.castShadow = true; mesh.receiveShadow = true; mesh.layers.enable(2); mesh.layers.enable(3);
    group.add(mesh);
  });
  // Building 1 (1939 Administration Building, Art Deco) and Isle House (22 storeys, 2024)
  const b1 = toLocal(37.8164, -122.3714);
  const b1m = new THREE.Mesh(new THREE.BoxGeometry(95, 14, 38), facadeMaterial({ color: 0xd9cfbd, glass: 0x1a232b, floorH: 4.4, bayW: 2.4, windowFrac: 0.45, seed: 12 }, shared));
  b1m.position.set(b1.x, heightFn(b1.x, b1.z) + 7, b1.z); b1m.rotation.y = -0.48;
  const isle = toLocal(37.8172, -122.3703);
  const im = new THREE.Mesh(new THREE.BoxGeometry(34, 67, 24), facadeMaterial({ color: 0xeeeeea, glass: 0x26343f, floorH: 3.05, bayW: 1.4, windowFrac: 0.66, seed: 21 }, shared));
  im.position.set(isle.x, 33.5, isle.z); im.rotation.y = -0.48;
  const pod = new THREE.Mesh(new THREE.BoxGeometry(110, 18, 40), facadeMaterial({ color: 0xe3e0da, glass: 0x26343f, floorH: 3.3, bayW: 1.6, seed: 22 }, shared));
  pod.position.set(isle.x + 30, 9, isle.z + 25); pod.rotation.y = -0.48;
  for (const m of [b1m, im, pod]) { m.castShadow = true; m.receiveShadow = true; m.layers.enable(2); m.layers.enable(3); group.add(m); }
  // generic mid-rise fabric further inland on the island
  const fab = facadeMaterial({ color: 0xd4cdc0, glass: 0x20303a, floorH: 3.2, bayW: 1.6, seed: 31 }, shared);
  let rng = 777; const rnd = () => (rng = (rng * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 40; i++) {
    const u = -380 + rnd() * 760, v = -250 - rnd() * 500;
    const w = planToWorld(u, v);
    if (Math.hypot(w.x - b1.x, w.z - b1.z) < 80) continue;
    const hgt = 12 + rnd() * 16;
    const m = new THREE.Mesh(new THREE.BoxGeometry(30 + rnd() * 50, hgt, 20 + rnd() * 30), fab);
    m.position.set(w.x, hgt / 2, w.z); m.rotation.y = Math.atan2(PLAN.right.x, PLAN.right.z);
    m.castShadow = false; m.receiveShadow = true; m.layers.enable(2); m.layers.enable(3);
    group.add(m);
  }
  return group;
}

// Ferry pier (Treasure Island terminal) – simple concrete pier with pile rows.
export function buildFerryPier(waterY) {
  const g = new THREE.Group();
  const ft = toLocal(37.8157, -122.3723);
  const mat = new THREE.MeshStandardMaterial({ color: 0x8d8a84, roughness: 0.85 });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(8, 0.8, 110), mat);
  const dir = PLAN.down;
  deck.position.set(ft.x + dir.x * 55, 0.4 - 0.6, ft.z + dir.z * 55);
  deck.rotation.y = Math.atan2(dir.x, dir.z);
  const float = new THREE.Mesh(new THREE.BoxGeometry(14, 1.5, 40), new THREE.MeshStandardMaterial({ color: 0x6d6d6b, roughness: 0.7 }));
  float.position.set(ft.x + dir.x * 115, waterY.value + 0.4, ft.z + dir.z * 115);
  float.rotation.y = deck.rotation.y + Math.PI / 2;
  for (const m of [deck, float]) { m.castShadow = true; m.receiveShadow = true; m.layers.enable(2); m.layers.enable(3); g.add(m); }
  return g;
}
