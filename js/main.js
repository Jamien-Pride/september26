import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { SITE, bearingVec, elevToY } from './geo.js';
import { sunPosition, moonPosition, dirFromAzEl, sunTransmittance, pacificToDate, pacificParts, dayEvents, tzAbbrev } from './sun.js';
import { SkySystem, skyAmbient } from './sky.js';
import { loadTerrainData, buildLandcoverTexture, buildTerrain, classify } from './terrain.js';
import { BayWater } from './water.js';
import { Sculpture, CONE } from './sculpture.js';
import { ReflectedLight } from './caustics.js';
import { buildSplat, makeHeightFn, buildGround, buildRiprap, buildFurniture, buildBuildings, buildFerryPier, parkExclusion } from './park.js';
import { buildVegetation } from './vegetation.js';
import { buildLawnGrass } from './grass.js';
import { buildBayBridge, buildGoldenGate } from './bridge.js';
import { buildCity } from './city.js';
import { AtmospherePass } from './atmosphere.js';
import { initUI } from './ui.js';

const $ = (id) => document.getElementById(id);
const progress = (t, f) => { $('load-msg').textContent = t; $('load-bar').style.width = `${Math.round(f * 100)}%`; };
const tick = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));

// ---------------------------------------------------------------------------
const QUALITY = {
  low: { pr: 1, grass: 90000, shadow: 2048, water: 0.35, cube: 128, bloom: false },
  medium: { pr: 1.25, grass: 220000, shadow: 3072, water: 0.5, cube: 192, bloom: true },
  high: { pr: 2, grass: 420000, shadow: 4096, water: 0.6, cube: 256, bloom: true },
};
const coarse = matchMedia('(pointer: coarse)').matches;
const params = new URLSearchParams(location.search);
const MAX_FRAMES = +(params.get('frames') || 0); // debugging: stop after N frames
let frameCount = 0;
const state = {
  quality: params.get('q') || (coarse ? 'low' : 'medium'),
  date: null, minutes: 0, playing: false, speed: 20, // speed = simulated minutes per real second
  facing: 229.4, paint: 'gloss', metal: 'mirror', uplights: 'auto',
  haze: 0.35, fog: 0, wind: 0.45, tide: 0, clouds: 0.18,
  heatmap: false, mode: 'orbit',
};

const shared = {
  time: { value: 0 }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunColor: { value: new THREE.Vector3(1, 1, 1) },
  sunRad: { value: new THREE.Vector3(3, 3, 3) }, skyColor: { value: new THREE.Vector3(0.4, 0.45, 0.55) },
  horizonColor: { value: new THREE.Vector3(0.5, 0.55, 0.6) },
  moonDir: { value: new THREE.Vector3(0, -1, 0) }, moonColor: { value: new THREE.Vector3(0, 0, 0) },
  wind: { value: 0.45 }, waterY: { value: elevToY(SITE.meanSeaLevelNavd) }, season: { value: 1 },
  haze: { value: 8e-5 }, fog: { value: 0 }, fogTop: { value: 260 }, night: { value: 0 },
  camXZ: { value: new THREE.Vector2() }, pixelRatio: { value: 1 },
  w2l: { value: new THREE.Matrix4() }, caustic: { value: null }, causticRect: { value: new THREE.Vector4() },
  poles: { value: [] }, poleOn: { value: 0 }, wet: { value: 0 },
};

// ---------------------------------------------------------------------------
const canvas = $('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, logarithmicDepthBuffer: true, powerPreference: 'high-performance' });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = params.get('tm') === 'agx' ? THREE.AgXToneMapping : params.get('tm') === 'aces' ? THREE.ACESFilmicToneMapping : THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(46, 1, 0.08, 60000);
camera.layers.enable(0);

const sunLight = new THREE.DirectionalLight(0xffffff, 3);
sunLight.castShadow = true;
sunLight.shadow.bias = -0.0002;
sunLight.shadow.normalBias = 0.03;
sunLight.shadow.radius = 2.5;
const SHADOW_HALF = 60;
Object.assign(sunLight.shadow.camera, { left: -SHADOW_HALF, right: SHADOW_HALF, top: SHADOW_HALF, bottom: -SHADOW_HALF, near: 1, far: 600 });
scene.add(sunLight, sunLight.target);

const pmrem = new THREE.PMREMGenerator(renderer);
const ENV_SCALE = +(params.get('env') || 1.0);
const EXPOSURE_BIAS = +(params.get('ev') || 1.0);
let composer, bloomPass, atmoPass, water, sky, sculpture, reflected, grass, bridge, heightFn;
let orbit, envSkyRT = null, sculptEnvRT = null, cubeCam, cubeRT, skyScene, heatmapMesh;
const tmpV = new THREE.Vector3();

async function build() {
  progress('Loading elevation data for the Bay…', 0.05);
  const td = await loadTerrainData('data/');
  const landcover = buildLandcoverTexture(td);
  await tick();

  progress('Laying out Cityside Park…', 0.18);
  const splat = buildSplat();
  heightFn = makeHeightFn(splat, shared.waterY);
  await tick();

  progress('Sky, sun and the Bay…', 0.28);
  sky = new SkySystem(shared);
  scene.add(sky.group);
  sky.group.traverse((o) => o.layers.enable(3));
  skyScene = new THREE.Scene();
  const normalTex = await new THREE.TextureLoader().loadAsync('assets/waternormals.jpg');
  water = new BayWater(renderer, scene, normalTex, shared, { resolutionScale: QUALITY[state.quality].water });
  water.beforeMirror = () => sky.setSunDisc(false);
  water.afterMirror = () => sky.setSunDisc(true);
  scene.add(water.mesh);
  await tick();

  progress('Terrain: Yerba Buena Island, San Francisco, Marin, East Bay…', 0.38);
  const terrain = buildTerrain(td, landcover, shared, parkExclusion);
  terrain.traverse((o) => { if (o.isMesh) { o.layers.enable(2); o.layers.enable(3); } });
  scene.add(terrain);
  await tick();

  progress('Park ground, paths and riprap seawall…', 0.48);
  const ground = buildGround(splat, heightFn, shared);
  ground.layers.enable(2); ground.layers.enable(3);
  scene.add(ground);
  scene.add(buildRiprap(heightFn, shared.waterY));
  scene.add(buildFurniture(heightFn, shared));
  scene.add(buildBuildings(shared, heightFn));
  scene.add(buildFerryPier(shared.waterY));
  scene.traverse((o) => { if (o.name === 'riprap') { o.layers.enable(2); o.layers.enable(3); } });
  await tick();

  progress('Planting: coast live oaks, palms, native beds…', 0.58);
  scene.add(buildVegetation(heightFn, splat, shared, td, classify));
  grass = buildLawnGrass(splat, null, shared, { count: QUALITY.high.grass });
  grass.geometry.instanceCount = QUALITY[state.quality].grass;
  scene.add(grass);
  await tick();

  progress('Bay Bridge west span, Golden Gate, skyline…', 0.7);
  bridge = buildBayBridge(shared, td);
  scene.add(bridge);
  scene.add(buildGoldenGate());
  scene.add(buildCity(td, shared));
  await tick();

  progress('Fabricating the sculpture…', 0.8);
  sculpture = new Sculpture(shared);
  scene.add(sculpture.group);
  reflected = new ReflectedLight();
  shared.caustic.value = reflected.texture;
  shared.causticRect.value.copy(reflected.rect);
  buildHeatmap();
  applyFacing();
  await tick();

  progress('Environment reflections…', 0.88);
  cubeRT = new THREE.WebGLCubeRenderTarget(QUALITY[state.quality].cube, { type: THREE.HalfFloatType, generateMipmaps: false });
  cubeCam = new THREE.CubeCamera(0.3, 60000, cubeRT);
  cubeCam.children.forEach((c) => c.layers.set(3));
  scene.add(cubeCam);

  setupComposer();
  setupControls();
  await tick();
}

// Ground-plane colormap of reflected irradiance (analysis overlay).
function buildHeatmap() {
  const g = new THREE.PlaneGeometry(reflected.rect.z, reflected.rect.w, 1, 1);
  g.rotateX(-Math.PI / 2);
  const m = new THREE.ShaderMaterial({
    uniforms: { tMap: { value: reflected.texture } },
    vertexShader: `#include <common>
      #include <logdepthbuf_pars_vertex>
      varying vec2 vUv; void main(){ vUv = vec2(uv.x, 1.0-uv.y); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);
      #include <logdepthbuf_vertex>
      }`,
    fragmentShader: `#include <common>
      #include <logdepthbuf_pars_fragment>
      uniform sampler2D tMap; varying vec2 vUv;
      vec3 ramp(float x){ // 0 → 3+ suns
        vec3 a = vec3(0.1,0.3,0.9), b = vec3(0.1,0.85,0.4), c = vec3(1.0,0.85,0.1), d = vec3(1.0,0.2,0.1), e = vec3(1.0,1.0,1.0);
        return x < 0.25 ? mix(a,b,x/0.25) : x < 0.5 ? mix(b,c,(x-0.25)/0.25) : x < 1.0 ? mix(c,d,(x-0.5)/0.5) : mix(d,e,clamp(x-1.0,0.0,1.0)); }
      void main(){
        #include <logdepthbuf_fragment>
        float v = texture2D(tMap, vUv).r; if (v < 0.03) discard;
        gl_FragColor = vec4(ramp(v) * 0.9, clamp(v*3.0, 0.0, 0.8)); }`,
    transparent: true, depthWrite: false, toneMapped: false,
  });
  heatmapMesh = new THREE.Mesh(g, m);
  heatmapMesh.position.y = 0.05;
  heatmapMesh.visible = false;
  heatmapMesh.renderOrder = 5;
  sculpture.group.add(heatmapMesh);
}

function setupComposer() {
  const q = QUALITY[state.quality];
  const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
  rt.depthTexture = new THREE.DepthTexture(1, 1, THREE.FloatType);
  composer = new EffectComposer(renderer, rt);
  composer.addPass(new RenderPass(scene, camera));
  atmoPass = new AtmospherePass(camera, shared);
  composer.addPass(atmoPass);
  bloomPass = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.22, 0.55, 4.0);
  bloomPass.enabled = q.bloom;
  composer.addPass(bloomPass);
  composer.addPass(new OutputPass());
  resize();
}

function resize() {
  const q = QUALITY[state.quality];
  const pr = Math.min(window.devicePixelRatio || 1, q.pr);
  const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
  renderer.setPixelRatio(pr);
  renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  if (composer) { composer.setPixelRatio(pr); composer.setSize(w, h); }
  if (water) water.setSize(w * pr, h * pr);
  shared.pixelRatio.value = pr;
}
window.addEventListener('resize', resize);

// ---------------------------------------------------------------------------
// Camera: orbit around the sculpture, or walk at eye height.
const walk = { yaw: 0, pitch: 0, keys: new Set(), joy: { x: 0, y: 0 }, pos: new THREE.Vector3() };
const EYE = 1.65;
function setupControls() {
  orbit = new OrbitControls(camera, canvas);
  orbit.enableDamping = true; orbit.dampingFactor = 0.08;
  orbit.minDistance = 1.2; orbit.maxDistance = 900;
  orbit.maxPolarAngle = Math.PI * 0.495;
  orbit.target.set(0, 2.1, 0);
  gotoPreset('hero', true);
  let dragging = false, lx = 0, ly = 0;
  canvas.addEventListener('pointerdown', (e) => { if (state.mode !== 'walk') return; dragging = true; lx = e.clientX; ly = e.clientY; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging || state.mode !== 'walk') return;
    walk.yaw -= (e.clientX - lx) * 0.0032; walk.pitch = THREE.MathUtils.clamp(walk.pitch - (e.clientY - ly) * 0.0032, -1.35, 1.35);
    lx = e.clientX; ly = e.clientY;
  });
  canvas.addEventListener('pointerup', () => { dragging = false; });
  window.addEventListener('keydown', (e) => { if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return; walk.keys.add(e.code); });
  window.addEventListener('keyup', (e) => walk.keys.delete(e.code));
}

// Viewpoints, defined in the sculpture's frame (+z = out of the mouth).
const PRESETS = {
  hero: { pos: [-5.5, 1.65, 12.5], look: [0.3, 2.2, 0], label: 'From the lawn' },
  portal: { pos: [0.35, 1.65, -7.2], look: [0, 1.55, 12], label: 'Through the portal' },
  mouth: { pos: [3.2, 1.65, 8.5], look: [0, 2.3, 0], label: 'At the mouth' },
  inside: { pos: [0.15, 1.6, 1.1], look: [0, 2.7, -3], label: 'Inside the funnel' },
  lawn: { pos: [-14, 1.65, 30], look: [0, 2.2, 0], label: 'Across the lawn' },
  side: { pos: [-13, 1.65, 3], look: [0, 2.4, 0.4], label: 'From the path' },
  bench: { pos: [5.4, 1.2, 0.2], look: [0, 2.6, 1.2], label: 'Bench' },
  bay: { pos: [-6, 1.65, -14], look: [0, 2.5, 0], label: 'Toward the bridge' },
  aerial: { pos: [60, 55, 80], look: [0, 0, 0], label: 'Aerial' },
};
export function gotoPreset(name, instant = false) {
  const p = PRESETS[name];
  const m = sculpture.group.matrixWorld;
  const pos = new THREE.Vector3(...p.pos).applyMatrix4(m), look = new THREE.Vector3(...p.look).applyMatrix4(m);
  if (name === 'bay') { // face the Bay Bridge's centre anchorage from here
    look.set(-320, 60, 2230);
  }
  pos.y = heightFn(pos.x, pos.z) + p.pos[1];
  if (state.mode === 'walk') {
    walk.pos.copy(pos);
    const d = look.clone().sub(pos);
    walk.yaw = Math.atan2(-d.x, -d.z); walk.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
  } else {
    // keep the orbit pivot within reach for far-away look targets
    const d = look.clone().sub(pos);
    if (d.length() > 60) look.copy(pos).addScaledVector(d.normalize(), 15);
    camera.position.copy(pos); orbit.target.copy(look); orbit.update();
  }
}

function setMode(mode) {
  state.mode = mode;
  if (mode === 'walk') {
    orbit.enabled = false;
    walk.pos.copy(camera.position); walk.pos.y = heightFn(walk.pos.x, walk.pos.z) + EYE;
    const d = orbit.target.clone().sub(camera.position);
    walk.yaw = Math.atan2(-d.x, -d.z); walk.pitch = THREE.MathUtils.clamp(Math.atan2(d.y, Math.hypot(d.x, d.z)), -1, 1);
  } else {
    orbit.enabled = true;
    const f = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(walk.pitch, walk.yaw, 0, 'YXZ'));
    orbit.target.copy(camera.position).addScaledVector(f, 8);
    orbit.update();
  }
}

function updateWalk(dt) {
  const k = walk.keys;
  let fx = 0, fz = 0;
  if (k.has('KeyW') || k.has('ArrowUp')) fz += 1;
  if (k.has('KeyS') || k.has('ArrowDown')) fz -= 1;
  if (k.has('KeyA') || k.has('ArrowLeft')) fx -= 1;
  if (k.has('KeyD') || k.has('ArrowRight')) fx += 1;
  fx += walk.joy.x; fz += walk.joy.y;
  const speed = (k.has('ShiftLeft') || k.has('ShiftRight')) ? 4.2 : 1.4; // walking pace, m/s
  const fwd = new THREE.Vector3(-Math.sin(walk.yaw), 0, -Math.cos(walk.yaw)), right = new THREE.Vector3(-fwd.z, 0, fwd.x);
  const mv = fwd.multiplyScalar(fz).add(right.multiplyScalar(fx));
  if (mv.lengthSq() > 0) {
    mv.normalize().multiplyScalar(speed * dt);
    const next = walk.pos.clone().add(mv);
    if (!sculpture.blocks(next)) walk.pos.copy(next);
    else { // slide along the wall
      const nx = walk.pos.clone(); nx.x += mv.x; if (!sculpture.blocks(nx)) walk.pos.copy(nx);
      const nz = walk.pos.clone(); nz.z += mv.z; if (!sculpture.blocks(nz)) walk.pos.copy(nz);
    }
  }
  const gy = heightFn(walk.pos.x, walk.pos.z);
  walk.pos.y += (gy + EYE - walk.pos.y) * Math.min(1, dt * 10);
  camera.position.copy(walk.pos);
  camera.quaternion.setFromEuler(new THREE.Euler(walk.pitch, walk.yaw, 0, 'YXZ'));
}

function applyFacing() {
  const d = bearingVec(state.facing);
  sculpture.group.rotation.y = Math.atan2(d.x, d.z);
  sculpture.group.updateMatrixWorld(true);
  envDirty = true; causticDirty = true;
}

// ---------------------------------------------------------------------------
// Sun, sky, light
let envDirty = true, causticDirty = true, lastSunKey = '', lastEnvTime = 0, dragging = false;
const sunInfo = { az: 0, el: 0, date: new Date() };
function currentDate() {
  return pacificToDate(state.date.y, state.date.m, state.date.d, state.minutes);
}
function updateSun() {
  const date = currentDate();
  const sp = sunPosition(date, SITE.lat, SITE.lon);
  const mp = moonPosition(date, SITE.lat, SITE.lon);
  sunInfo.az = sp.azimuth; sunInfo.el = sp.elevation; sunInfo.date = date;
  const sunDir = dirFromAzEl(sp.azimuth, sp.elevation, shared.sunDir.value);
  const moonDir = dirFromAzEl(mp.azimuth, mp.elevation, shared.moonDir.value);
  const fog = state.fog;
  const T = sunTransmittance(sp.elevation, 2.4 + state.haze * 3 + fog * 4);
  const fogDim = 1 - fog * 0.85;
  const SUN = 3.3;
  shared.sunRad.value.set(T[0] * SUN * fogDim, T[1] * SUN * fogDim, T[2] * SUN * fogDim);
  shared.sunColor.value.set(T[0] * SUN, T[1] * SUN, T[2] * SUN);
  const amb = skyAmbient(sp.elevation, fog);
  shared.skyColor.value.set(...amb);
  shared.horizonColor.value.set(amb[0] * 1.15 + T[0] * 0.08, amb[1] * 1.12 + T[1] * 0.06, amb[2] * 1.05 + T[2] * 0.03);
  const night = THREE.MathUtils.smoothstep(-sp.elevation, -1, 8);
  shared.night.value = night;
  // moon: phase-weighted, only relevant after dusk
  const phase = (1 - sunDir.dot(moonDir)) / 2; // 1 = full
  const moonI = moonDir.y > 0 ? 0.035 * phase * phase * night : 0;
  shared.moonColor.value.set(moonI * 0.8, moonI * 0.88, moonI);
  sky.update(sunDir, moonDir, sp.elevation, fog, state.clouds, shared.time.value);
  // directional light follows sun by day, moon by night
  const useMoon = sp.elevation < -2 && moonDir.y > 0.05;
  const L = useMoon ? moonDir : sunDir;
  const col = useMoon ? new THREE.Color(moonI * 0.75, moonI * 0.85, moonI) : new THREE.Color(shared.sunRad.value.x, shared.sunRad.value.y, shared.sunRad.value.z);
  const I = Math.max(col.r, col.g, col.b);
  sunLight.color.setRGB(col.r / (I || 1), col.g / (I || 1), col.b / (I || 1));
  sunLight.intensity = sp.elevation > -1.5 || useMoon ? I : 0;
  sunLight.userData.dir = L.clone();
  // exposure: meter for an 18% grey card lying in the open (camera/eye adaptation)
  const E = shared.sunRad.value.y * Math.max(sunDir.y, 0) + Math.PI * amb[1] * 1.1 + 0.0004;
  const exposure = THREE.MathUtils.clamp(Math.pow(Math.PI / E, 0.86) * EXPOSURE_BIAS, 0.3, 60);
  renderer.toneMappingExposure = exposure;
  if (bloomPass) bloomPass.threshold = 3.5 / Math.sqrt(exposure);
  // lights come on at civil dusk
  const lightsOn = THREE.MathUtils.smoothstep(-sp.elevation, -3, 2);
  shared.poleOn.value = lightsOn * 14;
  if (shared.poleLensMat) shared.poleLensMat.emissiveIntensity = lightsOn * 5;
  const up = state.uplights === 'on' ? 1 : state.uplights === 'off' ? 0 : lightsOn;
  sculpture.update(sunDir, new THREE.Color(shared.sunRad.value.x, shared.sunRad.value.y, shared.sunRad.value.z), up);
  bridge.userData.update(night);
  // season: golden hills from late May to November, green after the rains
  const m = state.date.m + state.date.d / 31;
  shared.season.value = THREE.MathUtils.clamp(m < 6 ? (m - 4.5) / 1.5 : m > 11 ? 1 - (m - 11) / 1 : 1, 0, 1);
  const key = `${sp.azimuth.toFixed(1)}|${sp.elevation.toFixed(1)}|${fog}|${state.facing}`;
  if (key !== lastSunKey) { lastSunKey = key; envDirty = true; causticDirty = true; }
  ui.setReadout({ az: sp.azimuth, el: sp.elevation, date, tz: tzAbbrev(date) });
}

function updateShadowFrustum() {
  const L = sunLight.userData.dir || shared.sunDir.value;
  // centre the shadow map on what the viewer is looking at
  const focus = state.mode === 'walk' ? camera.position.clone().add(new THREE.Vector3(0, 0, -20).applyQuaternion(camera.quaternion).setY(0)) : orbit.target.clone();
  focus.y = 0;
  if (focus.length() < 40) focus.set(0, 0, 0);
  sunLight.target.position.copy(focus);
  sunLight.position.copy(focus).addScaledVector(L, 300);
  sunLight.target.updateMatrixWorld();
}

function updateEnv(now) {
  // Sky-only environment for the whole scene (ambient + general reflections).
  if (!envDirty) return;
  if (dragging && now - lastEnvTime < 180) return;
  lastEnvTime = now;
  envDirty = false;
  sky.setSunDisc(false);
  const prevSkyParent = sky.group.parent;
  skyScene.add(sky.group);
  sky.sky.material.uniforms.sunPosition.value.copy(shared.sunDir.value);
  const newSky = pmrem.fromScene(skyScene, 0, 0.1, 60000);
  prevSkyParent.add(sky.group);
  if (envSkyRT) envSkyRT.dispose();
  envSkyRT = newSky;
  scene.environment = envSkyRT.texture;
  scene.environmentIntensity = ENV_SCALE;
  // Local environment for the sculpture: the park, bridge and skyline as seen
  // from in front of the mouth (the sculpture itself is ray-traced).
  const c = new THREE.Vector3(0, 2.2, 3.2).applyMatrix4(sculpture.group.matrixWorld);
  cubeCam.position.copy(c);
  const vis = water.enabled; water.enabled = false;
  const gVis = grass.visible; grass.visible = false;
  cubeCam.update(renderer, scene);
  water.enabled = vis; grass.visible = gVis;
  if (sculptEnvRT) sculptEnvRT.dispose();
  sculptEnvRT = pmrem.fromCubemap(cubeRT.texture);
  sculpture.setEnvMap(sculptEnvRT.texture);
  sky.setSunDisc(true);
}

function updateCaustics() {
  if (!causticDirty) return;
  causticDirty = false;
  const sunL = shared.sunDir.value.clone().transformDirection(sculpture.traceUniforms.uW2L.value);
  reflected.roughness = sculpture.mirrorMat.roughness;
  const stats = reflected.compute(sunL, dragging ? 40000 : 180000);
  ui.setAnalysis(stats, sunInfo);
}

// ---------------------------------------------------------------------------
let ui;
const clock = new THREE.Timer();
function frame() {
  clock.update(); const dt = Math.min(clock.getDelta(), 0.1);
  step(dt);
  frameCount++;
  if (MAX_FRAMES && frameCount >= MAX_FRAMES) { window.__done = true; return; }
  requestAnimationFrame(frame);
}
function step(dt) {
  shared.time.value += dt;
  if (state.playing) {
    state.minutes += dt * state.speed;
    if (state.minutes >= 1440) { state.minutes -= 1440; advanceDay(1); }
    ui.setTime(state.minutes);
  }
  updateSun();
  if (state.mode === 'walk') updateWalk(dt); else orbit.update();
  // keep the orbit camera above ground
  if (state.mode !== 'walk') {
    const gy = heightFn(camera.position.x, camera.position.z) + 0.35;
    if (camera.position.y < gy) camera.position.y = gy;
  }
  shared.camXZ.value.set(camera.position.x, camera.position.z);
  updateShadowFrustum();
  const now = performance.now();
  updateEnv(now);
  if (!dragging) updateCaustics();
  composer.render(dt);
}
function advanceDay(n) {
  const d = new Date(Date.UTC(state.date.y, state.date.m - 1, state.date.d + n));
  state.date = { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() };
  ui.setDate(state.date, dayEvents(state.date.y, state.date.m, state.date.d, SITE.lat, SITE.lon));
}

// ---------------------------------------------------------------------------
async function main() {
  const now = pacificParts(new Date());
  state.date = { y: now.y, m: now.m, d: now.d };
  const ev = dayEvents(now.y, now.m, now.d, SITE.lat, SITE.lon);
  // open in the late-afternoon light, when the sun is in the mouth
  state.minutes = ev.sunset ? Math.round(ev.sunset - 95) : 17 * 60;
  ui = initUI(state, {
    onTime: (m) => { state.minutes = m; },
    onDate: (y, m, d) => { state.date = { y, m, d }; return dayEvents(y, m, d, SITE.lat, SITE.lon); },
    onPlay: (p) => { state.playing = p; },
    onSpeed: (s) => { state.speed = s; },
    onDrag: (d) => { dragging = d; if (!d) { envDirty = true; causticDirty = true; } },
    onPreset: (n) => gotoPreset(n),
    onMode: (m) => setMode(m),
    onFacing: (f) => { state.facing = f; applyFacing(); },
    onFinish: (paint, metal) => { state.paint = paint; state.metal = metal; sculpture.setFinish(paint, metal); envDirty = true; causticDirty = true; },
    onUplights: (u) => { state.uplights = u; },
    onConditions: (c) => {
      Object.assign(state, c);
      shared.haze.value = 4e-5 + state.haze * 1.6e-4;
      shared.fog.value = state.fog; shared.wind.value = state.wind;
      shared.waterY.value = elevToY(SITE.meanSeaLevelNavd) + state.tide;
      envDirty = true;
    },
    onHeatmap: (on) => { state.heatmap = on; heatmapMesh.visible = on; },
    onQuality: (q) => { state.quality = q; applyQuality(); },
    onLens: (v) => { camera.fov = v; camera.updateProjectionMatrix(); },
    onJoystick: (x, y) => { walk.joy.x = x; walk.joy.y = y; },
    presets: PRESETS,
  });
  ui.setDate(state.date, ev);
  ui.setTime(state.minutes);
  try {
    await build();
  } catch (err) {
    console.error(err);
    progress(`Could not build the scene: ${err.message}. WebGL 2 is required.`, 1);
    return;
  }
  progress('Ready', 1);
  window.__app = { THREE, scene, camera, renderer, state, shared, sculpture, reflected, gotoPreset, setMode, sunInfo, get orbit() { return orbit; }, step };
  document.body.classList.add('ready');
  requestAnimationFrame(frame);
}

function applyQuality() {
  const q = QUALITY[state.quality];
  sunLight.shadow.mapSize.set(q.shadow, q.shadow);
  if (sunLight.shadow.map) { sunLight.shadow.map.dispose(); sunLight.shadow.map = null; }
  water.resolutionScale = q.water;
  bloomPass.enabled = q.bloom;
  grass.geometry.instanceCount = q.grass;
  resize();
  envDirty = true;
}

sunLight.shadow.mapSize.set(QUALITY[state.quality].shadow, QUALITY[state.quality].shadow);
main();
