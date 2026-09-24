import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

// Aerial perspective + marine layer. Reads the scene depth (logarithmic depth
// buffer), reconstructs each pixel's world position and integrates an
// exponential-height haze (scale height 1.2 km) plus an optional low fog bank,
// in-scattering sky and sun light with a Henyey–Greenstein forward lobe. This
// is what makes the skyline 3.5 km away read blue-grey and softer than the
// bridge, and the Golden Gate at 9 km softer still.

export class AtmospherePass extends Pass {
  constructor(camera, uniforms) {
    super();
    this.camera = camera;
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        tColor: { value: null }, tDepth: { value: null },
        uInvProj: { value: new THREE.Matrix4() }, uCamWorld: { value: new THREE.Matrix4() },
        uCamPos: { value: new THREE.Vector3() }, uFar: { value: camera.far },
        uSunDir: uniforms.sunDir, uSunColor: uniforms.sunColor, uHorizon: uniforms.horizonColor,
        uHaze: uniforms.haze, uFog: uniforms.fog, uFogTop: uniforms.fogTop, uTime: uniforms.time,
        uNight: uniforms.night,
      },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: /* glsl */`
        uniform sampler2D tColor, tDepth; uniform mat4 uInvProj, uCamWorld; uniform vec3 uCamPos;
        uniform float uFar, uHaze, uFog, uFogTop, uTime, uNight; uniform vec3 uSunDir, uSunColor, uHorizon;
        varying vec2 vUv;
        float hash(vec3 p){ p = fract(p*0.3183099+.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
        float noise(vec3 x){ vec3 i=floor(x), f=fract(x); f=f*f*(3.0-2.0*f);
          return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x), mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
                     mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x), mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y), f.z); }
        // optical depth of exponential haze from height y0 to y1 over distance D
        float hazeDepth(float y0, float y1, float D, float beta, float H){
          float dy = y1 - y0;
          if (abs(dy) < 1.0) return beta * exp(-y0/H) * D;
          return beta * H * (exp(-y0/H) - exp(-y1/H)) * D / dy;
        }
        void main(){
          vec4 col = texture2D(tColor, vUv);
          float d = texture2D(tDepth, vUv).x;
          vec4 ndc = vec4(vUv*2.0-1.0, 1.0, 1.0);
          vec4 vp = uInvProj * ndc; vec3 vdir = normalize(vp.xyz / vp.w);
          vec3 wdir = normalize((uCamWorld * vec4(vdir, 0.0)).xyz);
          bool sky = d >= 0.99999;
          float w = exp2(d * log2(uFar + 1.0)) - 1.0;         // view-space depth
          float D = sky ? 60000.0 : w / max(-vdir.z, 1e-4);   // distance along the ray
          float y0 = uCamPos.y + 3.6, y1 = y0 + wdir.y * D;
          float mu = dot(wdir, uSunDir);
          float g = 0.72;
          float hg = (1.0 - g*g) / (4.0*3.14159*pow(1.0 + g*g - 2.0*g*mu, 1.5));
          vec3 sunIn = uSunColor * max(uSunDir.y + 0.08, 0.0);
          // aerial haze (skip the sky: the sky model already includes it)
          vec3 outc = col.rgb;
          if (!sky) {
            float tau = hazeDepth(y0, max(y1, -5.0), D, uHaze, 1200.0);
            float T = exp(-tau);
            vec3 inscat = uHorizon * 0.9 + sunIn * hg * 1.6;
            outc = outc * T + inscat * (1.0 - T);
          }
          // marine layer: dense, low, drifting
          if (uFog > 0.001) {
            float top = uFogTop;
            float Dm = D;
            if (wdir.y > 0.0) Dm = min(D, max(top - y0, 0.0) / max(wdir.y, 1e-3));
            if (y0 > top && wdir.y < 0.0) Dm = max(0.0, D - (y0 - top)/max(-wdir.y,1e-3));
            vec3 mid = uCamPos + wdir * min(Dm, 3000.0) * 0.5;
            float n = noise(mid*0.004 + vec3(uTime*0.02, 0.0, uTime*0.012))*0.6 + noise(mid*0.013 + uTime*0.03)*0.4;
            float dens = uFog * uFog * 0.0022 * (0.55 + 0.9*n);
            float Tf = exp(-dens * Dm);
            vec3 fogCol = mix(uHorizon*1.25 + uSunColor*max(uSunDir.y,0.0)*0.35, vec3(0.35,0.36,0.38)*uHorizon.g*3.0, 0.3);
            fogCol += uSunColor * hg * 0.25 * max(uSunDir.y, 0.0);
            fogCol = mix(fogCol, vec3(0.05,0.04,0.035), uNight*0.0) ;
            outc = outc * Tf + fogCol * (1.0 - Tf);
          }
          gl_FragColor = vec4(outc, col.a);
        }`,
      depthTest: false, depthWrite: false,
    });
    this.fsQuad = new FullScreenQuad(this.material);
  }
  render(renderer, writeBuffer, readBuffer) {
    const u = this.material.uniforms;
    u.tColor.value = readBuffer.texture;
    u.tDepth.value = readBuffer.depthTexture;
    u.uInvProj.value.copy(this.camera.projectionMatrixInverse);
    u.uCamWorld.value.copy(this.camera.matrixWorld);
    u.uCamPos.value.copy(this.camera.position);
    u.uFar.value = this.camera.far;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.fsQuad.render(renderer);
  }
  dispose() { this.material.dispose(); this.fsQuad.dispose(); }
}
