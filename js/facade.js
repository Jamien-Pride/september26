import * as THREE from 'three';

// Procedural curtain-wall / punched-window facade used for Treasure Island
// buildings and the San Francisco skyline. Works in world space so any box or
// extruded footprint gets floors and mullions without UVs. At night a
// deterministic random subset of windows glows.

export function facadeMaterial(opts, shared) {
  const o = Object.assign({
    color: 0xdedbd4, glass: 0x1c2630, floorH: 3.4, bayW: 1.6, windowFrac: 0.62,
    sillFrac: 0.3, glassRough: 0.06, curtain: false, litFrac: 0.45, seed: 1,
  }, o_default(opts));
  const mat = new THREE.MeshStandardMaterial({ color: o.color, roughness: 0.75, metalness: 0.0 });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uNight = shared.night;
    sh.uniforms.uGlass = { value: new THREE.Color(o.glass) };
    sh.uniforms.uFac = { value: new THREE.Vector4(o.floorH, o.bayW, o.windowFrac, o.sillFrac) };
    sh.uniforms.uFac2 = { value: new THREE.Vector4(o.curtain ? 1 : 0, o.litFrac, o.seed, o.glassRough) };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vFW; varying vec3 vFN;')
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
        vec4 fw = modelMatrix * vec4(transformed,1.0);
        vFN = normalize(mat3(modelMatrix) * objectNormal);
        #ifdef USE_INSTANCING
          fw = modelMatrix * instanceMatrix * vec4(transformed,1.0);
          vFN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * objectNormal);
        #endif
        vFW = fw.xyz;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vFW; varying vec3 vFN; uniform float uNight; uniform vec3 uGlass; uniform vec4 uFac, uFac2;
        float fh(vec3 p){ p = fract(p*vec3(0.1031,0.1030,0.0973)); p += dot(p, p.yxz+33.33); return fract((p.x+p.y)*p.z); }
        float winMask; vec3 winCell; float winRaw; float winAA;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 N = normalize(vFN);
        winMask = 0.0; winRaw = 0.0; winAA = 0.0;
        if (abs(N.y) < 0.5) {
          vec2 t = normalize(vec2(-N.z, N.x));
          float hcoord = dot(vFW.xz, t);
          float fl = vFW.y / uFac.x;
          float bay = hcoord / uFac.y;
          vec2 f = vec2(fract(bay), fract(fl));
          float wx = step(abs(f.x-0.5), uFac.z*0.5);
          float wy = step(uFac.w, f.y) * step(f.y, 0.94);
          winMask = uFac2.x > 0.5 ? step(0.03, f.x)*step(0.05, f.y) : wx*wy;
          winMask *= step(3.0, vFW.y + 20.0);
          // filter the window grid when it gets smaller than a few pixels
          float aa = clamp(max(fwidth(fl), fwidth(bay)) * 1.6 - 0.2, 0.0, 1.0);
          winRaw = winMask; winAA = aa;
          winMask = mix(winMask, uFac.z * (0.94 - uFac.w) * 0.9, aa);
          winCell = vec3(floor(bay), floor(fl), floor(hcoord*0.01) + uFac2.z);
          diffuseColor.rgb = mix(diffuseColor.rgb, uGlass, winMask);
        } else {
          // roofs: gravel / membrane with rooftop equipment speckle
          float g = fh(floor(vFW*1.3));
          diffuseColor.rgb = mix(vec3(0.42,0.41,0.39), vec3(0.55,0.54,0.52), g);
        }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, uFac2.w, winMask);`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
        metalnessFactor = mix(metalnessFactor, 0.35, winMask);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        if (uNight > 0.01) {
          float r = fh(winCell*1.37 + 0.11);
          float lit = step(1.0 - uFac2.y, r) * winRaw;
          vec3 warm = mix(vec3(1.0,0.72,0.42), vec3(0.85,0.9,1.0), step(0.8, fh(winCell+7.7)));
          vec3 near = warm * lit * (0.6 + 0.8*fh(winCell+3.3));
          vec3 far = vec3(1.0,0.8,0.55) * uFac2.y * uFac.z * 0.55;
          totalEmissiveRadiance += mix(near, far, winAA) * uNight * 1.6;
        }`);
  };
  mat.customProgramCacheKey = () => 'facade' + JSON.stringify(o);
  return mat;
}
function o_default(x) { return x || {}; }

// Extrude a footprint polygon ([[x,z],...] in world metres) to a prism mesh.
export function prism(points, h, base = 0) {
  const shape = new THREE.Shape(points.map(([x, z]) => new THREE.Vector2(x, -z)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false });
  g.rotateX(-Math.PI / 2);
  g.translate(0, base, 0);
  return g;
}
