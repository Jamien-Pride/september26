import * as THREE from 'three';

// ---------------------------------------------------------------------------
// The installation, built from the proposal drawings:
//   • 18 ft (5.49 m) diameter mouth, 14 ft (4.27 m) tall above the pad
//   • 7 ft (2.13 m) diameter throat whose top is 6.5 ft (1.98 m) above the pad
//   • 8 ft (2.44 m) deep, on a 10 ft × 20 ft concrete pad
//   • 32 radial panels alternating painted colour and polished stainless,
//     colours sampled from the proposal rendering
// Both rims are vertical circles, so the surface is an oblique circular cone
// cut by the ground plane. Local frame: +z = the direction the mouth faces,
// +x = right as seen when facing the mouth, y up, origin at pad centre.
// ---------------------------------------------------------------------------

const FT = 0.3048;
export const CONE = {
  zm: 4 * FT, zt: -4 * FT,         // mouth plane / throat plane
  ym: 5 * FT, yt: 3 * FT,          // rim centre heights (mouth top = 14 ft, throat top = 6.5 ft)
  rm: 9 * FT, rt: 3.5 * FT,
  strips: 32,
  thickness: 0.045,                // panel + frame depth at the rims
  pad: { w: 20 * FT, d: 10 * FT },
};

// Paint colours by colour-panel index k (panel centred at 90° + 22.5°·k,
// counter-clockwise when facing the mouth). sRGB hex.
export const PANEL_COLORS = [
  '#86c23a', // k0  top: leaf green
  '#34b25e', // k1  green
  '#22b3ad', // k2  teal
  '#4f63cc', // k3  blue
  '#8656cf', // k4  violet
  '#cf55cf', // k5  magenta
  '#f07cc2', // k6  pink
  '#f6a3c9', // k7  pale pink (mostly below grade)
  '#8c8c8c', // k8  (buried)
  '#b01827', // k9  deep red (mostly below grade)
  '#d6202b', // k10 signal red
  '#e23d38', // k11 red
  '#eb6a3a', // k12 coral
  '#f08d2b', // k13 orange
  '#f1b51d', // k14 gold
  '#d9cc1f', // k15 yellow
];

const D2R = Math.PI / 180;
const STRIP_DEG = 360 / CONE.strips;
const STRIP0 = 90 - STRIP_DEG / 2; // strip j spans [STRIP0 + j·w, STRIP0 + (j+1)·w]

// Visible angular range: rulings that are at least partly above the pad.
const THROAT_CUT = Math.asin(CONE.yt / CONE.rt) / D2R; // 58.95°
const VIS_START = -THROAT_CUT, VIS_END = 180 + THROAT_CUT;

export function conePoint(theta, s, offset = 0) {
  // theta in degrees, s = 0 at mouth, 1 at throat; offset along outward normal
  const c = Math.cos(theta * D2R), sn = Math.sin(theta * D2R);
  const r = CONE.rm + (CONE.rt - CONE.rm) * s;
  const cy = CONE.ym + (CONE.yt - CONE.ym) * s;
  const z = CONE.zm + (CONE.zt - CONE.zm) * s;
  const p = new THREE.Vector3(r * c, cy + r * sn, z);
  if (offset) p.addScaledVector(coneNormal(p), offset);
  return p;
}

// Outward (away from axis) unit normal at a surface point in local space.
export function coneNormal(p) {
  const L = CONE.zm - CONE.zt;
  const t = (CONE.zm - p.z) / L;
  const cy = CONE.ym + (CONE.yt - CONE.ym) * t;
  const r = CONE.rm + (CONE.rt - CONE.rm) * t;
  const dy = p.y - cy;
  return new THREE.Vector3(p.x, dy, (dy * (CONE.yt - CONE.ym) + r * (CONE.rt - CONE.rm)) / L).normalize();
}

// Range of s (0..1) along ruling theta that lies above y >= 0.
function visibleS(theta) {
  const sn = Math.sin(theta * D2R);
  const y0 = CONE.ym + CONE.rm * sn, y1 = CONE.yt + CONE.rt * sn;
  if (y0 >= 0 && y1 >= 0) return [0, 1];
  if (y0 < 0 && y1 < 0) return null;
  const s = y0 / (y0 - y1);
  return y0 < 0 ? [s, 1] : [0, s];
}

function buildPanels() {
  const seg = { theta: 10, s: 8 };
  const geos = { paint: newArrays(), mirror: newArrays() };
  for (let j = 0; j < CONE.strips; j++) {
    const a0 = STRIP0 + j * STRIP_DEG, a1 = a0 + STRIP_DEG;
    // wrap into the visible window [VIS_START, VIS_END]
    let lo = a0, hi = a1;
    const shift = (lo < VIS_START - 1e-6 && hi <= VIS_START) ? 360 : (lo >= VIS_END ? -360 : 0);
    lo += shift; hi += shift;
    const clo = Math.max(lo, VIS_START), chi = Math.min(hi, VIS_END);
    if (chi <= clo) continue;
    const painted = j % 2 === 0;
    const k = (j / 2) | 0;
    const color = painted ? new THREE.Color(PANEL_COLORS[k % 16]) : new THREE.Color(1, 1, 1);
    const target = painted ? geos.paint : geos.mirror;
    for (const inner of [true, false]) {
      const off = inner ? 0 : CONE.thickness;
      const cols = [];
      for (let i = 0; i <= seg.theta; i++) {
        const th = clo + (chi - clo) * i / seg.theta;
        const vs = visibleS(th) || [1, 1];
        const col = [];
        for (let m = 0; m <= seg.s; m++) {
          const s = vs[0] + (vs[1] - vs[0]) * m / seg.s;
          const p = conePoint(th, s, off);
          if (p.y < 0) p.y = 0;
          const n = coneNormal(conePoint(th, s));
          if (inner) n.negate();
          const across = (th - lo) / STRIP_DEG;
          const width = (CONE.rm + (CONE.rt - CONE.rm) * s) * STRIP_DEG * D2R;
          col.push({ p, n, u: s, v: across, width });
        }
        cols.push(col);
      }
      addGrid(target, cols, color, j, inner ? 1 : 0, !inner);
    }
  }
  return { paint: toGeometry(geos.paint), mirror: toGeometry(geos.mirror) };
}

function newArrays() { return { pos: [], nrm: [], uv: [], col: [], strip: [], inner: [], width: [], idx: [] }; }
function addGrid(A, cols, color, j, innerFlag, flip) {
  const base = A.pos.length / 3;
  const ns = cols[0].length;
  for (const col of cols) for (const v of col) {
    A.pos.push(v.p.x, v.p.y, v.p.z); A.nrm.push(v.n.x, v.n.y, v.n.z);
    // uv.x runs along the ruling (brushing direction), uv.y across the strip
    A.uv.push(v.u * 2.6, v.v);
    A.col.push(color.r, color.g, color.b); A.strip.push(j); A.inner.push(innerFlag); A.width.push(v.width);
  }
  for (let i = 0; i < cols.length - 1; i++) for (let m = 0; m < ns - 1; m++) {
    const a = base + i * ns + m, b = a + 1, c = a + ns, d = c + 1;
    if (flip) A.idx.push(a, b, c, b, d, c); else A.idx.push(a, c, b, b, c, d);
  }
}
function toGeometry(A) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(A.pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(A.nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(A.uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(A.col, 3));
  g.setAttribute('aStrip', new THREE.Float32BufferAttribute(A.strip, 1));
  g.setAttribute('aInner', new THREE.Float32BufferAttribute(A.inner, 1));
  g.setAttribute('aWidth', new THREE.Float32BufferAttribute(A.width, 1));
  g.setIndex(A.idx);
  g.computeTangents();
  return g;
}

// Stainless rim bands closing the panel sandwich at mouth and throat.
function buildRims() {
  const pos = [], nrm = [], idx = [];
  for (const s of [0, 1]) {
    const n = 160;
    const base = pos.length / 3;
    let count = 0;
    for (let i = 0; i <= n; i++) {
      const th = VIS_START + (VIS_END - VIS_START) * i / n;
      const pIn = conePoint(th, s), pOut = conePoint(th, s, CONE.thickness);
      if (pIn.y < 0 && pOut.y < 0) { pIn.y = 0; pOut.y = 0; }
      pIn.y = Math.max(pIn.y, 0); pOut.y = Math.max(pOut.y, 0);
      const nz = s === 0 ? 1 : -1;
      pos.push(pIn.x, pIn.y, pIn.z, pOut.x, pOut.y, pOut.z);
      nrm.push(0, 0, nz, 0, 0, nz);
      count++;
    }
    for (let i = 0; i < count - 1; i++) {
      const a = base + i * 2, b = a + 1, c = a + 2, d = a + 3;
      if (s === 0) idx.push(a, b, c, b, d, c); else idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setIndex(idx);
  return g;
}

// ---------------------------------------------------------------------------
// GLSL: analytic ray–cone intersection so the polished panels show true
// inter-reflections of the painted panels (the kaleidoscope you would see
// standing in the mouth), including sun shadowing inside the funnel.
const TRACE_GLSL = /* glsl */`
uniform mat4 uW2L; uniform mat4 uL2W;
uniform vec4 uCone; uniform vec2 uConeR;
uniform vec3 uPanelColors[16];
uniform vec3 uSunL; uniform vec3 uSunRad; uniform vec3 uSkyAmb;
uniform float uMirrorRough; uniform vec3 uMirrorF0;
uniform float uPaintRough; uniform float uPaintClear;
uniform float uUplight; uniform vec3 uUpColor;
uniform sampler2D uCaustic; uniform vec4 uCausticRect;
varying vec3 vSWorld; varying float vInner; varying float vStrip; varying float vWidth; varying vec2 vSUv;

float coneR(float t){ return uConeR.x + (uConeR.y-uConeR.x)*t; }
float coneCy(float t){ return uCone.z + (uCone.w-uCone.z)*t; }
float coneHit(vec3 o, vec3 d, out vec3 hp){
  float L = uCone.x - uCone.y;
  float a = (uCone.x - o.z)/L, b = -d.z/L;
  float dY = uCone.w - uCone.z, dR = uConeR.y - uConeR.x;
  float p0 = o.y - uCone.z - dY*a, p1 = d.y - dY*b;
  float r0 = uConeR.x + dR*a, r1 = dR*b;
  float A = d.x*d.x + p1*p1 - r1*r1;
  float B = 2.0*(o.x*d.x + p0*p1 - r0*r1);
  float C = o.x*o.x + p0*p0 - r0*r0;
  float disc = B*B - 4.0*A*C;
  if (disc < 0.0 || abs(A) < 1e-7) return -1.0;
  float sq = sqrt(disc);
  float l1 = (-B - sq)/(2.0*A), l2 = (-B + sq)/(2.0*A);
  float lo = min(l1,l2), hi = max(l1,l2);
  for (int i=0;i<2;i++){
    float l = i==0 ? lo : hi;
    if (l > 2e-3) {
      vec3 p = o + d*l; float t = (uCone.x - p.z)/L;
      if (t >= 0.0 && t <= 1.0 && p.y >= 0.0) { hp = p; return l; }
    }
  }
  return -1.0;
}
vec3 coneInnerNormal(vec3 p){
  float L = uCone.x - uCone.y; float t = (uCone.x - p.z)/L;
  float dy = p.y - coneCy(t); float r = coneR(t);
  return -normalize(vec3(p.x, dy, (dy*(uCone.w-uCone.z) + r*(uConeR.y-uConeR.x))/L));
}
float stripIndex(vec3 p){
  float L = uCone.x - uCone.y; float t = (uCone.x - p.z)/L;
  float th = degrees(atan(p.y - coneCy(t), p.x));
  return floor(mod(th - ${STRIP0.toFixed(4)}, 360.0) / ${STRIP_DEG.toFixed(4)});
}
vec3 envW(vec3 dirW, float rough){
  #ifdef USE_ENVMAP
    return textureCubeUV(envMap, envMapRotation * dirW, rough).rgb * envMapIntensity;
  #else
    return uSkyAmb;
  #endif
}
float sunVisibleL(vec3 p, vec3 n){
  if (uSunL.y <= 0.0) return 0.0;
  vec3 hp; float l = coneHit(p + n*0.003, uSunL, hp);
  return l < 0.0 ? 1.0 : 0.0;
}
float ggxD(float cosH, float rough){
  float a = max(rough*rough, 1e-4); float a2 = a*a;
  float d = cosH*cosH*(a2-1.0)+1.0; return a2/(PI*d*d);
}
vec3 causticAt(vec3 pL){
  vec2 uv = (pL.xz - uCausticRect.xy)/uCausticRect.zw;
  if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) return vec3(0.0);
  return texture2D(uCaustic, uv).rrr;
}
vec3 shadeGround(vec3 p, vec3 dirL){
  bool pad = abs(p.x) < ${(CONE.pad.w / 2).toFixed(3)} && abs(p.z) < ${(CONE.pad.d / 2).toFixed(3)};
  vec3 alb = pad ? vec3(0.50,0.48,0.45) : vec3(0.075,0.12,0.04);
  vec3 n = vec3(0.0,1.0,0.0);
  float vis = sunVisibleL(p, n);
  vec3 E = uSunRad * max(uSunL.y,0.0) * vis + uSkyAmb * 0.8 * PI + uSunRad * causticAt(p);
  // uplights pooled on the pad
  return alb * RECIPROCAL_PI * E;
}
vec3 shadePaint(vec3 p, vec3 n, vec3 d, vec3 alb){
  float vis = sunVisibleL(p, n);
  vec3 nW = normalize(mat3(uL2W) * n);
  float depth = clamp((uCone.x - p.z)/(uCone.x-uCone.y), 0.0, 1.0);
  vec3 E = uSunRad * max(dot(n, uSunL), 0.0) * vis + envW(nW, 1.0) * PI * mix(0.8, 0.55, depth);
  // uplight wash (two in-grade fixtures firing up into the funnel)
  vec3 up1 = vec3(-0.63, 0.0, 0.25) - p, up2 = vec3(0.63, 0.0, 0.25) - p;
  E += uUpColor * uUplight * (max(dot(n, normalize(up1)),0.0)/dot(up1,up1) + max(dot(n, normalize(up2)),0.0)/dot(up2,up2)) * step(0.3, p.y);
  vec3 col = alb * RECIPROCAL_PI * E;
  // clear coat
  vec3 r = reflect(d, n);
  float F = 0.04 + 0.96*pow(1.0 - max(dot(-d, n), 0.0), 5.0);
  col += F * uPaintClear * envW(normalize(mat3(uL2W)*r), 0.05);
  return col;
}
vec3 traceCone(vec3 oW, vec3 dW, float rough, vec3 fallback){
  vec3 o = (uW2L * vec4(oW,1.0)).xyz; vec3 d = normalize(mat3(uW2L) * dW);
  vec3 thr = vec3(1.0);
  for (int b=0; b<4; b++){
    vec3 p; float l = coneHit(o, d, p);
    if (l < 0.0) {
      if (d.y < -0.02) {
        float lg = -o.y / d.y; vec3 g = o + d*lg;
        // the pad/lawn seen through the funnel
        if (b > 0 || lg < 9.0) return thr * shadeGround(g, d);
      }
      vec3 dw = normalize(mat3(uL2W) * d);
      vec3 env = b == 0 ? fallback : envW(dw, rough);
      float cosA = dot(d, uSunL);
      vec3 sunSpec = uSunRad * ggxD(sqrt(max((1.0+cosA)*0.5, 0.0)), max(rough, 0.03)) * 0.25 * step(0.0, uSunL.y);
      return thr * (env + (b == 0 ? vec3(0.0) : sunSpec));
    }
    float j = stripIndex(p);
    vec3 n = coneInnerNormal(p);
    if (dot(n, d) > 0.0) n = -n;
    if (mod(j, 2.0) < 0.5) {
      int k = int(mod(floor(j*0.5), 16.0));
      vec3 alb = uPanelColors[0];
      for (int q=0;q<16;q++) if (q==k) alb = uPanelColors[q];
      return thr * shadePaint(p, n, d, alb);
    }
    float cosI = max(dot(-d, n), 0.0);
    thr *= uMirrorF0 + (1.0 - uMirrorF0) * pow(1.0 - cosI, 5.0);
    d = reflect(d, n);
    o = p + n*0.002;
  }
  return thr * envW(normalize(mat3(uL2W)*d), rough);
}
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*0.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
vec3 coneRadiance(vec3 iblRadiance, vec3 viewDirV, vec3 normalV, float rough){
  if (vInner < 0.5) return iblRadiance;
  vec3 nW = normalize(inverseTransformDirection(normalV, viewMatrix));
  vec3 inc = normalize(vSWorld - cameraPosition);
  vec3 rW = reflect(inc, nW);
  if (rough < 0.09) return traceCone(vSWorld + nW*0.002, rW, rough, iblRadiance);
  // glossy: a few jittered rays around the mirror direction
  vec3 acc = vec3(0.0);
  vec3 t1 = normalize(cross(rW, abs(rW.y) < 0.9 ? vec3(0,1,0) : vec3(1,0,0))); vec3 t2 = cross(rW, t1);
  float rnd = hash12(gl_FragCoord.xy);
  for (int i=0;i<4;i++){
    float a = (float(i) + rnd) * 1.5708;
    float sp = rough*rough*1.2 * sqrt((float(i)+0.5)/4.0);
    vec3 dir = normalize(rW + (t1*cos(a) + t2*sin(a))*sp);
    if (dot(dir, nW) < 0.0) dir = rW;
    acc += traceCone(vSWorld + nW*0.002, dir, rough, iblRadiance);
  }
  return acc * 0.25;
}
`;

export class Sculpture {
  constructor(uniforms) {
    this.u = uniforms;
    this.group = new THREE.Group();
    this.group.name = 'sculpture';
    this.traceUniforms = {
      uW2L: uniforms.w2l,
      uL2W: { value: new THREE.Matrix4() },
      uCone: { value: new THREE.Vector4(CONE.zm, CONE.zt, CONE.ym, CONE.yt) },
      uConeR: { value: new THREE.Vector2(CONE.rm, CONE.rt) },
      uPanelColors: { value: PANEL_COLORS.map((c) => new THREE.Color(c)) },
      uSunL: { value: new THREE.Vector3(0, 1, 0) },
      uSunRad: { value: new THREE.Vector3(3, 3, 3) },
      uSkyAmb: uniforms.skyColor,
      uMirrorRough: { value: 0.03 },
      uMirrorF0: { value: new THREE.Vector3(0.62, 0.61, 0.58) },
      uPaintRough: { value: 0.3 },
      uPaintClear: { value: 1.0 },
      uUplight: { value: 0 },
      uUpColor: { value: new THREE.Color(1.0, 0.93, 0.82) },
      uCaustic: uniforms.caustic,
      uCausticRect: uniforms.causticRect,
    };
    const panels = buildPanels();
    this.paintMat = this.makeMaterial(false);
    this.mirrorMat = this.makeMaterial(true);
    this.paint = new THREE.Mesh(panels.paint, this.paintMat);
    this.mirror = new THREE.Mesh(panels.mirror, this.mirrorMat);
    this.rims = new THREE.Mesh(buildRims(), new THREE.MeshPhysicalMaterial({ color: 0xb8b8b4, metalness: 1, roughness: 0.18 }));
    for (const m of [this.paint, this.mirror, this.rims]) {
      m.castShadow = true; m.receiveShadow = true; m.layers.enable(2);
      this.group.add(m);
    }
    this.buildPad();
    this.setFinish('gloss', 'mirror');
  }

  makeMaterial(isMirror) {
    const mat = new THREE.MeshPhysicalMaterial(isMirror
      ? { color: 0xffffff, metalness: 1, roughness: 0.03, side: THREE.FrontSide }
      : { vertexColors: true, metalness: 0, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.04, side: THREE.FrontSide });
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, this.traceUniforms);
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>
          attribute float aStrip; attribute float aInner; attribute float aWidth;
          varying vec3 vSWorld; varying float vInner; varying float vStrip; varying float vWidth; varying vec2 vSUv;`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          vSWorld = (modelMatrix * vec4(transformed,1.0)).xyz; vInner = aInner; vStrip = aStrip; vWidth = aWidth; vSUv = uv;`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <envmap_physical_pars_fragment>', '#include <envmap_physical_pars_fragment>\n' + TRACE_GLSL)
        .replace('radiance += iblRadiance;', isMirror ? 'radiance += coneRadiance(iblRadiance, geometryViewDir, geometryNormal, material.roughness);' : 'radiance += iblRadiance;')
        .replace('clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );',
          isMirror ? 'clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );'
            : 'clearcoatRadiance += coneRadiance(getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness ), geometryViewDir, geometryClearcoatNormal, 0.03);')
        // Seams between panels: a 6 mm shadowed joint with a slight fold in the normal.
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
          float seamW = 0.006 / max(vWidth, 0.05);
          float e = min(vSUv.y, 1.0 - vSUv.y);
          float seam = 1.0 - smoothstep(0.0, seamW, e);
          `)
        .replace('#include <color_fragment>', `#include <color_fragment>
          `)
        .replace('#include <dithering_fragment>', `#include <dithering_fragment>
          { float seamW2 = 0.006 / max(vWidth, 0.05); float e2 = min(vSUv.y, 1.0 - vSUv.y);
            gl_FragColor.rgb *= mix(0.25, 1.0, smoothstep(0.0, seamW2, e2)); }`);
    };
    mat.customProgramCacheKey = () => (isMirror ? 'cone-mirror' : 'cone-paint');
    return mat;
  }

  buildPad() {
    const { w, d } = CONE.pad;
    // Light broom-finish concrete pad, 6" proud of the root flare, flush with the path.
    const padGeo = new THREE.BoxGeometry(w, 0.2, d);
    padGeo.translate(0, -0.095, 0);
    const padMat = new THREE.MeshStandardMaterial({ color: 0xbdb6ab, roughness: 0.9 });
    padMat.onBeforeCompile = (sh) => {
      sh.uniforms.uCaustic = this.traceUniforms.uCaustic;
      sh.uniforms.uCausticRect = this.traceUniforms.uCausticRect;
      sh.uniforms.uSunRad = this.traceUniforms.uSunRad;
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vLP;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLP = position;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
          varying vec3 vLP; uniform sampler2D uCaustic; uniform vec4 uCausticRect; uniform vec3 uSunRad;
          float ph(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1)))*43758.5453); }`)
        .replace('#include <color_fragment>', `#include <color_fragment>
          float g = ph(floor(vLP.xz*180.0)) * 0.10 + ph(floor(vLP.xz*23.0))*0.05;
          float joint = step(0.994, fract(vLP.x / ${(w / 4).toFixed(4)} + 0.5)) ; // saw-cut control joints
          diffuseColor.rgb *= (0.93 + g) * (1.0 - joint*0.45);`)
        .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
          { vec2 cuv = (vLP.xz - uCausticRect.xy)/uCausticRect.zw;
            if (vLP.y > 0.0 && all(greaterThan(cuv, vec2(0.0))) && all(lessThan(cuv, vec2(1.0))))
              reflectedLight.directDiffuse += diffuseColor.rgb * RECIPROCAL_PI * uSunRad * texture2D(uCaustic, cuv).r; }`);
    };
    this.pad = new THREE.Mesh(padGeo, padMat);
    this.pad.receiveShadow = true;
    this.pad.layers.enable(2);
    this.group.add(this.pad);
    // In-grade uplights (the two circles on the drawing's pad)
    this.upFixtures = [];
    const lensMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.15, metalness: 0.2, emissive: 0xfff0dd, emissiveIntensity: 0 });
    const ringMat = new THREE.MeshStandardMaterial({ color: 0x9a9a98, roughness: 0.3, metalness: 1 });
    for (const x of [-0.63, 0.63]) {
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.012, 32), ringMat);
      ring.position.set(x, 0.006, 0.25);
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.014, 32), lensMat);
      lens.position.set(x, 0.007, 0.25);
      this.group.add(ring, lens);
      const spot = new THREE.SpotLight(0xfff0dd, 0, 12, 0.62, 0.5, 2);
      spot.position.set(x, 0.05, 0.25);
      spot.target.position.set(x * 1.5, 5, -0.6);
      this.group.add(spot, spot.target);
      this.upFixtures.push(spot);
    }
    this.lensMat = lensMat;
    // bench by the pad, as drawn in the proposal
    const wood = new THREE.MeshStandardMaterial({ color: 0x7a4a2a, roughness: 0.72 });
    const steel = new THREE.MeshStandardMaterial({ color: 0x1b1c1d, roughness: 0.45, metalness: 0.6 });
    const bench = new THREE.Group();
    for (let i = 0; i < 5; i++) { const sl = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.035, 3.0), wood); sl.position.set(-0.2 + i * 0.09, 0.45, 0); bench.add(sl); }
    for (let i = 0; i < 4; i++) { const sl = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.075, 3.0), wood); sl.position.set(0.25 + i * 0.012, 0.55 + i * 0.1, 0); sl.rotation.z = 0.15; bench.add(sl); }
    for (const z of [-1.4, 0, 1.4]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.43, 0.05), steel); leg.position.set(0, 0.215, z); bench.add(leg);
      const bk = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.45, 0.05), steel); bk.position.set(0.28, 0.66, z); bk.rotation.z = 0.15; bench.add(bk);
    }
    // On the path just past the pad's end, backing onto the planted island,
    // facing the lawn (matched to the proposal's aerial drawing).
    bench.position.set(5.2, 0, 1.95);
    bench.rotation.y = Math.PI / 2;
    bench.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.layers.enable(2); o.layers.enable(3); } });
    this.group.add(bench);
  }

  setFinish(paint, metal) {
    const pm = this.paintMat, mm = this.mirrorMat;
    this.finish = { paint, metal };
    if (paint === 'gloss') { pm.metalness = 0; pm.roughness = 0.32; pm.clearcoat = 1; pm.clearcoatRoughness = 0.035; }
    if (paint === 'metallic') { pm.metalness = 0.55; pm.roughness = 0.38; pm.clearcoat = 1; pm.clearcoatRoughness = 0.03; }
    if (paint === 'satin') { pm.metalness = 0; pm.roughness = 0.55; pm.clearcoat = 0.25; pm.clearcoatRoughness = 0.3; }
    this.traceUniforms.uPaintClear.value = pm.clearcoat;
    if (metal === 'mirror') { mm.roughness = 0.03; mm.anisotropy = 0; }
    if (metal === 'brushed') { mm.roughness = 0.2; mm.anisotropy = 0.85; }
    if (metal === 'bead') { mm.roughness = 0.4; mm.anisotropy = 0; }
    this.traceUniforms.uMirrorRough.value = mm.roughness;
    pm.needsUpdate = true; mm.needsUpdate = true;
  }

  setEnvMap(tex) {
    for (const m of [this.paintMat, this.mirrorMat, this.rims.material]) { m.envMap = tex; m.needsUpdate = true; }
  }

  update(sunDirW, sunRad, uplight) {
    this.group.updateMatrixWorld(true);
    const tu = this.traceUniforms;
    tu.uL2W.value.copy(this.group.matrixWorld);
    tu.uW2L.value.copy(this.group.matrixWorld).invert();
    tu.uSunL.value.copy(sunDirW).transformDirection(tu.uW2L.value);
    tu.uSunRad.value.set(sunRad.r, sunRad.g, sunRad.b);
    tu.uUplight.value = uplight * 10; // matches the spot intensity (cd) for traced reflections
    for (const s of this.upFixtures) s.intensity = uplight * 12;
    this.lensMat.emissiveIntensity = uplight * 3;
  }

  // Walk-mode collision: is point (world) blocked by the panel walls?
  blocks(pw, radius = 0.3) {
    const p = pw.clone().applyMatrix4(this.traceUniforms.uW2L.value);
    if (p.z > CONE.zm + radius || p.z < CONE.zt - radius) return false;
    const zc = THREE.MathUtils.clamp(p.z, CONE.zt, CONE.zm);
    const t = (CONE.zm - zc) / (CONE.zm - CONE.zt);
    const r = CONE.rm + (CONE.rt - CONE.rm) * t, cy = CONE.ym + (CONE.yt - CONE.ym) * t;
    for (const h of [0.35, 1.0, 1.6]) {
      const dy = h - cy;
      const dist = Math.hypot(p.x, dy);
      if (Math.abs(dist - r) < radius + 0.05) return true;
    }
    return false;
  }
}
