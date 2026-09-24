import * as THREE from 'three';
import { PLAN } from './geo.js';

// Mowed turf: hundreds of thousands of instanced blades in a tile that wraps
// around the viewer (positions are anchored to the world, so nothing swims as
// you walk). Each blade looks up the park splat map, so blades only grow on the
// lawn, get their height from the berm field, and fade into the ground shader
// with distance.

export function buildLawnGrass(splat, heightTex, shared, { count = 320000, tile = 34 } = {}) {
  // blade: 3 segments, 7 vertices
  const pos = [], uv = [];
  const segs = 3;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, w = 0.0065 * (1 - t * 0.9);
    if (i < segs) { pos.push(-w, t, 0, w, t, 0); uv.push(0, t, 1, t); } else { pos.push(0, 1, 0); uv.push(0.5, 1); }
  }
  const idx = [];
  for (let i = 0; i < segs - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  idx.push((segs - 1) * 2, (segs - 1) * 2 + 1, segs * 2);
  const blade = new THREE.InstancedBufferGeometry();
  blade.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  blade.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  blade.setIndex(idx);
  const off = new Float32Array(count * 4);
  let s = 7;
  const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < count; i++) {
    off[i * 4] = (r() - 0.5) * tile; off[i * 4 + 1] = (r() - 0.5) * tile;
    off[i * 4 + 2] = r() * Math.PI * 2; off[i * 4 + 3] = r();
  }
  blade.setAttribute('aOff', new THREE.InstancedBufferAttribute(off, 4));
  blade.instanceCount = count;
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, side: THREE.DoubleSide });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, {
      tS1: { value: splat.t1 }, tS2: { value: splat.t2 }, uCam: shared.camXZ, uTile: { value: tile }, uT: shared.time, uWind: shared.wind,
      uW2L: shared.w2l, uCaustic: shared.caustic, uCausticRect: shared.causticRect, uSunRad: shared.sunRad,
      uPoles: shared.poles, uPoleOn: shared.poleOn,
      uPlan: { value: new THREE.Vector4(PLAN.right.x, PLAN.right.z, PLAN.down.x, PLAN.down.z) },
      uRect: { value: new THREE.Vector4(-400, -260, 800, 400) },
    });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute vec4 aOff; uniform sampler2D tS1, tS2; uniform vec2 uCam; uniform float uTile, uT, uWind;
        uniform vec4 uPlan, uRect; varying float vBladeT; varying vec3 vBW; varying float vTint;
        float bh(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }`)
      .replace('#include <beginnormal_vertex>', `
        // world position of this blade: nearest wrap of its tile offset to the camera
        vec2 wp = aOff.xy + floor((uCam - aOff.xy)/uTile + 0.5)*uTile;
        vec2 pl = vec2(dot(wp, uPlan.xy), dot(wp, uPlan.zw));
        vec2 suv = (pl - uRect.xy)/uRect.zw;
        vec4 s1 = texture2D(tS1, suv); vec4 s2 = texture2D(tS2, suv);
        float lawn = smoothstep(0.55, 0.8, s1.g) * (1.0 - smoothstep(0.2, 0.5, s1.r));
        float dist = length(wp - uCam);
        float fade = 1.0 - smoothstep(uTile*0.3, uTile*0.5, dist);
        float h = (0.055 + 0.045*aOff.w) * lawn * fade;
        float gy = s2.b * 1.6;
        float ca = cos(aOff.z), sa = sin(aOff.z);
        vec3 objectNormal = normalize(vec3(sa*0.25, 1.0, ca*0.25));
        vTint = bh(floor(wp*1.7));`)
      .replace('#include <begin_vertex>', `
        float tt = position.y;
        vec3 transformed = vec3(position.x*ca, 0.0, position.x*sa);
        // bend: lean + wind gusts
        float gust = sin(uT*1.7 + wp.x*0.4 + wp.y*0.3)*0.5 + 0.5*sin(uT*3.7 + wp.x*1.3);
        vec2 lean = vec2(cos(aOff.z*3.1), sin(aOff.z*3.1))*0.35 + vec2(0.88,-0.47)*gust*(0.25+0.6*uWind);
        transformed.xz += lean * tt*tt * h;
        transformed.y = tt * h;
        transformed += vec3(wp.x, gy, wp.y);
        vBladeT = tt; vBW = transformed;`)
      .replace('#include <project_vertex>', `
        vec4 mvPosition = viewMatrix * vec4(transformed, 1.0);
        gl_Position = projectionMatrix * mvPosition;`)
      .replace('#include <worldpos_vertex>', 'vec4 worldPosition = vec4(transformed, 1.0);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying float vBladeT; varying vec3 vBW; varying float vTint;
        uniform mat4 uW2L; uniform sampler2D uCaustic; uniform vec4 uCausticRect; uniform vec3 uSunRad;
        uniform vec3 uPoles[24]; uniform float uPoleOn;
        vec3 extraLight(vec3 wp){
          vec3 lp = (uW2L * vec4(wp,1.0)).xyz; vec2 cuv = (lp.xz - uCausticRect.xy)/uCausticRect.zw; vec3 e = vec3(0.0);
          if (all(greaterThan(cuv, vec2(0.0))) && all(lessThan(cuv, vec2(1.0)))) e += uSunRad * texture2D(uCaustic, cuv).r;
          if (uPoleOn > 0.001) for (int i=0;i<24;i++){ vec3 d = uPoles[i]-wp; float r2 = dot(d,d); e += vec3(1.0,0.84,0.66)*uPoleOn*d.y/(r2*sqrt(r2)+0.5); }
          return e; }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 base = mix(vec3(0.06,0.12,0.025), vec3(0.11,0.19,0.04), vTint);
        vec3 tip = mix(vec3(0.16,0.25,0.07), vec3(0.24,0.28,0.10), vTint);
        diffuseColor.rgb = mix(base*0.7, tip, vBladeT);`)
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
        reflectedLight.directDiffuse += diffuseColor.rgb * RECIPROCAL_PI * extraLight(vBW);`);
  };
  mat.customProgramCacheKey = () => 'lawnGrass';
  const mesh = new THREE.Mesh(blade, mat);
  mesh.frustumCulled = false;
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  mesh.name = 'lawnGrass';
  return mesh;
}
