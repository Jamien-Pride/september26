import * as THREE from 'three';
import { SITE, M_PER_DEG_LAT, M_PER_DEG_LON, elevToY } from './geo.js';

// Loads the two DEM grids (USGS/Terrarium, decimetres above NAVD88) and builds
// the far-field terrain (SF, Marin, East Bay, Angel Island, Alcatraz) and the
// near-field terrain (Yerba Buena Island and the rest of Treasure Island).

export async function loadTerrainData(base = 'data/') {
  const meta = await (await fetch(base + 'terrain.json')).json();
  // Heights are int16 little-endian decimetres, base64-packed in JSON.
  const grid = async (name) => {
    const { b64 } = await (await fetch(base + name)).json();
    const bin = atob(b64), u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return u8.buffer;
  };
  const [nb, fb] = await Promise.all([grid('terrain_near.json'), grid('terrain_far.json')]);
  const near = { ...meta.near, h: new Int16Array(nb) };
  const far = { ...meta.far, h: new Int16Array(fb) };
  const sampleGrid = (g, x, z) => {
    const fx = (x - g.x0) / g.step, fz = (z - g.z0) / g.step;
    if (fx < 0 || fz < 0 || fx >= g.nx - 1 || fz >= g.nz - 1) return null;
    const ix = Math.floor(fx), iz = Math.floor(fz), tx = fx - ix, tz = fz - iz;
    const i = iz * g.nx + ix;
    const a = g.h[i], b = g.h[i + 1], c = g.h[i + g.nx], d = g.h[i + g.nx + 1];
    return ((a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz) / 10;
  };
  // elevation above NAVD88 (m) at local x,z
  const elevation = (x, z) => {
    const n = sampleGrid(near, x, z);
    if (n !== null) return n;
    const f = sampleGrid(far, x, z);
    return f === null ? -10 : f;
  };
  return { meta, near, far, elevation };
}

// ---------------------------------------------------------------------------
// Land-cover classification (urban / woodland / open grassland) from simple,
// geographically grounded rules. Evaluated on the far grid and uploaded as a
// texture so shaders and the city generator share it.
const latOf = (z) => SITE.lat - z / M_PER_DEG_LAT;
const lonOf = (x) => SITE.lon + x / M_PER_DEG_LON;

export function classify(x, z, elev) {
  const lat = latOf(z), lon = lonOf(x);
  let urban = 0, wood = 0;
  if (elev < 0.4) return { urban, wood, water: 1 };
  // Yerba Buena Island: dense eucalyptus / oak woodland
  if (lat > 37.804 && lat < 37.8135 && lon > -122.375 && lon < -122.357) {
    return { urban: 0.04, wood: elev > 8 ? 0.85 : 0.35, water: 0 };
  }
  // Treasure Island (handled mostly by the park model)
  if (lat > 37.8135 && lat < 37.834 && lon > -122.382 && lon < -122.36) return { urban: 0.35, wood: 0.05, water: 0 };
  // Angel Island
  if (lat > 37.85 && lat < 37.875 && lon > -122.445 && lon < -122.415) return { urban: 0, wood: 0.65, water: 0 };
  // Alcatraz
  if (Math.abs(lat - 37.8267) < 0.003 && Math.abs(lon + 122.423) < 0.004) return { urban: 0.55, wood: 0.1, water: 0 };
  // Marin headlands, Sausalito, Tiburon
  if (lat > 37.815 && lon < -122.43) {
    const sausalito = Math.hypot((lat - 37.857) * 111, (lon + 122.482) * 88) < 1.6 && elev < 80;
    const tiburon = Math.hypot((lat - 37.873) * 111, (lon + 122.455) * 88) < 1.8 && elev < 70;
    return { urban: sausalito || tiburon ? 0.7 : 0.0, wood: 0.25, water: 0 };
  }
  // San Francisco
  if (lon < -122.355 && lat < 37.8115) {
    let u = 0.85;
    if (lat > 37.787 && lon < -122.447) { u = 0.12; wood = 0.6; } // Presidio
    if (lat > 37.764 && lat < 37.7735 && lon < -122.453) { u = 0.0; wood = 0.75; } // Golden Gate Park
    if (elev > 170) { u *= 0.15; wood = Math.max(wood, 0.35); } // Twin Peaks, Mt Davidson, Sutro
    return { urban: u, wood, water: 0 };
  }
  // East Bay: Oakland, Emeryville, Berkeley, Alameda, Richmond
  if (lon > -122.345) {
    if (elev > 130) return { urban: 0.15, wood: 0.55, water: 0 }; // Oakland/Berkeley hills
    return { urban: 0.8, wood: 0.1, water: 0 };
  }
  return { urban: 0.2, wood: 0.2, water: 0 };
}

export function buildLandcoverTexture(td) {
  const g = td.far;
  const data = new Uint8Array(g.nx * g.nz * 4);
  for (let j = 0; j < g.nz; j++) for (let i = 0; i < g.nx; i++) {
    const x = g.x0 + i * g.step, z = g.z0 + j * g.step;
    const e = g.h[j * g.nx + i] / 10;
    const c = classify(x, z, e);
    const k = (j * g.nx + i) * 4;
    data[k] = c.urban * 255; data[k + 1] = c.wood * 255; data[k + 2] = c.water * 255; data[k + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, g.nx, g.nz, THREE.RGBAFormat);
  tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  tex.userData = { x0: g.x0, z0: g.z0, sizeX: (g.nx - 1) * g.step, sizeZ: (g.nz - 1) * g.step };
  return tex;
}

// ---------------------------------------------------------------------------
function gridGeometry(g, stride, keep, heightFn) {
  const nx = Math.floor((g.nx - 1) / stride) + 1, nz = Math.floor((g.nz - 1) / stride) + 1;
  const pos = new Float32Array(nx * nz * 3);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const gi = i * stride, gj = j * stride;
    const x = g.x0 + gi * g.step, z = g.z0 + gj * g.step;
    let e = heightFn ? heightFn(x, z, g.h[gj * g.nx + gi] / 10) : g.h[gj * g.nx + gi] / 10;
    const k = (j * nx + i) * 3;
    pos[k] = x; pos[k + 1] = elevToY(e); pos[k + 2] = z;
  }
  const idx = [];
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
    // skip quads that are fully under water or excluded
    const ya = pos[a * 3 + 1], yb = pos[b * 3 + 1], yc = pos[c * 3 + 1], yd = pos[d * 3 + 1];
    const wl = elevToY(-1.5);
    if (ya < wl && yb < wl && yc < wl && yd < wl) continue;
    if (keep && !keep(pos[a * 3], pos[a * 3 + 2], pos[d * 3], pos[d * 3 + 2])) continue;
    idx.push(a, c, b, b, c, d);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

export function makeTerrainMaterial(landcover, uniforms) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uLand = { value: landcover };
    sh.uniforms.uLandRect = { value: new THREE.Vector4(landcover.userData.x0, landcover.userData.z0, landcover.userData.sizeX, landcover.userData.sizeZ) };
    sh.uniforms.uSeason = uniforms.season; // 0 = green (winter/spring) … 1 = golden (summer/fall)
    sh.uniforms.uWaterY = uniforms.waterY;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos; varying vec3 vWNormal;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed,1.0)).xyz; vWNormal = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWPos; varying vec3 vWNormal;
        uniform sampler2D uLand; uniform vec4 uLandRect; uniform float uSeason; uniform float uWaterY;
        float h21(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
        float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
          return mix(mix(h21(i),h21(i+vec2(1,0)),f.x), mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x), f.y); }
        float fbm(vec2 p){ float a=0.5, s=0.0; for(int i=0;i<5;i++){ s+=a*vnoise(p); p*=2.03; a*=0.5; } return s; }
      `)
      .replace('#include <color_fragment>', `#include <color_fragment>
        if (vWPos.y < uWaterY - 0.6) discard;
        vec2 luv = (vWPos.xz - uLandRect.xy) / uLandRect.zw;
        vec4 lc = texture2D(uLand, luv);
        float n1 = fbm(vWPos.xz * 0.004), n2 = fbm(vWPos.xz * 0.03 + 7.0), n3 = vnoise(vWPos.xz * 0.25);
        float slope = 1.0 - clamp(vWNormal.y, 0.0, 1.0);
        float northness = clamp(-vWNormal.z, 0.0, 1.0); // north-facing slopes hold chaparral & oak
        vec3 golden = mix(vec3(0.46,0.37,0.22), vec3(0.58,0.47,0.29), n2);
        vec3 greenGrass = mix(vec3(0.20,0.29,0.11), vec3(0.28,0.36,0.15), n2);
        vec3 grass = mix(greenGrass, golden, uSeason);
        vec3 scrub = mix(vec3(0.11,0.14,0.07), vec3(0.17,0.19,0.10), n3);
        vec3 wood = mix(vec3(0.07,0.11,0.05), vec3(0.12,0.16,0.08), n2);
        float scrubAmt = smoothstep(0.35, 0.75, n1 + northness*0.45 + slope*0.3);
        vec3 natural = mix(grass, scrub, scrubAmt);
        natural = mix(natural, wood, smoothstep(0.15, 0.6, lc.g + (n1-0.5)*0.5));
        natural = mix(natural, vec3(0.42,0.37,0.30), smoothstep(0.55, 0.85, slope)); // bare rock / cliffs
        // urban fabric: roofs, streets, street trees, seen at grazing angles from miles away
        float blocks = step(0.18, fract(vWPos.x/92.0)) * step(0.14, fract(vWPos.z/118.0));
        vec3 roofs = mix(vec3(0.46,0.45,0.43), vec3(0.62,0.58,0.53), h21(floor(vWPos.xz/14.0)));
        vec3 urban = mix(vec3(0.24,0.24,0.25), roofs, blocks);
        urban = mix(urban, vec3(0.16,0.22,0.12), 0.25*smoothstep(0.55,0.8,n2));
        vec3 land = mix(natural, urban, smoothstep(0.1, 0.6, lc.r));
        // wet sand / rock at the waterline
        land = mix(vec3(0.20,0.19,0.17), land, smoothstep(uWaterY - 0.2, uWaterY + 2.5, vWPos.y));
        diffuseColor.rgb = land;
      `)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = 0.92;');
  };
  return mat;
}

export function buildTerrain(td, landcover, uniforms, parkExclusion) {
  const group = new THREE.Group();
  const mat = makeTerrainMaterial(landcover, uniforms);
  const n = td.near;
  const nearMinX = n.x0 + 60, nearMaxX = n.x0 + (n.nx - 1) * n.step - 60;
  const nearMinZ = n.z0 + 60, nearMaxZ = n.z0 + (n.nz - 1) * n.step - 60;
  // Far terrain, with a hole where the near grid takes over.
  const farGeo = gridGeometry(td.far, 1, (ax, az, bx, bz) =>
    !(ax > nearMinX && bx < nearMaxX && az > nearMinZ && bz < nearMaxZ));
  const far = new THREE.Mesh(farGeo, mat);
  far.receiveShadow = false;
  far.name = 'terrainFar';
  group.add(far);
  // Near terrain (4 m), minus the modelled park.
  const nearGeo = gridGeometry(n, 1, (ax, az, bx, bz) =>
    ax >= nearMinX - 60 && bx <= nearMaxX + 60 && az >= nearMinZ - 60 && bz <= nearMaxZ + 60 &&
    !parkExclusion((ax + bx) / 2, (az + bz) / 2),
  (x, z, e) => {
    // Treasure Island is fill: flatten survey noise to a gentle grade.
    const inTI = x > -900 && x < 1300 && z < 900 && z > -1400 && e > 0.3;
    return inTI ? Math.max(e, 2.2) * 0.6 + 3.3 * 0.4 : e;
  });
  const near = new THREE.Mesh(nearGeo, mat);
  near.receiveShadow = true;
  near.name = 'terrainNear';
  group.add(near);
  return group;
}
