import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { planPxToWorld, planToWorld, PLAN, worldToPlan } from './geo.js';
import { LAYOUT, PAD_CLEAR_RADIUS } from './park.js';

let seed = 1;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const rr = (a, b) => a + (b - a) * rnd();

// ---- textures -------------------------------------------------------------------
function leafTexture(kind) {
  // Colour and coverage are drawn separately and packed without premultiplying,
  // so mip levels never pick up black fringes from transparent texels.
  const N = 256;
  const cc = document.createElement('canvas'); cc.width = cc.height = N;
  const ac = document.createElement('canvas'); ac.width = ac.height = N;
  const x = cc.getContext('2d'), a = ac.getContext('2d');
  x.fillStyle = 'rgb(205,215,190)'; x.fillRect(0, 0, N, N);
  a.fillStyle = '#000'; a.fillRect(0, 0, N, N);
  const n = kind === 'oak' ? 34 : 22;
  const leaves = [];
  for (let i = 0; i < n; i++) {
    const L = kind === 'oak' ? rr(18, 30) : rr(14, 28);
    leaves.push({ cx: rr(30, 226), cy: rr(30, 226), a: rr(0, Math.PI * 2), L, W: L * (kind === 'oak' ? 0.62 : 0.35), g: Math.floor(rr(150, 255)) });
  }
  const shape = (ctx, lf, fill) => {
    ctx.save(); ctx.translate(lf.cx, lf.cy); ctx.rotate(lf.a);
    ctx.fillStyle = fill; ctx.beginPath(); ctx.ellipse(0, 0, lf.L, lf.W, 0, 0, Math.PI * 2); ctx.fill();
    if (kind === 'oak') { // toothed margin of coast live oak
      ctx.globalCompositeOperation = ctx === a ? 'source-over' : 'source-over';
      ctx.fillStyle = ctx === a ? '#000' : fill;
      if (ctx === a) for (let k = -2; k <= 2; k++) for (const sg of [-1, 1]) { ctx.beginPath(); ctx.arc(k * lf.L * 0.35, sg * lf.W * 1.05, lf.W * 0.28, 0, 6.28); ctx.fill(); }
    }
    ctx.restore();
  };
  for (const lf of leaves) {
    shape(x, lf, `rgb(${lf.g * 0.92 | 0},${lf.g},${lf.g * 0.85 | 0})`);
    x.save(); x.translate(lf.cx, lf.cy); x.rotate(lf.a); x.strokeStyle = 'rgba(0,0,0,0.25)'; x.lineWidth = 1.2; x.beginPath(); x.moveTo(-lf.L, 0); x.lineTo(lf.L, 0); x.stroke(); x.restore();
    shape(a, lf, '#fff');
  }
  x.strokeStyle = 'rgb(90,75,60)'; a.strokeStyle = '#fff';
  for (const c of [x, a]) { c.lineWidth = 3; c.beginPath(); c.moveTo(128, 250); c.quadraticCurveTo(120, 140, 140, 20); c.stroke(); }
  const col = x.getImageData(0, 0, N, N).data, al = a.getImageData(0, 0, N, N).data;
  const data = new Uint8Array(N * N * 4);
  for (let i = 0; i < N * N; i++) { data[i * 4] = col[i * 4]; data[i * 4 + 1] = col[i * 4 + 1]; data[i * 4 + 2] = col[i * 4 + 2]; data[i * 4 + 3] = al[i * 4]; }
  const t = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.flipY = false;
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}
function barkTexture() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#5a5046'; x.fillRect(0, 0, 128, 256);
  for (let i = 0; i < 500; i++) {
    const g = rr(40, 110);
    x.fillStyle = `rgba(${g},${g * 0.92},${g * 0.82},0.5)`;
    x.fillRect(rr(0, 128), rr(0, 256), rr(2, 8), rr(10, 40));
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---- geometry helpers ----------------------------------------------------------------
function taperedTube(pts, r0, r1, radial = 7) {
  const curve = new THREE.CatmullRomCurve3(pts);
  const segs = Math.max(3, pts.length * 3);
  const frames = curve.computeFrenetFrames(segs, false);
  const pos = [], nrm = [], uv = [], idx = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, p = curve.getPointAt(t), r = THREE.MathUtils.lerp(r0, r1, t);
    const N = frames.normals[i], B = frames.binormals[i];
    for (let j = 0; j <= radial; j++) {
      const a = j / radial * Math.PI * 2;
      const n = new THREE.Vector3().addScaledVector(N, Math.cos(a)).addScaledVector(B, Math.sin(a));
      pos.push(p.x + n.x * r, p.y + n.y * r, p.z + n.z * r); nrm.push(n.x, n.y, n.z);
      uv.push(j / radial, t * curve.getLength() / 1.2);
    }
  }
  for (let i = 0; i < segs; i++) for (let j = 0; j < radial; j++) {
    const a = i * (radial + 1) + j, b = a + radial + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

// A cloud of leaf cards filling an ellipsoid; normals bent toward the canopy
// surface so the crown shades as a soft volume the way real foliage reads.
function leafCloud(centers, canopyCenter, cardSize, perCluster, tint) {
  const pos = [], nrm = [], uv = [], col = [], idx = [];
  const tmp = new THREE.Vector3(), q = new THREE.Quaternion(), e = new THREE.Euler();
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  for (const c of centers) {
    for (let i = 0; i < perCluster; i++) {
      // random point in ellipsoid, biased to the shell
      const u = rnd(), v = rnd(), w = Math.pow(rnd(), 0.35);
      const th = u * Math.PI * 2, ph = Math.acos(2 * v - 1);
      const p = new THREE.Vector3(Math.sin(ph) * Math.cos(th) * c.r, Math.cos(ph) * c.r * 0.7, Math.sin(ph) * Math.sin(th) * c.r).multiplyScalar(w).add(c.p);
      e.set(rr(0, 6.28), rr(0, 6.28), rr(0, 6.28)); q.setFromEuler(e);
      const s = cardSize * rr(0.75, 1.25);
      const radial = tmp.copy(p).sub(canopyCenter).normalize();
      radial.y = radial.y * 0.8 + 0.25; radial.normalize();
      const shade = rr(0.72, 1.08) * (0.75 + 0.25 * Math.max(0, (p.y - canopyCenter.y) / 4 + 0.5));
      const base = pos.length / 3;
      for (const [cx, cy] of corners) {
        const v3 = new THREE.Vector3(cx * s * 0.5, cy * s * 0.5, 0).applyQuaternion(q).add(p);
        pos.push(v3.x, v3.y, v3.z); nrm.push(radial.x, radial.y, radial.z);
        uv.push((cx + 1) / 2, (cy + 1) / 2);
        col.push(tint.r * shade, tint.g * shade * rr(0.95, 1.05), tint.b * shade);
      }
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}

function foliageMaterial(map, shared) {
  const m = new THREE.MeshStandardMaterial({ map, vertexColors: true, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.82, metalness: 0, envMapIntensity: 0.45 });
  m.alphaToCoverage = true;
  // Light that passes through leaves when the sun is behind the crown.
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uSunDirW = shared.sunDir; sh.uniforms.uSunRad = shared.sunRad; sh.uniforms.uWindT = shared.time; sh.uniforms.uWind = shared.wind;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uWindT, uWind; varying vec3 vLW;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        { vec4 wp0 = modelMatrix * vec4(transformed,1.0);
          float h = max(transformed.y - 1.5, 0.0);
          float sway = (sin(uWindT*1.3 + wp0.x*0.35 + wp0.z*0.2) + 0.5*sin(uWindT*3.1 + wp0.x*1.7)) * 0.012 * h * (0.4 + uWind);
          transformed.x += sway * 0.88; transformed.z -= sway * 0.47; }`)
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvLW = (modelMatrix * vec4(transformed,1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uSunDirW; uniform vec3 uSunRad; varying vec3 vLW;')
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
        { vec3 V = normalize(cameraPosition - vLW);
          float back = pow(max(dot(-V, uSunDirW), 0.0), 3.0);
          reflectedLight.directDiffuse += diffuseColor.rgb * vec3(1.0,1.05,0.7) * uSunRad * back * 0.18 * step(0.0, uSunDirW.y); }`);
  };
  return m;
}

// ---- species ----------------------------------------------------------------------------
function makeOak(variant) {
  seed = 1000 + variant * 77;
  const branches = [];
  const H = rr(2.0, 2.8);
  const lean = new THREE.Vector3(rr(-0.3, 0.3), 0, rr(-0.3, 0.3));
  const trunkPts = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(lean.x * 0.3, H * 0.5, lean.z * 0.3), new THREE.Vector3(lean.x, H, lean.z)];
  branches.push(taperedTube(trunkPts, 0.34, 0.24, 9));
  const clusters = [];
  const top = trunkPts[2];
  const limbs = 5 + Math.floor(rnd() * 2);
  for (let i = 0; i < limbs; i++) {
    const a = i / limbs * Math.PI * 2 + rr(-0.3, 0.3);
    const len = rr(3.8, 5.6), rise = rr(1.2, 3.0);
    const dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    const p1 = top.clone().addScaledVector(dir, len * 0.35).add(new THREE.Vector3(0, rise * 0.6, 0));
    const p2 = top.clone().addScaledVector(dir, len).add(new THREE.Vector3(0, rise, 0));
    branches.push(taperedTube([top.clone().add(new THREE.Vector3(0, -0.3, 0)), p1, p2], 0.17, 0.05, 6));
    // sub-branches
    for (let k = 0; k < 3; k++) {
      const t = rr(0.4, 0.95);
      const s = new THREE.Vector3().lerpVectors(p1, p2, t);
      const d2 = dir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), rr(-1, 1)).multiplyScalar(rr(1.2, 2.2)).add(new THREE.Vector3(0, rr(0.5, 1.4), 0));
      branches.push(taperedTube([s, s.clone().addScaledVector(d2, 0.5), s.clone().add(d2)], 0.06, 0.02, 5));
      clusters.push({ p: s.clone().add(d2), r: rr(1.3, 1.9) });
    }
    clusters.push({ p: p2.clone(), r: rr(1.6, 2.2) });
    clusters.push({ p: p1.clone().add(new THREE.Vector3(0, 1.2, 0)), r: rr(1.4, 1.9) });
  }
  clusters.push({ p: top.clone().add(new THREE.Vector3(0, 3.2, 0)), r: 2.4 });
  const wood = mergeGeometries(branches);
  const cc = new THREE.Vector3(0, H + 2.4, 0);
  const leaves = leafCloud(clusters, cc, 0.62, 95, new THREE.Color(0.09, 0.15, 0.045));
  return { wood, leaves };
}

function makePalm() {
  seed = 4242;
  const H = 10.5;
  const trunk = taperedTube([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.15, H * 0.5, 0.05), new THREE.Vector3(0.25, H, 0.1)], 0.42, 0.36, 12);
  const knob = new THREE.SphereGeometry(0.62, 16, 10); knob.scale(1, 1.25, 1); knob.translate(0.25, H + 0.2, 0.1);
  const fronds = [];
  const pos = [], nrm = [], col = [], idx = [];
  const top = new THREE.Vector3(0.25, H + 0.5, 0.1);
  const nF = 34;
  for (let f = 0; f < nF; f++) {
    const a = f * 2.39996; const tilt = THREE.MathUtils.lerp(-0.2, 1.25, (f % 17) / 16) + rr(-0.1, 0.1);
    const dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    const L = rr(4.2, 5.2);
    const pts = [];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      const up = Math.cos(tilt) * L * t, out = Math.sin(tilt) * L * t;
      const droop = t * t * L * 0.45;
      pts.push(top.clone().addScaledVector(dir, out + up * 0.15).add(new THREE.Vector3(0, up - droop, 0)));
    }
    const side = new THREE.Vector3(-dir.z, 0, dir.x);
    for (let i = 1; i < pts.length - 1; i++) {
      const p = pts[i], t = i / 24;
      const tang = pts[i + 1].clone().sub(pts[i - 1]).normalize();
      const ll = Math.sin(Math.PI * Math.min(1, t * 1.15)) * 0.85 + 0.12;
      for (const sgn of [-1, 1]) {
        const leafDir = side.clone().multiplyScalar(sgn).addScaledVector(tang, 0.55).add(new THREE.Vector3(0, 0.35, 0)).normalize();
        const tip = p.clone().addScaledVector(leafDir, ll).add(new THREE.Vector3(0, -ll * 0.35, 0));
        const w = tang.clone().multiplyScalar(0.035);
        const base = pos.length / 3;
        for (const v of [p.clone().sub(w), p.clone().add(w), tip.clone().add(w.clone().multiplyScalar(0.3)), tip.clone().sub(w.clone().multiplyScalar(0.3))]) pos.push(v.x, v.y, v.z);
        const n = new THREE.Vector3().crossVectors(tang, leafDir).normalize(); if (n.y < 0) n.negate();
        n.y += 0.6; n.normalize();
        for (let k = 0; k < 4; k++) { nrm.push(n.x, n.y, n.z); const g = rr(0.8, 1.15); col.push(0.075 * g, 0.12 * g, 0.03 * g); }
        idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }
    }
    fronds.push(taperedTube(pts.filter((_, i) => i % 3 === 0), 0.05, 0.01, 4));
  }
  const leaf = new THREE.BufferGeometry();
  leaf.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  leaf.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  leaf.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  leaf.setIndex(idx);
  const knobG = knob.toNonIndexed(); knobG.deleteAttribute('uv');
  const tr = trunk.toNonIndexed(); tr.deleteAttribute('uv');
  const frondWood = mergeGeometries(fronds.map((g) => { const n = g.toNonIndexed(); n.deleteAttribute('uv'); return n; }));
  return { trunk: tr, knob: knobG, leaf, frondWood };
}

// ---- build everything ------------------------------------------------------------
export function buildVegetation(heightFn, splat, shared, terrainData, landClass) {
  const group = new THREE.Group();
  const oakLeafTex = leafTexture('oak');
  const shrubTex = leafTexture('shrub');
  const bark = barkTexture();
  const barkMat = new THREE.MeshStandardMaterial({ map: bark, color: 0x8a8076, roughness: 0.95 });
  const oakMat = foliageMaterial(oakLeafTex, shared);
  const reflect = (o) => { o.layers.enable(2); o.layers.enable(3); };

  // Coast live oaks from the plan
  const oaks = [0, 1, 2].map(makeOak);
  LAYOUT.oaks.forEach(([px, py], i) => {
    const w = planPxToWorld(px, py);
    const v = oaks[i % 3];
    const s = 0.8 + ((i * 37) % 10) / 25;
    const y = heightFn(w.x, w.z);
    for (const [geo, mat] of [[v.wood, barkMat], [v.leaves, oakMat]]) {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(w.x, y - 0.05, w.z); m.scale.setScalar(s); m.rotation.y = i * 1.7;
      m.castShadow = true; m.receiveShadow = true; reflect(m);
      group.add(m);
    }
  });

  // Palms along Avenue of the Palms (the park-side sidewalk)
  const palm = makePalm();
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7b6a55, roughness: 0.95 });
  trunkMat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vPL;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvPL = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vPL;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        // diamond leaf-base scars of a pruned Canary Island date palm
        float a = atan(vPL.z, vPL.x) * 3.0; float y = vPL.y * 5.0;
        float d = abs(fract((a + y)*0.5) - 0.5) + abs(fract((a - y)*0.5) - 0.5);
        diffuseColor.rgb *= 0.65 + 0.55 * smoothstep(0.3, 0.6, d);`);
  };
  const frondMat = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.6 });
  const rachisMat = new THREE.MeshStandardMaterial({ color: 0x8a8a4a, roughness: 0.7 });
  const knobMat = new THREE.MeshStandardMaterial({ color: 0x9a7a4a, roughness: 0.9 });
  const palmGeos = [[palm.trunk, trunkMat], [palm.knob, knobMat], [palm.leaf, frondMat], [palm.frondWood, rachisMat]];
  const palmIM = palmGeos.map(([g, m]) => { const im = new THREE.InstancedMesh(g, m, LAYOUT.palms.length); im.castShadow = true; im.receiveShadow = true; reflect(im); group.add(im); return im; });
  const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
  LAYOUT.palms.forEach((px, i) => {
    const w = planPxToWorld(px, 478);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), i * 2.1);
    const s = 0.85 + ((i * 53) % 10) / 30;
    sc.set(s, s * (0.9 + ((i * 17) % 7) / 20), s);
    mtx.compose(new THREE.Vector3(w.x, 0, w.z), q, sc);
    for (const im of palmIM) im.setMatrixAt(i, mtx);
  });

  // Shrubs and bunchgrasses in the planting beds, berms and dunes
  seed = 99;
  const shrubGeo = leafCloud([{ p: new THREE.Vector3(0, 0.55, 0), r: 0.85 }, { p: new THREE.Vector3(0.45, 0.4, 0.2), r: 0.6 }, { p: new THREE.Vector3(-0.4, 0.45, -0.2), r: 0.65 }], new THREE.Vector3(0, 0.2, 0), 0.42, 70, new THREE.Color(1, 1, 1));
  const shrubMat = foliageMaterial(shrubTex, shared);
  // bunchgrass tuft
  const tuftPos = [], tuftNrm = [], tuftIdx = [];
  for (let b = 0; b < 26; b++) {
    const a = b * 2.39996, lean = rr(0.15, 0.7), len = rr(0.45, 0.8);
    const d = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    const side = new THREE.Vector3(-d.z, 0, d.x).multiplyScalar(0.012);
    const base = tuftPos.length / 3;
    for (let k = 0; k <= 4; k++) {
      const t = k / 4, r = lean * t * t * len, h = len * t * (1 - lean * 0.35 * t);
      const p = d.clone().multiplyScalar(r + 0.04);
      const wmul = 1 - t * 0.85;
      tuftPos.push(p.x - side.x * wmul, h, p.z - side.z * wmul, p.x + side.x * wmul, h, p.z + side.z * wmul);
      const n = d.clone().multiplyScalar(0.3); n.y = 1; n.normalize();
      tuftNrm.push(n.x, n.y, n.z, n.x, n.y, n.z);
      if (k < 4) { const i0 = base + k * 2; tuftIdx.push(i0, i0 + 1, i0 + 2, i0 + 1, i0 + 3, i0 + 2); }
    }
  }
  const tuftGeo = new THREE.BufferGeometry();
  tuftGeo.setAttribute('position', new THREE.Float32BufferAttribute(tuftPos, 3));
  tuftGeo.setAttribute('normal', new THREE.Float32BufferAttribute(tuftNrm, 3));
  tuftGeo.setIndex(tuftIdx);
  const tuftMat = new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide, roughness: 0.8 });
  tuftMat.onBeforeCompile = (sh) => {
    sh.uniforms.uT = shared.time; sh.uniforms.uWind = shared.wind;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uT, uWind;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        { vec3 ip = vec3(instanceMatrix[3][0], 0.0, instanceMatrix[3][2]);
          float k = transformed.y * transformed.y;
          float s = sin(uT*1.9 + ip.x*0.6 + ip.z*0.4) * 0.5 + sin(uT*4.3 + ip.x*2.1) * 0.2;
          transformed.x += s * k * (0.15 + 0.35*uWind) * 0.88; transformed.z -= s * k * (0.15 + 0.35*uWind) * 0.47; }`);
  };
  const shrubs = [], tufts = [];
  for (let u = -395; u < 395; u += 1.7) for (let v = -60; v < 96; v += 1.7) {
    const uu = u + rr(-0.8, 0.8), vv = v + rr(-0.8, 0.8);
    const m = splat.sampleMask(uu, vv);
    if (m[2] < 0.6 || m[0] > 0.2 || m[1] > 0.2) continue;
    const w = planToWorld(uu, vv);
    if (Math.hypot(w.x, w.z) < PAD_CLEAR_RADIUS + 0.5) continue; // nothing grows on the pad
    const r = rnd();
    const dune = m[3] > 0.5;
    if (!dune && r < 0.32) shrubs.push([w.x, heightFn(w.x, w.z), w.z]);
    else if (r < 0.95) tufts.push([w.x, heightFn(w.x, w.z), w.z, dune]);
  }
  const palette = [[0.12, 0.17, 0.08], [0.07, 0.14, 0.04], [0.15, 0.17, 0.10], [0.06, 0.12, 0.035], [0.17, 0.11, 0.06]];
  const shrubIM = new THREE.InstancedMesh(shrubGeo, shrubMat, shrubs.length);
  const col = new THREE.Color();
  shrubs.forEach(([x, y, z], i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * 6.28);
    const s = rr(0.7, 1.3); sc.set(s * rr(0.9, 1.2), s * rr(0.7, 1.1), s * rr(0.9, 1.2));
    mtx.compose(new THREE.Vector3(x, y - 0.1, z), q, sc); shrubIM.setMatrixAt(i, mtx);
    const p = palette[Math.floor(rnd() * palette.length)]; col.setRGB(p[0], p[1], p[2]); shrubIM.setColorAt(i, col);
  });
  shrubIM.castShadow = true; shrubIM.receiveShadow = true; reflect(shrubIM);
  group.add(shrubIM);
  const tuftIM = new THREE.InstancedMesh(tuftGeo, tuftMat, tufts.length);
  const tuftCols = [[0.22, 0.17, 0.08], [0.13, 0.14, 0.06], [0.26, 0.20, 0.10], [0.09, 0.12, 0.05], [0.30, 0.25, 0.15]];
  tufts.forEach(([x, y, z, dune], i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * 6.28);
    const s = dune ? rr(0.7, 1.1) : rr(0.8, 1.4); sc.set(s, s, s);
    mtx.compose(new THREE.Vector3(x, y - 0.02, z), q, sc); tuftIM.setMatrixAt(i, mtx);
    const p = tuftCols[Math.floor(rnd() * tuftCols.length)]; col.setRGB(p[0], p[1], p[2]); tuftIM.setColorAt(i, col);
  });
  tuftIM.receiveShadow = true; tuftIM.castShadow = false; tuftIM.layers.enable(2);
  group.add(tuftIM);

  // Yerba Buena Island woodland (eucalyptus, Monterey pine and oak) as canopy clumps.
  const blob = new THREE.IcosahedronGeometry(1, 2);
  const bp = blob.attributes.position;
  for (let i = 0; i < bp.count; i++) {
    const x = bp.getX(i), y = bp.getY(i), z = bp.getZ(i);
    const k = 0.8 + 0.25 * Math.sin(x * 5.1 + y * 3.3) * Math.cos(z * 4.7 + x * 2.1);
    bp.setXYZ(i, x * k, y * k * 0.8, z * k);
  }
  blob.computeVertexNormals();
  const blobMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
  const pts = [];
  seed = 5150;
  for (let x = -500; x < 1400; x += 9) for (let z = 1050; z < 2200; z += 9) {
    const xx = x + rr(-4, 4), zz = z + rr(-4, 4);
    const e = terrainData.elevation(xx, zz);
    if (e < 6) continue;
    const c = landClass(xx, zz, e);
    if (rnd() > c.wood * 0.95) continue;
    pts.push([xx, e, zz]);
  }
  const forest = new THREE.InstancedMesh(blob, blobMat, pts.length);
  const fc = [[0.030, 0.045, 0.02], [0.04, 0.055, 0.03], [0.05, 0.06, 0.04], [0.025, 0.035, 0.018], [0.06, 0.065, 0.045]];
  pts.forEach(([x, e, z], i) => {
    const s = rr(4, 8);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * 6.28);
    sc.set(s, s * rr(1.0, 1.9), s);
    mtx.compose(new THREE.Vector3(x, e - 3.64 + s * 0.8, z), q, sc); forest.setMatrixAt(i, mtx);
    const p = fc[Math.floor(rnd() * fc.length)]; col.setRGB(p[0], p[1], p[2]); forest.setColorAt(i, col);
  });
  forest.receiveShadow = false; reflect(forest);
  group.add(forest);
  return group;
}
