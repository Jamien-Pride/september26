import * as THREE from 'three';

// San Francisco Bay water: a planar mirror reflection (so the bridge, Yerba Buena
// Island, the skyline and the sculpture all reflect), distorted by layered
// wind-driven normal maps, Schlick Fresnel for water (F0 = 0.02), a GGX sun
// glitter lobe whose width grows with distance (sub-pixel waves), and a murky
// green-grey body colour typical of the Bay's suspended sediment.

export class BayWater {
  constructor(renderer, scene, normalTex, uniforms, { resolutionScale = 0.5 } = {}) {
    this.renderer = renderer; this.scene = scene; this.u = uniforms;
    this.resolutionScale = resolutionScale;
    normalTex.wrapS = normalTex.wrapT = THREE.RepeatWrapping;
    normalTex.anisotropy = 8;
    this.target = new THREE.WebGLRenderTarget(512, 512, { type: THREE.HalfFloatType, samples: 2 });
    this.textureMatrix = new THREE.Matrix4();
    this.mirrorCamera = new THREE.PerspectiveCamera();
    this.mirrorCamera.layers.set(0);
    this.mirrorCamera.layers.enable(2); // "reflect" layer
    const geo = new THREE.PlaneGeometry(90000, 90000, 1, 1);
    geo.rotateX(-Math.PI / 2);
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        tNormal: { value: normalTex },
        tMirror: { value: this.target.texture },
        textureMatrix: { value: this.textureMatrix },
        uTime: uniforms.time,
        uSunDir: uniforms.sunDir,
        uSunColor: uniforms.sunColor,
        uSkyColor: uniforms.skyColor,
        uMoonDir: uniforms.moonDir,
        uMoonColor: uniforms.moonColor,
        uWind: uniforms.wind,
        uWaterColor: { value: new THREE.Color(0.014, 0.032, 0.026) },
        uWaterY: uniforms.waterY,
      },
      vertexShader: /* glsl */`
        #include <common>
        #include <logdepthbuf_pars_vertex>
        uniform mat4 textureMatrix; uniform float uWaterY;
        varying vec4 vMirror; varying vec3 vWPos;
        void main(){
          vec3 p = position; p.y = uWaterY;
          vec4 wp = modelMatrix * vec4(p,1.0);
          vWPos = wp.xyz;
          vMirror = textureMatrix * wp;
          gl_Position = projectionMatrix * viewMatrix * wp;
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: /* glsl */`
        #include <common>
        #include <logdepthbuf_pars_fragment>
        uniform sampler2D tNormal, tMirror; uniform float uTime, uWind;
        uniform vec3 uSunDir, uSunColor, uSkyColor, uWaterColor, uMoonDir, uMoonColor;
        varying vec4 vMirror; varying vec3 vWPos;
        vec3 nrm(vec2 uv){ return texture2D(tNormal, uv).xzy*2.0-1.0; }
        void main(){
          #include <logdepthbuf_fragment>
          vec3 toEye = cameraPosition - vWPos; float dist = length(toEye); vec3 V = toEye/dist;
          // prevailing WSW wind -> waves travelling ENE
          vec2 wdir = normalize(vec2(0.88,-0.47));
          mat2 rot = mat2(wdir.x, -wdir.y, wdir.y, wdir.x);
          vec2 p = rot * vWPos.xz;
          float t = uTime;
          float chop = mix(0.6, 1.9, uWind);
          vec3 n = nrm(p/5.1  + vec2( t*0.043, 0.0)) * 0.9
                 + nrm(p/13.7 + vec2( t*0.021, t*0.007)) * 1.0
                 + nrm(p/37.0 - vec2(-t*0.011, t*0.009)) * 0.8
                 + nrm(p/1.9  + vec2( t*0.09, -t*0.03)) * 0.45;
          n.xz = (rot * n.xz);
          // fade detail with distance: far water is optically smoother but glittery
          float fade = 0.5 + 0.5/(1.0 + dist*0.004);
          n = normalize(vec3(n.x*chop*0.34*fade, 1.0, n.z*chop*0.34*fade));
          float NdV = max(dot(n, V), 0.001);
          float F = 0.02 + 0.98*pow(1.0-NdV, 5.0);
          // planar reflection with normal distortion
          vec2 muv = vMirror.xy / vMirror.w + n.xz * (0.06 / (1.0 + dist*0.0015));
          vec3 refl = texture2D(tMirror, muv).rgb;
          // sun glitter: GGX with roughness from unresolved wave slopes
          float rough = clamp(0.05 + dist*0.00005 + uWind*0.04, 0.05, 0.3);
          vec3 H = normalize(uSunDir + V);
          float NdH = max(dot(n,H),0.0), a2 = rough*rough*rough*rough;
          float D = a2 / (PI * pow(NdH*NdH*(a2-1.0)+1.0, 2.0));
          float NdL = max(dot(n,uSunDir),0.0);
          float Fs = 0.02 + 0.98*pow(1.0-max(dot(H,V),0.0),5.0);
          vec3 spec = uSunColor * D * Fs * NdL / (4.0*NdV*max(NdL,0.05)+0.0001) * step(0.0, uSunDir.y) * NdL;
          vec3 Hm = normalize(uMoonDir + V);
          float NdHm = max(dot(n,Hm),0.0);
          float Dm = a2 / (PI * pow(NdHm*NdHm*(a2-1.0)+1.0, 2.0));
          spec += uMoonColor * Dm * 0.02 * step(0.0, uMoonDir.y);
          // body colour: light scattered back out of the turbid water column
          float sunUp = clamp(uSunDir.y*3.0, 0.0, 1.0);
          vec3 body = uWaterColor * (uSkyColor*1.2 + uSunColor*max(uSunDir.y,0.0)*0.9);
          body *= 1.0 + 0.5*pow(max(dot(-V, uSunDir),0.0),4.0)*sunUp;
          vec3 col = mix(body, refl, F) + spec;
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.name = 'water';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -1;
    this.mesh.onBeforeRender = (r, s, cam) => this.renderReflection(cam);
    this._plane = new THREE.Plane(); this._clip = new THREE.Vector4();
    this._q = new THREE.Vector4();
    this.enabled = true;
  }

  setSize(w, h) {
    this.target.setSize(Math.max(64, Math.floor(w * this.resolutionScale)), Math.max(64, Math.floor(h * this.resolutionScale)));
  }

  renderReflection(camera) {
    if (!this.enabled || this._rendering) return;
    const y = this.u.waterY.value;
    const mc = this.mirrorCamera;
    // Mirror the camera about the water plane.
    mc.position.copy(camera.position); mc.position.y = 2 * y - camera.position.y;
    const dir = new THREE.Vector3(); camera.getWorldDirection(dir); dir.y = -dir.y;
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion); up.y = -up.y;
    mc.up.copy(up);
    mc.lookAt(mc.position.clone().add(dir));
    mc.fov = camera.fov; mc.aspect = camera.aspect; mc.near = camera.near; mc.far = camera.far;
    mc.updateProjectionMatrix(); mc.updateMatrixWorld();
    this.textureMatrix.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
    this.textureMatrix.multiply(mc.projectionMatrix).multiply(mc.matrixWorldInverse);
    // Oblique near-plane clipping so nothing below the water leaks in.
    this._plane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, y, 0));
    this._plane.applyMatrix4(mc.matrixWorldInverse);
    const c = this._clip.set(this._plane.normal.x, this._plane.normal.y, this._plane.normal.z, this._plane.constant);
    const pm = mc.projectionMatrix, q = this._q;
    q.x = (Math.sign(c.x) + pm.elements[8]) / pm.elements[0];
    q.y = (Math.sign(c.y) + pm.elements[9]) / pm.elements[5];
    q.z = -1.0; q.w = (1.0 + pm.elements[10]) / pm.elements[14];
    c.multiplyScalar(2.0 / c.dot(q));
    pm.elements[2] = c.x; pm.elements[6] = c.y; pm.elements[10] = c.z + 1.0 - 0.0; pm.elements[14] = c.w;
    mc.projectionMatrixInverse.copy(pm).invert();

    const r = this.renderer;
    const prevTarget = r.getRenderTarget(), prevXr = r.xr.enabled, prevShadow = r.shadowMap.autoUpdate;
    this._rendering = true;
    this.mesh.visible = false;
    if (this.beforeMirror) this.beforeMirror();
    r.xr.enabled = false; r.shadowMap.autoUpdate = false;
    r.setRenderTarget(this.target);
    r.state.buffers.depth.setMask(true);
    if (r.autoClear === false) r.clear();
    r.render(this.scene, mc);
    this.mesh.visible = true;
    if (this.afterMirror) this.afterMirror();
    r.xr.enabled = prevXr; r.shadowMap.autoUpdate = prevShadow;
    r.setRenderTarget(prevTarget);
    this._rendering = false;
  }
}
