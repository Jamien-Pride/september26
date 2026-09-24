import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';

// Daylight sky: Preetham analytic model tuned for a clear coastal sky.
// Night: a dark dome with an orange light-pollution glow toward San Francisco
// and Oakland, a star field, and a moon whose phase comes from the actual
// Sun–Moon geometry.

export class SkySystem {
  constructor(uniforms) {
    this.u = uniforms;
    this.group = new THREE.Group();
    this.sky = new Sky();
    this.sky.scale.setScalar(45000);
    this.sky.frustumCulled = false;
    const su = this.sky.material.uniforms;
    su.turbidity.value = 3.2;
    su.rayleigh.value = 1.6;
    su.mieCoefficient.value = 0.0045;
    su.mieDirectionalG.value = 0.82;
    su.cloudCoverage.value = 0.18;
    su.cloudElevation.value = 0.6;
    su.cloudDensity.value = 0.35;
    // Scale the sky's radiance so the dome, its reflections and the ambient
    // light it contributes stay in proportion to the direct sun.
    su.skyScale = { value: 0.38 };
    this.sky.material.fragmentShader = this.sky.material.fragmentShader
      .replace('uniform float showSunDisc;', 'uniform float showSunDisc;\nuniform float skyScale;')
      .replace('gl_FragColor = vec4( texColor, 1.0 );', 'gl_FragColor = vec4( texColor * skyScale, 1.0 );');
    this.sky.layers.enable(2);
    this.group.add(this.sky);

    // Night dome + stars (drawn behind everything, additive over the day sky).
    const nightMat = new THREE.ShaderMaterial({
      uniforms: { uNight: { value: 0 }, uSunDir: uniforms.sunDir, uTime: uniforms.time, uFog: uniforms.fog },
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix*modelViewMatrix*vec4(position,1.0); gl_Position = p.xyww; }`,
      fragmentShader: `
        varying vec3 vDir; uniform float uNight, uTime, uFog; uniform vec3 uSunDir;
        float h(vec3 p){ p = fract(p*0.3183099+.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
        void main(){
          vec3 d = normalize(vDir);
          float alt = max(d.y, 0.0);
          // twilight / night gradient
          vec3 zen = vec3(0.004,0.007,0.018), hor = vec3(0.020,0.024,0.040);
          vec3 col = mix(hor, zen, pow(alt, 0.5));
          // urban skyglow: SF (SW-W) and Oakland (E)
          float az = atan(d.x, -d.z);
          float a1 = atan(sin(az + 2.35), cos(az + 2.35)), a2 = atan(sin(az - 1.6), cos(az - 1.6));
          float sf = exp(-pow(a1/0.9, 2.0)) + 0.8*exp(-pow(a2/0.8, 2.0));
          col += vec3(0.030,0.018,0.010) * sf * exp(-alt*9.0) * (1.0+uFog*2.0);
          // stars
          vec3 q = floor(d*380.0);
          float s = h(q);
          float star = step(0.9965, s) * pow(h(q+3.1), 6.0) * 6.0;
          float tw = 0.75 + 0.25*sin(uTime*3.0 + s*80.0);
          col += vec3(star*tw) * smoothstep(0.02, 0.25, alt) * (1.0 - uFog);
          gl_FragColor = vec4(col * uNight, 1.0);
        }`,
      side: THREE.BackSide, depthWrite: false, blending: THREE.AdditiveBlending, transparent: true,
    });
    this.night = new THREE.Mesh(new THREE.SphereGeometry(44000, 32, 16), nightMat);
    this.night.frustumCulled = false;
    this.night.renderOrder = -2;
    this.night.layers.enable(2);
    this.group.add(this.night);

    // Moon: lit sphere, correct phase from sun direction.
    const moonMat = new THREE.ShaderMaterial({
      uniforms: { uSunDir: uniforms.sunDir, uVis: { value: 1 } },
      vertexShader: `varying vec3 vN; varying vec3 vP; void main(){ vN = normalize(mat3(modelMatrix)*normal); vP=position; vec4 p = projectionMatrix*modelViewMatrix*vec4(position,1.0); gl_Position = p; gl_Position.z = gl_Position.w*0.99999; }`,
      fragmentShader: `varying vec3 vN; varying vec3 vP; uniform vec3 uSunDir; uniform float uVis;
        float h(vec2 p){ return fract(sin(dot(p,vec2(12.9,78.2)))*43758.5); }
        void main(){ float l = max(dot(normalize(vN), normalize(uSunDir)), 0.0);
          float mare = 0.75 + 0.25*h(floor(vP.xy*0.02));
          vec3 c = vec3(1.0,0.97,0.9) * l * 1.8 * mare + vec3(0.002);
          gl_FragColor = vec4(c*uVis, 1.0); }`,
      depthWrite: false,
    });
    this.moon = new THREE.Mesh(new THREE.SphereGeometry(180, 32, 16), moonMat);
    this.moon.frustumCulled = false;
    this.moon.layers.enable(2);
    this.group.add(this.moon);
    // The sun, as a moon-sized geometry direction is rendered by Sky itself.
  }

  setSunDisc(on) { this.sky.material.uniforms.showSunDisc.value = on ? 1 : 0; }
  update(sunDir, moonDir, sunEl, fog, clouds = 0.18, time = 0) {
    const su = this.sky.material.uniforms;
    su.cloudCoverage.value = clouds;
    su.time.value = time;
    su.sunPosition.value.copy(sunDir);
    // Coastal haze thickens toward the horizon at low sun; fog washes out.
    su.turbidity.value = 3.0 + fog * 6.0;
    su.rayleigh.value = 1.5 + fog * 1.0;
    su.mieCoefficient.value = 0.004 + fog * 0.01;
    const night = THREE.MathUtils.smoothstep(-sunEl, -2, 14);
    this.night.material.uniforms.uNight.value = night;
    this.moon.position.copy(moonDir).multiplyScalar(40000);
    this.moon.lookAt(0, 0, 0);
    this.moon.material.uniforms.uVis.value = moonDir.y > -0.02 ? 1 - fog * 0.9 : 0;
  }
}

// Approximate irradiance from the sky dome (ambient fill) as a function of sun
// elevation, clear coastal conditions. Linear RGB, arbitrary units matched to
// a sun intensity of ~3.2 at zenith.
export function skyAmbient(sunEl, fog) {
  const keys = [
    [-18, [0.0006, 0.0008, 0.0016]],
    [-10, [0.0022, 0.003, 0.0065]],
    [-6, [0.010, 0.013, 0.026]],
    [-3, [0.035, 0.040, 0.070]],
    [0, [0.10, 0.10, 0.13]],
    [5, [0.22, 0.22, 0.27]],
    [15, [0.36, 0.40, 0.50]],
    [35, [0.46, 0.53, 0.66]],
    [70, [0.52, 0.60, 0.74]],
  ];
  let c = keys[0][1];
  if (sunEl >= keys[keys.length - 1][0]) c = keys[keys.length - 1][1];
  else for (let i = 1; i < keys.length; i++) {
    if (sunEl < keys[i][0]) {
      const t = (sunEl - keys[i - 1][0]) / (keys[i][0] - keys[i - 1][0]);
      c = keys[i - 1][1].map((v, k) => v + (keys[i][1][k] - v) * Math.max(0, t));
      break;
    }
  }
  // Fog/overcast: flatter, greyer, brighter relative to direct light.
  const g = (c[0] + c[1] + c[2]) / 3;
  return c.map((v) => THREE.MathUtils.lerp(v, g * 1.25, fog * 0.8));
}
