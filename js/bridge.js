import * as THREE from 'three';
import { toLocal, bearingVec, elevToY } from './geo.js';

// San Francisco–Oakland Bay Bridge, West Span: two end-to-end suspension
// bridges (354 m side spans, 704 m main spans) meeting at the concrete centre
// anchorage. Station 0 is the W1 cable bent at the Embarcadero; the axis runs
// 40.7° true. With these span lengths the Yerba Buena end lands within ~20 m
// of its surveyed location, which cross-checks the layout.
// Also: The Bay Lights (25,000 LEDs on the north-facing suspenders, relit
// March 2026), the necklace lights on the main cables, aircraft beacons, and
// night traffic; the Golden Gate Bridge and the SAS tower of the East Span.

const W1 = toLocal(37.7897, -122.3874);
const AX = bearingVec(40.7);
const LAT = { x: -AX.z, z: AX.x }; // to the right when looking toward YBI (= south-east side)
const STATIONS = { w1: 0, t1: 354, t2: 1058, ca0: 1412, ca1: 1472, t3: 1826, t4: 2530, ybi: 2884 };
const TOWER_TOP = elevToY(158), CABLE_HALF = 10.5, DECK_W = 20;

export function stationToWorld(s, lat = 0, y = 0) {
  return new THREE.Vector3(W1.x + AX.x * s + LAT.x * lat, y, W1.z + AX.z * s + LAT.z * lat);
}
// top of upper-deck roadway (scene y)
export function deckY(s) {
  let e = THREE.MathUtils.lerp(57, 70, s / STATIONS.ybi);
  for (const [a, b] of [[STATIONS.t1, STATIONS.t2], [STATIONS.t3, STATIONS.t4]]) {
    if (s > a && s < b) e += 6 * Math.sin(Math.PI * (s - a) / (b - a));
  }
  return elevToY(e);
}
function cableY(s) {
  const S = STATIONS;
  const par = (a, b, ya, yb, sag) => { const t = (s - a) / (b - a); return THREE.MathUtils.lerp(ya, yb, t) - 4 * sag * t * (1 - t); };
  const top = TOWER_TOP, caTop = elevToY(92);
  if (s <= S.t1) return par(S.w1, S.t1, deckY(S.w1) + 6, top, 14);
  if (s <= S.t2) return par(S.t1, S.t2, top, top, top - (deckY((S.t1 + S.t2) / 2) + 2));
  if (s <= S.ca0) return par(S.t2, S.ca0, top, caTop, 12);
  if (s < S.ca1) return caTop;
  if (s <= S.t3) return par(S.ca1, S.t3, caTop, top, 12);
  if (s <= S.t4) return par(S.t3, S.t4, top, top, top - (deckY((S.t3 + S.t4) / 2) + 2));
  return par(S.t4, S.ybi, top, deckY(S.ybi) + 6, 14);
}

function boxInstancer(mat, max) {
  const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, max);
  let n = 0;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), mid = new THREE.Vector3(), dir = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  return {
    im,
    // a member between two points with given cross-section
    beam(a, b, w, h = w) {
      mid.addVectors(a, b).multiplyScalar(0.5); dir.subVectors(b, a);
      const len = dir.length(); dir.normalize();
      q.setFromUnitVectors(up, dir);
      sc.set(w, len, h); m.compose(mid, q, sc); im.setMatrixAt(n++, m);
    },
    box(center, size, rotY = 0) {
      q.setFromAxisAngle(up, rotY); sc.copy(size); m.compose(center, q, sc); im.setMatrixAt(n++, m);
    },
    done() { im.count = n; im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere(); return im; },
  };
}

export function buildBayBridge(shared, terrain) {
  const group = new THREE.Group();
  group.name = 'bayBridge';
  const steel = new THREE.MeshStandardMaterial({ color: 0x9a9fa2, metalness: 0.35, roughness: 0.5 });
  const concrete = new THREE.MeshStandardMaterial({ color: 0x9c9890, roughness: 0.9 });
  const rotY = Math.atan2(AX.x, AX.z);
  const S = STATIONS;

  // --- towers
  const tw = boxInstancer(steel, 2000);
  const cc = boxInstancer(concrete, 64);
  for (const s of [S.t1, S.t2, S.t3, S.t4]) {
    const base = elevToY(12);
    cc.box(stationToWorld(s, 0, elevToY(-2)), new THREE.Vector3(34, 28, 22), rotY);
    const dy = deckY(s);
    for (const side of [-1, 1]) {
      const b = stationToWorld(s, side * CABLE_HALF, base), t = stationToWorld(s, side * (CABLE_HALF - 0.8), TOWER_TOP + 3);
      tw.beam(b, t, 5.5, 7.5);
    }
    // cross bracing: X panels from the deck to the top, struts between
    const tiers = [base + 4, dy - 10, dy + 2, dy + 20, dy + 38, dy + 56, dy + 72, TOWER_TOP - 2];
    for (let i = 0; i < tiers.length; i++) {
      const y = tiers[i];
      const a = stationToWorld(s, -CABLE_HALF, y), b = stationToWorld(s, CABLE_HALF, y);
      tw.beam(a, b, i === tiers.length - 1 ? 5 : 2.4, 3.2);
      if (i > 1 && i < tiers.length) {
        const y0 = tiers[i - 1];
        tw.beam(stationToWorld(s, -CABLE_HALF, y0), stationToWorld(s, CABLE_HALF, y), 1.2, 1.6);
        tw.beam(stationToWorld(s, CABLE_HALF, y0), stationToWorld(s, -CABLE_HALF, y), 1.2, 1.6);
      }
    }
    // saddle housings
    for (const side of [-1, 1]) tw.box(stationToWorld(s, side * CABLE_HALF, TOWER_TOP + 4.5), new THREE.Vector3(6, 3, 9), rotY);
  }
  // centre anchorage (massive concrete, cable saddle housing on top)
  const caMid = (S.ca0 + S.ca1) / 2;
  cc.box(stationToWorld(caMid, 0, elevToY(20)), new THREE.Vector3(60, 44, 28), rotY);
  cc.box(stationToWorld(caMid, 0, elevToY(62)), new THREE.Vector3(36, 40, 24), rotY);
  cc.box(stationToWorld(caMid, 0, elevToY(88)), new THREE.Vector3(24, 12, 30), rotY);
  // bents at each end
  for (const s of [S.w1, S.ybi]) cc.box(stationToWorld(s, 0, deckY(s) / 2 - 2), new THREE.Vector3(10, deckY(s) + 8, 26), rotY);

  // --- double-deck stiffening truss
  const tr = boxInstancer(steel, 12000);
  const panel = 10.6, depth = 8.8;
  for (let s = S.w1; s < S.ybi; s += panel) {
    const s2 = Math.min(s + panel, S.ybi);
    if (s >= S.ca0 && s2 <= S.ca1) continue;
    for (const side of [-1, 1]) {
      const lat = side * DECK_W / 2;
      const a = stationToWorld(s, lat, deckY(s)), b = stationToWorld(s2, lat, deckY(s2));
      const c = stationToWorld(s, lat, deckY(s) - depth), d = stationToWorld(s2, lat, deckY(s2) - depth);
      tr.beam(a, b, 0.9, 0.9); tr.beam(c, d, 0.9, 1.1);
      tr.beam(a, c, 0.5, 0.6);
      tr.beam(((s / panel) | 0) % 2 ? a : c, ((s / panel) | 0) % 2 ? d : b, 0.45, 0.55);
    }
    // deck slabs (upper and lower roadways) and floor beams
    const mid = (s + s2) / 2;
    tr.box(stationToWorld(mid, 0, deckY(mid) - 0.4), new THREE.Vector3(DECK_W, 0.7, s2 - s + 0.02), rotY);
    tr.box(stationToWorld(mid, 0, deckY(mid) - depth + 0.4), new THREE.Vector3(DECK_W, 0.7, s2 - s + 0.02), rotY);
    // railing
    for (const side of [-1, 1]) tr.box(stationToWorld(mid, side * (DECK_W / 2 - 0.2), deckY(mid) + 0.6), new THREE.Vector3(0.15, 1.1, s2 - s), rotY);
  }
  // SF approach viaduct descending toward Rincon Hill
  for (let s = -420; s < 0; s += 30) {
    const y = deckY(0) + s * 0.055;
    tr.box(stationToWorld(s + 15, 0, y - 4), new THREE.Vector3(DECK_W, 8, 30), rotY);
    tr.box(stationToWorld(s + 15, 0, (y - 8) / 2 - 2), new THREE.Vector3(3, Math.max(1, y - 8 + 4), 3), rotY);
  }
  for (const im of [tw.done(), cc.done(), tr.done()]) {
    im.castShadow = false; im.receiveShadow = false; im.layers.enable(2); im.layers.enable(3);
    group.add(im);
  }

  // --- main cables (two per span, ~0.73 m diameter)
  const cableMat = new THREE.MeshStandardMaterial({ color: 0x8e9396, metalness: 0.4, roughness: 0.45 });
  const cablePts = { n: [], s: [] };
  for (const side of [-1, 1]) {
    const segs = [[S.w1, S.ca0 + 5], [S.ca1 - 5, S.ybi]];
    for (const [a, b] of segs) {
      const pts = [];
      for (let s = a; s <= b; s += 8) pts.push(stationToWorld(s, side * CABLE_HALF, cableY(s)));
      const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), pts.length * 2, 0.5, 6, false);
      const m = new THREE.Mesh(tube, cableMat); m.layers.enable(2); m.layers.enable(3); group.add(m);
      (side < 0 ? cablePts.n : cablePts.s).push(...pts);
    }
  }
  // Which cable plane faces Treasure Island (north)? LAT points SE, so side -1 is NW.
  // --- suspenders (faint lines: sub-pixel at this distance)
  const hv = [], leds = [];
  for (let s = S.w1 + 5; s < S.ybi; s += 15.2) {
    if (s > S.ca0 - 3 && s < S.ca1 + 3) continue;
    const yTop = cableY(s), yBot = deckY(s) + 1;
    if (yTop - yBot < 1.5) continue;
    for (const side of [-1, 1]) {
      const a = stationToWorld(s, side * CABLE_HALF, yTop), b = stationToWorld(s, side * CABLE_HALF, yBot);
      hv.push(a.x, a.y, a.z, b.x, b.y, b.z);
      if (side === -1) {
        // Bay Lights LEDs, ~0.3 m apart, on the north face of the north plane
        for (let y = yBot + 0.5; y < yTop; y += 0.35) leds.push(a.x - LAT.x * 0.25, y, a.z - LAT.z * 0.25, s, y - yBot);
      }
    }
  }
  const hg = new THREE.BufferGeometry(); hg.setAttribute('position', new THREE.Float32BufferAttribute(hv, 3));
  const hangerMat = new THREE.LineBasicMaterial({ color: 0x7d8387, transparent: true, opacity: 0.35 });
  const hangers = new THREE.LineSegments(hg, hangerMat); hangers.layers.enable(2);
  group.add(hangers);

  // --- night lighting --------------------------------------------------------------
  const ledArr = new Float32Array(leds.length / 5 * 3), ledMeta = new Float32Array(leds.length / 5 * 2);
  for (let i = 0; i < leds.length / 5; i++) {
    ledArr.set(leds.slice(i * 5, i * 5 + 3), i * 3); ledMeta[i * 2] = leds[i * 5 + 3]; ledMeta[i * 2 + 1] = leds[i * 5 + 4];
  }
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.BufferAttribute(ledArr, 3));
  lg.setAttribute('aMeta', new THREE.BufferAttribute(ledMeta, 2));
  const bayLightsMat = new THREE.ShaderMaterial({
    uniforms: { uT: shared.time, uOn: { value: 0 }, uPx: shared.pixelRatio },
    vertexShader: `#include <common>
      #include <logdepthbuf_pars_vertex>
      attribute vec2 aMeta; uniform float uT, uOn, uPx; varying float vI;
      float h1(float n){ return fract(sin(n)*43758.5453); }
      void main(){
        float s = aMeta.x, y = aMeta.y;
        // Villareal-style generative light: slow sweeping bands, drifting
        // 'rain' falling down the cables and sparse sparkles.
        float band = 0.5 + 0.5*sin(s*0.012 - uT*0.55);
        float band2 = 0.5 + 0.5*sin(s*0.0041 + uT*0.21 + y*0.05);
        float col = floor(s/15.2);
        float rain = smoothstep(0.93, 1.0, fract(-(y*0.06) + uT*0.35 + h1(col)*7.0));
        float spark = step(0.992, h1(col*31.7 + floor(uT*6.0) + floor(y*3.0)));
        vI = uOn * clamp(0.1 + 0.9*pow(band*band2, 1.6) + rain*0.8 + spark, 0.0, 1.6);
        vec4 mv = modelViewMatrix * vec4(position,1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = max(1.5, 900.0 / -mv.z) * uPx;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: `#include <common>
      #include <logdepthbuf_pars_fragment>
      varying float vI;
      void main(){
        #include <logdepthbuf_fragment>
        vec2 c = gl_PointCoord - 0.5; float a = exp(-dot(c,c)*14.0);
        gl_FragColor = vec4(vec3(1.0,0.97,0.92) * vI * a * 9.0, 1.0);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const bayLights = new THREE.Points(lg, bayLightsMat);
  bayLights.layers.enable(2); bayLights.frustumCulled = false;
  group.add(bayLights);

  // necklace lights on the main cables, roadway lights, aircraft beacons, traffic
  const pts = [], kinds = [];
  for (const arr of [cablePts.n, cablePts.s]) arr.forEach((p, i) => { if (i % 2 === 0) { pts.push(p.x, p.y + 0.6, p.z); kinds.push(0, 0); } });
  for (let s = S.w1; s < S.ybi; s += 32) for (const side of [-1, 1]) { const p = stationToWorld(s, side * 9, deckY(s) + 9); pts.push(p.x, p.y, p.z); kinds.push(1, 0); }
  for (const s of [S.t1, S.t2, S.t3, S.t4]) for (const side of [-1, 1]) { const p = stationToWorld(s, side * CABLE_HALF, TOWER_TOP + 7); pts.push(p.x, p.y, p.z); kinds.push(2, s); }
  // cars: upper deck westbound (to SF), lower deck eastbound
  for (let i = 0; i < 520; i++) { const lane = i % 5; pts.push(0, 0, 0); kinds.push(3 + (i % 2), i * 13.7 + lane * 0.21); }
  const ng = new THREE.BufferGeometry();
  ng.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  ng.setAttribute('aKind', new THREE.Float32BufferAttribute(kinds, 2));
  const axis = new THREE.Vector3(AX.x, 0, AX.z), lat = new THREE.Vector3(LAT.x, 0, LAT.z);
  const nightMat = new THREE.ShaderMaterial({
    uniforms: {
      uT: shared.time, uOn: { value: 0 }, uPx: shared.pixelRatio,
      uW1: { value: new THREE.Vector3(W1.x, 0, W1.z) }, uAx: { value: axis }, uLat: { value: lat },
      uLen: { value: S.ybi }, uDeck0: { value: deckY(0) }, uDeck1: { value: deckY(S.ybi) },
    },
    vertexShader: `#include <common>
      #include <logdepthbuf_pars_vertex>
      attribute vec2 aKind; uniform float uT, uOn, uPx, uLen, uDeck0, uDeck1; uniform vec3 uW1, uAx, uLat;
      varying vec3 vC;
      void main(){
        vec3 p = position; float k = aKind.x; vec3 c = vec3(1.0,0.93,0.8); float size = 1.0; float I = uOn;
        if (k > 2.5) {
          // traffic: position along the deck from a seeded phase
          bool west = k < 3.5;
          float speed = 22.0 + 6.0*fract(aKind.y*0.37);
          float s = fract(aKind.y*0.0131 + (west ? -1.0 : 1.0)*uT*speed/uLen) * uLen;
          float ln = (fract(aKind.y)*5.0 - 2.0) * 3.4;
          float y = mix(uDeck0, uDeck1, s/uLen) + (west ? 1.0 : -7.8);
          p = uW1 + uAx*s + uLat*ln; p.y = y;
          // from the north we see mostly tail-lights of westbound, headlights of eastbound
          c = west ? vec3(1.0,0.12,0.06) : vec3(1.0,0.95,0.85);
          I = max(uOn, 0.0) * (west ? 0.9 : 0.6);
          size = 0.9;
        } else if (k > 1.5) { c = vec3(1.0,0.05,0.02); I = step(0.5, fract(uT*0.75 + aKind.y*0.001)) * 1.6 * max(uOn, 0.3); size = 1.4; }
        else if (k > 0.5) { c = vec3(1.0,0.78,0.5); size = 1.1; I *= 0.9; }
        else { c = vec3(1.0,0.96,0.9); size = 1.0; }
        vC = c * I;
        vec4 mv = modelViewMatrix * vec4(p,1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = max(1.8, 1300.0*size / -mv.z) * uPx;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: `#include <common>
      #include <logdepthbuf_pars_fragment>
      varying vec3 vC;
      void main(){
        #include <logdepthbuf_fragment>
        vec2 c = gl_PointCoord - 0.5; float a = exp(-dot(c,c)*12.0);
        gl_FragColor = vec4(vC * a * 8.0, 1.0); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const nightLights = new THREE.Points(ng, nightMat);
  nightLights.frustumCulled = false; nightLights.layers.enable(2);
  group.add(nightLights);

  // --- East Span self-anchored suspension tower (white, 160 m), behind YBI
  const sas = toLocal(37.8134, -122.3553);
  const white = new THREE.MeshStandardMaterial({ color: 0xe8e8e4, roughness: 0.45, metalness: 0.1 });
  const sasG = new THREE.Group();
  for (const [dx, dz] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(4.2, 160, 4.2), white);
    leg.position.set(sas.x + dx * 1.2, elevToY(80), sas.z + dz * 1.2); sasG.add(leg);
  }
  const eDeck = new THREE.Mesh(new THREE.BoxGeometry(60, 4, 700), white);
  eDeck.position.set(sas.x, elevToY(48), sas.z); eDeck.rotation.y = -1.2; sasG.add(eDeck);
  sasG.traverse((o) => { if (o.isMesh) { o.layers.enable(2); o.layers.enable(3); } });
  group.add(sasG);

  group.userData = {
    update(night, pixelRatio) {
      bayLightsMat.uniforms.uOn.value = night;
      nightMat.uniforms.uOn.value = night;
      hangerMat.opacity = 0.25 + 0.15 * (1 - night);
    },
  };
  return group;
}

export function buildGoldenGate() {
  const g = new THREE.Group();
  const orange = new THREE.MeshStandardMaterial({ color: 0xc0362c, roughness: 0.6, metalness: 0.1 });
  const S = toLocal(37.8108, -122.4777), N = toLocal(37.8262, -122.4790);
  const ax = new THREE.Vector3(N.x - S.x, 0, N.z - S.z); const span = ax.length(); ax.normalize();
  const lat = new THREE.Vector3(-ax.z, 0, ax.x);
  const P = (s, l, y) => new THREE.Vector3(S.x + ax.x * s + lat.x * l, y, S.z + ax.z * s + lat.z * l);
  const top = elevToY(227), deck = elevToY(67);
  const bi = boxInstancer(orange, 400);
  for (const s of [0, span]) {
    for (const l of [-14, 14]) bi.beam(P(s, l, elevToY(0)), P(s, l * 0.85, top), 10, 16);
    for (const y of [deck + 8, deck + 60, deck + 105, deck + 148]) bi.beam(P(s, -14, y), P(s, 14, y), 4, 8);
  }
  for (let s = -343; s < span + 343; s += 20) {
    bi.box(P(s + 10, 0, deck), new THREE.Vector3(27, 7.6, 20), Math.atan2(ax.x, ax.z));
  }
  g.add(bi.done());
  const cable = (a, b, ya, yb, sag) => {
    const pts = [];
    for (let i = 0; i <= 30; i++) { const t = i / 30; pts.push(P(a + (b - a) * t, -14, THREE.MathUtils.lerp(ya, yb, t) - 4 * sag * t * (1 - t))); }
    for (const l of [-14, 14]) {
      const pp = pts.map((p) => P(0, 0, 0).set(p.x + lat.x * (l + 14), p.y, p.z + lat.z * (l + 14)));
      const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pp), 60, 1.6, 5), orange);
      g.add(m);
    }
  };
  cable(0, span, top, top, top - deck - 4);
  cable(-343, 0, deck + 6, top, 10); cable(span, span + 343, top, deck + 6, 10);
  g.traverse((o) => { if (o.isMesh) { o.layers.enable(2); o.layers.enable(3); } });
  return g;
}
