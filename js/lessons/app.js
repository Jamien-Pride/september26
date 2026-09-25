import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CONE, PANEL_COLORS, conePoint } from '../sculpture.js';
import { ReflectedLight, tracePath } from '../caustics.js';
import { sunPosition, pacificToDate, dayEvents } from '../sun.js';
import { WindLab } from './wind.js';

const LAT = 37.81958, LON = -122.37321, FACE = 229.4, D2R = Math.PI / 180;
const $ = (id) => document.getElementById(id);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtTime = (m) => { const h = Math.floor(m / 60), mm = String(Math.round(m % 60)).padStart(2, '0'); return `${h % 12 || 12}:${mm} ${h >= 12 ? 'PM' : 'AM'}`; };
const dayToDate = (d) => { const t = new Date(Date.UTC(2026, 0, 1 + d)); return { y: 2026, m: t.getUTCMonth() + 1, d: t.getUTCDate() }; };
const fmtDay = (d) => { const x = dayToDate(d); return `${MONTHS[x.m - 1]} ${x.d}`; };

// World (x east, y up, z south) <-> sculpture-local (+z out of the mouth).
const RY = Math.atan2(Math.sin(FACE * D2R), -Math.cos(FACE * D2R));
const worldToLocal = (x, y, z) => new THREE.Vector3(x * Math.cos(RY) - z * Math.sin(RY), y, x * Math.sin(RY) + z * Math.cos(RY));
const bearingToLocal = (brg, el = 0) => worldToLocal(Math.sin(brg * D2R) * Math.cos(el * D2R), Math.sin(el * D2R), -Math.cos(brg * D2R) * Math.cos(el * D2R));

// ---------------------------------------------------------------- tabs
const tabs = [...document.querySelectorAll('[role="tab"]')];
let active = 'sun';
for (const t of tabs) t.addEventListener('click', () => {
  for (const x of tabs) x.setAttribute('aria-selected', String(x === t));
  for (const p of document.querySelectorAll('[role="tabpanel"]')) p.hidden = p.id !== t.getAttribute('aria-controls');
  active = t.id.replace('tab-', '');
  if (active === 'sun') { resizeSun(); drawCalendar(); }
});

// ================================================================ SUN
const host = $('sun3d');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
host.appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 500);
camera.position.set(-17, 11, 16);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1.6, 0); controls.enableDamping = true; controls.maxPolarAngle = Math.PI * 0.49;
controls.minDistance = 5; controls.maxDistance = 70;
const INK = 0xdcecff, SUN = 0xffb13b;

// ground grid (1 m) and 5 m major lines
const grid = new THREE.GridHelper(60, 60, 0x3a6a95, 0x1d4568); grid.material.transparent = true; grid.material.opacity = 0.55; scene.add(grid);

const lineMat = (color, opacity = 1) => new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity });
const polyline = (pts, mat) => new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat);

// funnel wireframe + faint panel fills
const STRIP_DEG = 360 / CONE.strips, STRIP0 = 90 - STRIP_DEG / 2;
const VIS0 = -Math.asin(CONE.yt / CONE.rt) / D2R, VIS1 = 180 - VIS0;
function ruling(th) {
  const pts = [];
  for (let i = 0; i <= 24; i++) { const p = conePoint(th, i / 24); if (p.y >= -0.001) pts.push(p); }
  return pts;
}
const funnel = new THREE.Group(); scene.add(funnel);
for (let j = 0; j <= CONE.strips; j++) {
  let th = STRIP0 + j * STRIP_DEG; if (th > 180 + 90) th -= 360;
  if (th < VIS0 || th > VIS1) continue;
  const pts = ruling(th); if (pts.length > 1) funnel.add(polyline(pts, lineMat(INK, 0.55)));
}
for (const s of [0, 1]) {
  const pts = [];
  for (let i = 0; i <= 200; i++) { const p = conePoint(VIS0 + (VIS1 - VIS0) * i / 200, s); if (p.y >= 0) pts.push(p); }
  funnel.add(polyline(pts, lineMat(INK, 1)));
}
for (let j = 0; j < CONE.strips; j++) {
  const a0 = STRIP0 + j * STRIP_DEG;
  const lo0 = a0 > 270 - 1e-6 ? a0 - 360 : a0;
  const lo = Math.max(lo0, VIS0), hi = Math.min(lo0 + STRIP_DEG, VIS1);
  if (hi <= lo) continue;
  const painted = j % 2 === 0;
  const pos = [], idx = [];
  const NT = 6, NS = 10;
  for (let a = 0; a <= NT; a++) for (let b = 0; b <= NS; b++) {
    const p = conePoint(lo + (hi - lo) * a / NT, b / NS); p.y = Math.max(0, p.y); pos.push(p.x, p.y, p.z);
  }
  for (let a = 0; a < NT; a++) for (let b = 0; b < NS; b++) { const i0 = a * (NS + 1) + b; idx.push(i0, i0 + 1, i0 + NS + 1, i0 + 1, i0 + NS + 2, i0 + NS + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
  const m = new THREE.MeshBasicMaterial({ color: painted ? PANEL_COLORS[(j / 2) % 16] : 0xcfe8ff, transparent: true, opacity: painted ? 0.3 : 0.1, side: THREE.DoubleSide, depthWrite: false });
  funnel.add(new THREE.Mesh(g, m));
}
// pad outline
const PW = CONE.pad.w / 2, PD = CONE.pad.d / 2;
scene.add(polyline([[-PW, -PD], [PW, -PD], [PW, PD], [-PW, PD], [-PW, -PD]].map(([x, z]) => new THREE.Vector3(x, 0.01, z)), lineMat(INK, 0.9)));

// compass + context labels (HTML, projected each frame)
const labels = [];
function label(text, pos, cls = '') {
  const el = document.createElement('div'); el.className = 'label3d ' + cls; el.textContent = text; host.appendChild(el);
  labels.push({ el, pos }); return labels[labels.length - 1];
}
const north = bearingToLocal(0).multiplyScalar(20);
scene.add(polyline([new THREE.Vector3(0, 0.02, 0), north.clone().setY(0.02)], lineMat(0x6fd3ff, 0.8)));
label('N', north.clone().multiplyScalar(1.06), 'strong');
label('Lawn (mouth side)', new THREE.Vector3(0, 0, 11));
label('Avenue of the Palms', new THREE.Vector3(0, 0, -24));
label('Bay, 300 ft', bearingToLocal(242.4).multiplyScalar(22));
label('Pad 10 × 20 ft', new THREE.Vector3(PW + 1.8, 0, -PD - 0.6));

// sun dome: solstice / equinox paths and the "sun in the mouth" ring
const DOME = 18;
function sunDirLocal(m, d, min) {
  const s = sunPosition(pacificToDate(2026, m, d, min), LAT, LON);
  return { v: bearingToLocal(s.azimuth, s.elevation), s };
}
function pathPoints(m, d) {
  const pts = [];
  for (let min = 240; min <= 1320; min += 6) { const { v, s } = sunDirLocal(m, d, min); if (s.elevation > -0.5) pts.push(v.multiplyScalar(DOME)); }
  return pts;
}
for (const [m, d, name] of [[6, 21, 'Jun 21'], [3, 20, 'Mar / Sep'], [12, 21, 'Dec 21']]) {
  const pts = pathPoints(m, d);
  scene.add(polyline(pts, lineMat(SUN, 0.35)));
  label(name, pts[Math.floor(pts.length * 0.5)].clone().multiplyScalar(1.05), 'sun');
}
const ring = [];
for (let i = 0; i <= 90; i++) {
  const ph = Math.PI * i / 90;
  ring.push(new THREE.Vector3(Math.sin(45 * D2R) * Math.cos(ph), Math.sin(45 * D2R) * Math.sin(ph), Math.cos(45 * D2R)).multiplyScalar(DOME));
}
const ringLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(ring), new THREE.LineDashedMaterial({ color: 0xff5d4d, dashSize: 0.6, gapSize: 0.4 }));
ringLine.computeLineDistances(); scene.add(ringLine);
label('sun inside this ring = sun in the mouth', ring[70].clone().multiplyScalar(1.02));
const todayPath = polyline([new THREE.Vector3(), new THREE.Vector3()], lineMat(SUN, 1)); scene.add(todayPath);
const sunDot = new THREE.Mesh(new THREE.SphereGeometry(0.55, 20, 12), new THREE.MeshBasicMaterial({ color: SUN }));
scene.add(sunDot);

// animated rays
const rayMat = new THREE.ShaderMaterial({
  uniforms: { uT: { value: 0 } },
  vertexShader: `attribute float aDist; attribute vec4 aCol; varying float vD; varying vec4 vC;
    void main(){ vD = aDist; vC = aCol; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `uniform float uT; varying float vD; varying vec4 vC;
    void main(){ float dash = 0.35 + 0.65*step(0.5, fract(vD*0.6 - uT*1.4)); gl_FragColor = vec4(vC.rgb, vC.a*dash); }`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
});
const rays = new THREE.LineSegments(new THREE.BufferGeometry(), rayMat); scene.add(rays);

// reflected-irradiance planes (head height and ground)
const reflected = new ReflectedLight();
reflected.upload = () => {};
const CROP = 7; // metres either side shown
const heatCanvas = (w) => { const c = document.createElement('canvas'); c.width = c.height = w; return c; };
const headC = heatCanvas(224), groundC = heatCanvas(224);
const headTex = new THREE.CanvasTexture(headC), groundTex = new THREE.CanvasTexture(groundC);
function heatPlane(tex, y) {
  const g = new THREE.PlaneGeometry(2 * CROP, 2 * CROP); g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
  m.position.y = y; scene.add(m); return m;
}
heatPlane(headTex, 1.7); heatPlane(groundTex, 0.03);
label('head height 1.7 m', new THREE.Vector3(-CROP, 1.7, CROP));
function ramp(v) { // 0 → transparent, 0.3 blue, 1 amber, 2 red, 3+ white
  if (v < 0.15) return [0, 0, 0, 0];
  const stops = [[0.15, [29, 111, 165, 60]], [0.6, [60, 170, 220, 150]], [1, [255, 177, 59, 210]], [2, [255, 93, 77, 235]], [3.2, [255, 240, 230, 255]]];
  for (let i = 1; i < stops.length; i++) if (v <= stops[i][0]) {
    const [a, ca] = stops[i - 1], [b, cb] = stops[i]; const t = (v - a) / (b - a);
    return ca.map((c, k) => c + (cb[k] - c) * t);
  }
  return stops[stops.length - 1][1];
}
function paintHeat(canvas, grid) {
  const ctx = canvas.getContext('2d'), N = canvas.width, img = ctx.createImageData(N, N);
  const res = reflected.res, cell = 2 * reflected.half / res;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = -CROP + (i + 0.5) * 2 * CROP / N, z = -CROP + (j + 0.5) * 2 * CROP / N;
    const gi = Math.floor((x + reflected.half) / cell), gj = Math.floor((z + reflected.half) / cell);
    const v = grid[gj * res + gi] || 0;
    const c = ramp(v), p = ((N - 1 - j) * N + i) * 4;
    img.data[p] = c[0]; img.data[p + 1] = c[1]; img.data[p + 2] = c[2]; img.data[p + 3] = c[3];
  }
  ctx.putImageData(img, 0, 0);
}

let sunState = { day: 352, min: 1000 };
let recompute = 0;
function updateSun() {
  const { day, min } = sunState, dt = dayToDate(day);
  $('dayv').textContent = fmtDay(day); $('todv').textContent = fmtTime(min);
  const { v: sl, s } = sunDirLocal(dt.m, dt.d, min);
  sunDot.position.copy(sl).multiplyScalar(DOME);
  sunDot.visible = s.elevation > 0;
  todayPath.geometry.dispose(); todayPath.geometry = new THREE.BufferGeometry().setFromPoints(pathPoints(dt.m, dt.d));
  $('r-sun').textContent = s.elevation > 0 ? `${s.azimuth.toFixed(0)}° az · ${s.elevation.toFixed(1)}° up` : 'below the horizon';
  // rays for drawing
  const pos = [], dist = [], col = [];
  if (s.elevation > 0.3) {
    const sv = sl.clone().normalize();
    const t1 = new THREE.Vector3().crossVectors(sv, new THREE.Vector3(0, 1, 0)).normalize(), t2 = new THREE.Vector3().crossVectors(sv, t1);
    const N = 900; let drawn = 0;
    for (let i = 0; i < N && drawn < 120; i++) {
      const rr = 3.9 * Math.sqrt(Math.random()), aa = Math.random() * 6.283;
      const o = [0, 2.2, 0].map((c, q) => c + t1.getComponent(q) * rr * Math.cos(aa) + t2.getComponent(q) * rr * Math.sin(aa) + sv.getComponent(q) * 10);
      const p = tracePath(o, [-sv.x, -sv.y, -sv.z], 0.62, 4, 6);
      if (!p.mirror) continue;
      drawn++;
      let acc = 0, e = 1;
      for (let k = 0; k < p.pts.length - 1; k++) {
        const a = p.pts[k], b = p.pts[k + 1];
        const L = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
        const incoming = k === 0;
        const c = incoming ? [1, 0.69, 0.23, 0.35] : [1, 1, 1, 0.25 + 0.6 * e];
        pos.push(...a, ...b); dist.push(acc, acc + L); col.push(...c, ...c);
        acc += L; if (!incoming) e *= 0.62;
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aDist', new THREE.Float32BufferAttribute(dist, 1));
  g.setAttribute('aCol', new THREE.Float32BufferAttribute(col, 4));
  rays.geometry.dispose(); rays.geometry = g;
  // irradiance (debounced; heavier)
  clearTimeout(recompute);
  recompute = setTimeout(() => {
    const st = reflected.compute(new THREE.Vector3(sl.x, sl.y, sl.z), 90000);
    const empty = new Float32Array(reflected.res * reflected.res);
    paintHeat(headC, s.elevation > 0.01 && reflected.headGrid ? reflected.headGrid : empty); paintHeat(groundC, s.elevation > 0.01 ? reflected.data : empty);
    headTex.needsUpdate = true; groundTex.needsUpdate = true;
    const f = (x) => (s.elevation <= 0 ? '—' : `${x.toFixed(1)}×`);
    $('r-head').textContent = f(st.headPeak); $('r-ground').textContent = f(st.groundPeak);
    $('r-share').textContent = s.elevation > 0 ? `${Math.round(st.reflectedShare * 100)}%` : '—';
    const flag = $('r-flag');
    if (s.elevation <= 0) { flag.className = 'tag'; flag.textContent = 'Sun is down'; }
    else if (st.headPeak >= 1.5 || st.groundPeak >= 2) { flag.className = 'tag hot'; flag.textContent = 'Concentrated glare'; }
    else if (st.headPeak >= 1) { flag.className = 'tag warn'; flag.textContent = 'Glare above 1× sun'; }
    else { flag.className = 'tag ok'; flag.textContent = 'Diffuse reflections'; }
    drawCalendar();
  }, 90);
}
$('day').addEventListener('input', (e) => { sunState.day = +e.target.value; updateSun(); });
$('tod').addEventListener('input', (e) => { sunState.min = +e.target.value; updateSun(); });
const sunPresets = [
  ['Winter worst · Dec 19, 4:40 PM', 352, 1000],
  ['Focus line on pad · Feb 6, 3:30 PM', 36, 930],
  ['Summer evening · Jun 21, 8:20 PM', 171, 1220],
  ['Midday · Sep 22, 1:00 PM', 264, 780],
];
for (const [t, d, m] of sunPresets) {
  const b = document.createElement('button'); b.type = 'button'; b.textContent = t;
  b.addEventListener('click', () => { sunState = { day: d, min: m }; $('day').value = d; $('tod').value = m; updateSun(); });
  $('sunpresets').appendChild(b);
}

function resizeSun() {
  const w = host.clientWidth, h = host.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false); renderer.domElement.style.width = '100%'; renderer.domElement.style.height = '100%';
  camera.aspect = w / h; camera.updateProjectionMatrix();
}
window.addEventListener('resize', () => { resizeSun(); drawCalendar(); });

// glare calendar
let glare = null;
fetch('./data/glare_year.json').then((r) => r.json()).then((j) => { glare = j; drawCalendar(); }).catch(() => {});
const cal = $('calendar');
const bands = []; for (let d = 0; d < 365; d += 7) { const x = dayToDate(d); const e = dayEvents(2026, x.m, x.d, LAT, LON); bands.push([d, e.sunrise, e.sunset]); }
function drawCalendar() {
  const W = cal.clientWidth; if (!W) return;
  const H = 230; cal.width = W * devicePixelRatio; cal.height = H * devicePixelRatio; cal.style.height = H + 'px';
  const ctx = cal.getContext('2d'); ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  const L = 44, R = 12, T = 26, B = 22, w = W - L - R, h = H - T - B;
  const X = (d) => L + d / 365 * w, Y = (m) => T + (m - 300) / 960 * h;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(5,20,38,0.6)'; ctx.fillRect(L, T, w, h);
  if (glare) {
    const cw = w / 365 * 4 + 0.6, ch = h / 96 + 0.6;
    for (const [day, min, , , head, ground] of glare.rows) {
      const c = ramp(Math.max(head, 0.16));
      ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${Math.max(0.22, c[3] / 255)})`;
      ctx.fillRect(X(day), Y(min), cw, ch);
      if (ground >= 2) { ctx.fillStyle = '#6fd3ff'; ctx.fillRect(X(day) + cw / 2 - 1, Y(min) + ch / 2 - 1, 2.5, 2.5); }
    }
  }
  // sunrise / sunset
  ctx.strokeStyle = 'rgba(255,177,59,0.8)'; ctx.lineWidth = 1;
  for (const k of [1, 2]) { ctx.beginPath(); bands.forEach((b, i) => { const y = Y(b[k]); if (i) ctx.lineTo(X(b[0]), y); else ctx.moveTo(X(b[0]), y); }); ctx.stroke(); }
  // axes
  ctx.fillStyle = '#8fb0cf'; ctx.font = '11px IBM Plex Mono, monospace'; ctx.textAlign = 'right';
  for (let m = 360; m <= 1260; m += 180) { ctx.fillText(fmtTime(m).replace(':00', ''), L - 6, Y(m) + 4); ctx.fillStyle = 'rgba(190,220,255,0.12)'; ctx.fillRect(L, Y(m), w, 1); ctx.fillStyle = '#8fb0cf'; }
  ctx.textAlign = 'center';
  let acc = 0; for (let i = 0; i < 12; i++) { const days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][i]; ctx.fillText(MONTHS[i], X(acc + days / 2), H - 6); acc += days; }
  // current marker
  ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5;
  ctx.strokeRect(X(sunState.day) - 3, Y(sunState.min) - 3, 6, 6);
  cal._map = { L, T, w, h };
}
cal.addEventListener('click', (e) => {
  const r = cal.getBoundingClientRect(), m = cal._map; if (!m) return;
  const d = Math.round((e.clientX - r.left - m.L) / m.w * 365), min = Math.round(((e.clientY - r.top - m.T) / m.h * 960 + 300) / 5) * 5;
  if (d < 0 || d > 364 || min < 300 || min > 1260) return;
  sunState = { day: d, min }; $('day').value = d; $('tod').value = min; updateSun();
});

// ================================================================ WIND
let windBearing = 248;
const lab = new WindLab($('windplan'), $('windsec'), (st) => {
  const lo = Math.min(st.plan, st.section), hi = Math.max(st.plan, st.section);
  $('w-plan').textContent = `${st.plan.toFixed(2)}×`;
  $('w-sec').textContent = Math.abs(lab.delta) > 30 && Math.abs(lab.delta) < 150 ? 'n/a (slice misses the throat)' : `${st.section.toFixed(2)}×`;
  const free = lab.freeMph, side = Math.abs(lab.delta) > 60 && Math.abs(lab.delta) < 120;
  // Throat estimate: 2D solutions of this shape settle at 1.2–1.3x; allow up to 1.5x for 3D and higher Reynolds number.
  const r0 = side ? 1.0 : 1.2, r1 = side ? 1.1 : 1.5;
  $('w-3d').textContent = side ? 'about 1× (side-on)' : '1.2–1.5×';
  $('w-mph').textContent = `${Math.round(free * r0)}–${Math.round(free * r1)} mph`;
  const top = free * r1, flag = $('w-flag');
  if (top > 26) { flag.className = 'tag hot'; flag.textContent = 'Past the SF hazard level (26 mph)'; }
  else if (top > 11) { flag.className = 'tag warn'; flag.textContent = 'Above walking comfort (11 mph)'; }
  else { flag.className = 'tag ok'; flag.textContent = 'Comfortable'; }
  // 3D CFD force coefficient on 175 sq ft vs angle off the mouth axis (tools/cfd, corrected +8.7% by the
  // hollow-hemisphere check); head-height wind scaled to the 7 ft reference height (log profile, x1.128 in pressure).
  const d = Math.min(180, Math.abs(((lab.delta % 360) + 540) % 360 - 180));
  const T = [[0, 1.48], [19, 1.48], [41, 1.49], [90, 0.47], [135, 0.80], [180, 1.01]];
  let cf = T[T.length - 1][1];
  for (let i = 1; i < T.length; i++) if (d <= T[i][0]) { const [x0, y0] = T[i - 1], [x1, y1] = T[i]; cf = y0 + (y1 - y0) * (d - x0) / (x1 - x0); break; }
  $('w-force').textContent = `${Math.round(0.00256 * free * free * 1.128 * cf * 175).toLocaleString()} lbf (Cf ${cf.toFixed(2)})`;
  $('w-warm').textContent = st.warm < 1 ? `Solver settling… ${Math.round(st.warm * 100)}%` : 'Flow settled. Values fluctuate as eddies shed.';
});
lab.freeMph = 14;
lab.setWind(windBearing, FACE);
$('wdir').addEventListener('change', (e) => { windBearing = +e.target.value; lab.setWind(windBearing, FACE); });
$('wspd').addEventListener('input', (e) => { lab.freeMph = +e.target.value; $('wspdv').textContent = `${lab.freeMph} mph`; });
// Head-height presets from the Treasure Island record (NCEI ISD 724943), see tools/site_wind.py:
// summer 7 AM median, summer afternoon median and 90th percentile, and the Dec 1983 storms (46–52 mph at 10 m).
for (const [t, dir, v] of [['Summer morning · 5 mph', 248, 5], ['Summer afternoon · 14 mph', 270, 14], ['Windy afternoon (1 in 10) · 18 mph', 248, 18], ['Winter storm from S · 40 mph', 180, 40]]) {
  const b = document.createElement('button'); b.type = 'button'; b.textContent = t;
  b.addEventListener('click', () => {
    $('wdir').value = String(dir); $('wspd').value = v; lab.freeMph = v; $('wspdv').textContent = `${v} mph`;
    if (dir !== windBearing) { windBearing = dir; lab.setWind(dir, FACE); }
  });
  $('windpresets').appendChild(b);
}

// ================================================================ DIAGRAMS
const NS = 'http://www.w3.org/2000/svg';
function el(tag, attrs, parent, text) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (text != null) e.textContent = text;
  parent.appendChild(e); return e;
}
const C_INK = '#dcecff', C_MUTED = '#8fb0cf', C_HOT = '#ff5d4d', C_SUN = '#ffb13b', C_OK = '#7fe3b0';
function hatch(svg, id, color) {
  const defs = svg.querySelector('defs') || el('defs', {}, svg);
  const p = el('pattern', { id, width: 8, height: 8, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, defs);
  el('line', { x1: 0, y1: 0, x2: 0, y2: 8, stroke: color, 'stroke-width': 2 }, p);
}
function person(svg, x, y0, hIn, s, labelText, color = C_MUTED) {
  // x, y0 in px (feet position), height in inches, s px/in
  const H = hIn * s, head = 4.6 * s;
  el('circle', { cx: x, cy: y0 - H + head, r: head, fill: 'none', stroke: color, 'stroke-width': 1.5 }, svg);
  el('path', { d: `M${x - 8 * s} ${y0 - H + 2 * head + 1 * s} h${16 * s} l${-2 * s} ${H * 0.46} h${-12 * s} z M${x - 5 * s} ${y0 - H * 0.42} h${10 * s} v${H * 0.42} h${-10 * s} z`, fill: 'none', stroke: color, 'stroke-width': 1.5 }, svg);
  el('text', { x, y: y0 - H - 8, fill: color, 'font-size': 13, 'text-anchor': 'middle' }, svg, labelText);
}

// Throat section (inches)
(function throat() {
  const svg = $('svg-throat'); hatch(svg, 'hotHatch', C_HOT);
  const s = 5.2, X0 = 470, Y0 = 520, r = 42, c = 36;
  const P = (x, y) => [X0 + x * s, Y0 - y * s];
  const floorHalf = Math.sqrt(r * r - c * c);
  // ground
  el('line', { x1: 40, y1: Y0, x2: 960, y2: Y0, stroke: C_INK, 'stroke-width': 2 }, svg);
  el('text', { x: 60, y: Y0 + 22, fill: C_MUTED, 'font-size': 13 }, svg, 'pad / floor');
  // throat ring (clipped at the floor)
  let d = '';
  for (let i = 0; i <= 360; i++) {
    const th = (-58.95 + (180 + 2 * 58.95) * i / 360) * D2R;
    const [x, y] = P(r * Math.cos(th), c + r * Math.sin(th)); d += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
  }
  el('path', { d, fill: 'none', stroke: C_INK, 'stroke-width': 5 }, svg);
  // overhang zone beyond the floor line (above 72 in)
  for (const sg of [-1, 1]) {
    let poly = '';
    for (let h = 72; h <= 78; h += 0.25) { const xw = Math.sqrt(Math.max(0, r * r - (h - c) ** 2)); const [x, y] = P(sg * xw, h); poly += (poly ? 'L' : 'M') + x + ' ' + y; }
    const [xa, ya] = P(sg * floorHalf, 78), [xb, yb] = P(sg * floorHalf, 72);
    poly += `L${xa} ${ya}L${xb} ${yb}Z`;
    el('path', { d: poly, fill: 'url(#hotHatch)', stroke: C_HOT, 'stroke-width': 1 }, svg);
  }
  // floor-line verticals
  for (const sg of [-1, 1]) { const [x, y] = P(sg * floorHalf, 0); el('line', { x1: x, y1: y, x2: x, y2: P(0, 84)[1], stroke: C_MUTED, 'stroke-dasharray': '4 5' }, svg); }
  // reference heights
  const hl = (h, text, color, dy = -6) => { const [, y] = P(0, h); el('line', { x1: 150, y1: y, x2: 990, y2: y, stroke: color, 'stroke-dasharray': '8 6' }, svg); el('text', { x: 712, y: y + dy, fill: color, 'font-size': 13 }, svg, text); };
  hl(80, '80 in: ADA headroom', C_HOT, -6); hl(78, '78 in: throat top', C_SUN, 16); hl(27, '27 in: cane detects below', C_MUTED);
  // width dimension
  const [xl] = P(-floorHalf, 0), [xr] = P(floorHalf, 0);
  el('line', { x1: xl, y1: Y0 - 12, x2: xr, y2: Y0 - 12, stroke: C_OK }, svg);
  el('text', { x: X0, y: Y0 - 18, fill: C_OK, 'font-size': 13, 'text-anchor': 'middle' }, svg, '43 in clear at the floor');
  // 31 degree ramp at the floor
  const [tx, ty] = P(floorHalf, 0);
  el('line', { x1: tx, y1: ty, x2: tx + 90 * Math.cos(31 * D2R), y2: ty - 90 * Math.sin(31 * D2R), stroke: C_SUN, 'stroke-width': 2 }, svg);
  el('text', { x: tx + 70, y: ty - 18, fill: C_SUN, 'font-size': 13 }, svg, '31° inner slope: a runnable ramp');
  // people
  person(svg, X0 - 12 * s, Y0, 74, s, "6'2\"");
  person(svg, X0 + 15 * s, Y0, 76, s, "6'4\", off-centre", C_HOT);
  el('text', { x: 60, y: 40, fill: C_HOT, 'font-size': 14 }, svg, 'Hatched: the rim overhangs the walking line by more than 4 in (ADA 307.2 limit)');
})();

// Side elevation (feet)
(function side() {
  const svg = $('svg-side');
  const s = 24, X0 = 330, Y0 = 400;
  const P = (z, y) => [X0 + z * s, Y0 - y * s]; // z: 0 = mouth plane, 8 = throat plane
  el('line', { x1: 30, y1: Y0, x2: 980, y2: Y0, stroke: C_INK, 'stroke-width': 2 }, svg);
  el('rect', { x: P(-1, 0)[0], y: Y0, width: 10 * s, height: 6, fill: C_MUTED }, svg);
  const top = [P(0, 14), P(8, 6.5)];
  el('path', { d: `M${P(0, 0)} L${top[0]} L${top[1]} L${P(8, 0)}`, fill: 'rgba(220,236,255,0.06)', stroke: C_INK, 'stroke-width': 3 }, svg);
  el('text', { x: P(0, 14)[0] - 10, y: P(0, 14)[1] - 10, fill: C_INK, 'font-size': 13, 'text-anchor': 'end' }, svg, 'mouth rim 14 ft');
  el('text', { x: P(8, 6.5)[0] + 10, y: P(8, 6.5)[1] - 6, fill: C_INK, 'font-size': 13 }, svg, 'throat top 6 ft 6 in');
  // ridge angle
  const [ax, ay] = P(8, 6.5);
  el('path', { d: `M${ax - 70} ${ay} A70 70 0 0 1 ${ax - 70 * Math.cos(43.2 * D2R)} ${ay - 70 * Math.sin(43.2 * D2R)}`, fill: 'none', stroke: C_SUN, 'stroke-width': 2 }, svg);
  el('line', { x1: ax, y1: ay, x2: ax - 90, y2: ay, stroke: C_SUN, 'stroke-dasharray': '4 4' }, svg);
  el('text', { x: ax - 150, y: ay - 26, fill: C_SUN, 'font-size': 14 }, svg, '43° top ridge');
  // fall height
  const [fx, fy] = P(-1.2, 14);
  el('line', { x1: fx, y1: fy, x2: fx, y2: Y0, stroke: C_HOT, 'stroke-width': 1.5, 'marker-end': '' }, svg);
  el('text', { x: fx - 10, y: (fy + Y0) / 2, fill: C_HOT, 'font-size': 14, 'text-anchor': 'end' }, svg, '14 ft fall onto concrete');
  person(svg, P(12, 0)[0], Y0, 69, s / 12, "5'9\" for scale");
  el('text', { x: P(0, 0)[0], y: Y0 + 26, fill: C_MUTED, 'font-size': 12, 'text-anchor': 'middle' }, svg, 'lawn side');
  el('text', { x: P(8, 0)[0], y: Y0 + 26, fill: C_MUTED, 'font-size': 12, 'text-anchor': 'middle' }, svg, 'road side');
})();

// Soil profile + elevation ladder
(function soil() {
  const svg = $('svg-soil'); hatch(svg, 'fillHatch', 'rgba(255,177,59,0.35)');
  const x0 = 60, w = 320;
  const layers = [
    ['Hydraulic sand fill (1936–37)', 'about 15–45 ft · liquefied in 1989', 40, 160, 'url(#fillHatch)', C_SUN],
    ['Natural shoal sand', 'fill + shoal sand ≈ 30–50 ft · loose', 160, 230, 'rgba(255,177,59,0.12)', C_SUN],
    ['Young Bay Mud', '10–120 ft thick · soft, still settling', 230, 330, 'rgba(111,211,255,0.12)', C_MUTED],
    ['Older Bay deposits', 'down to bedrock', 330, 470, 'rgba(111,211,255,0.06)', C_MUTED],
    ['Bedrock', 'about 100–400 ft down', 470, 530, 'rgba(220,236,255,0.08)', C_MUTED],
  ];
  for (const [name, sub, y1, y2, fill, col] of layers) {
    el('rect', { x: x0, y: y1, width: w, height: y2 - y1, fill, stroke: 'rgba(190,220,255,0.3)' }, svg);
    el('text', { x: x0 + 12, y: y1 + 24, fill: col === C_SUN ? C_INK : C_INK, 'font-size': 14 }, svg, name);
    el('text', { x: x0 + 12, y: y1 + 42, fill: col, 'font-size': 12 }, svg, sub);
  }
  // pad and funnel
  el('rect', { x: x0 + 110, y: 32, width: 100, height: 8, fill: C_INK }, svg);
  el('text', { x: x0 + 225, y: 38, fill: C_MUTED, 'font-size': 12 }, svg, '6 in pad');
  // sand boils
  for (const bx of [x0 + 40, x0 + 250, x0 + 290]) el('path', { d: `M${bx - 10} 40 Q${bx} 22 ${bx + 10} 40`, fill: 'none', stroke: C_SUN }, svg);
  el('text', { x: x0, y: 548, fill: C_MUTED, 'font-size': 11 }, svg, 'Island-wide ranges from USGS PP 1551-B and the 2010 EIR; not to scale below the fill.');
  // elevation ladder (ft NAVD88)
  const lx = 560, ly0 = 500, sc = 70; // px per ft, zoomed on 8–14 ft
  const Y = (ft) => ly0 - (ft - 8) * sc;
  el('line', { x1: lx, y1: Y(8), x2: lx, y2: Y(14), stroke: C_INK }, svg);
  for (let f = 8; f <= 14; f += 1) { el('line', { x1: lx - 6, y1: Y(f), x2: lx, y2: Y(f), stroke: C_INK }, svg); el('text', { x: lx - 10, y: Y(f) + 4, fill: C_MUTED, 'font-size': 11, 'text-anchor': 'end' }, svg, `${f} ft`); }
  const mark = (ft, text, col, dash, dy = -6) => { el('line', { x1: lx, y1: Y(ft), x2: 960, y2: Y(ft), stroke: col, 'stroke-dasharray': dash || '' }, svg); el('text', { x: lx + 12, y: Y(ft) + dy, fill: col, 'font-size': 13 }, svg, text); };
  mark(9.2, '9.2 ft · 100-year still water today', C_MUTED, '6 5');
  mark(11.3, '11.3 ft · pad grade before raising (2010 lidar)', C_MUTED, '2 4');
  mark(12.2, '12.2 ft · same water level + 36 in sea level rise', C_HOT, '6 5', 17);
  mark(12.7, '12.7 ft · + 6 in freeboard (building floors)', C_SUN, '2 4', 17);
  mark(12.9, '12.9 ft · pad grade now (March 2023 lidar)', C_INK, '');
  el('text', { x: lx, y: 36, fill: C_INK, 'font-size': 14 }, svg, 'Elevations, ft above NAVD88 (zoomed on 8–14 ft)');
})();

// Salt: rain exposure on a front section
(function salt() {
  const svg = $('svg-salt'); hatch(svg, 'never', 'rgba(255,93,77,0.7)'); hatch(svg, 'shelter', 'rgba(255,177,59,0.6)');
  const s = 24, X0 = 420, Y0 = 470;
  const P = (x, y) => [X0 + x * s, Y0 - y * s];
  el('line', { x1: 40, y1: Y0, x2: 820, y2: Y0, stroke: C_INK, 'stroke-width': 2 }, svg);
  const circ = (r, c) => { const pts = []; const cut = Math.asin(Math.min(1, c / r)) / D2R; for (let i = 0; i <= 200; i++) { const th = (-cut + (180 + 2 * cut) * i / 200) * D2R; pts.push(P(r * Math.cos(th), c + r * Math.sin(th))); } return pts; };
  const mouth = circ(9, 5), throatPts = circ(3.5, 3);
  // interior (never rinsed): region inside mouth outline
  el('path', { d: 'M' + mouth.map((p) => p.join(' ')).join('L') + 'Z', fill: 'url(#never)', stroke: 'none' }, svg);
  el('path', { d: 'M' + throatPts.map((p) => p.join(' ')).join('L') + 'Z', fill: '#0a2440', stroke: C_INK, 'stroke-width': 2 }, svg);
  el('path', { d: 'M' + mouth.map((p) => p.join(' ')).join('L'), fill: 'none', stroke: C_INK, 'stroke-width': 4 }, svg);
  // outer lower flanks facing down (sheltered) marked on the outline
  for (const side of [-1, 1]) {
    const pts = []; for (let a = -33.7; a <= 0; a += 1) { const th = (side > 0 ? a : 180 - a) * D2R; pts.push(P(9.35 * Math.cos(th), 5 + 9.35 * Math.sin(th))); }
    el('path', { d: 'M' + pts.map((p) => p.join(' ')).join('L'), fill: 'none', stroke: 'url(#shelter)', 'stroke-width': 10 }, svg);
  }
  // rain
  for (let x = -12; x <= 12; x += 1.2) {
    const topY = Math.abs(x) < 9 ? 5 + Math.sqrt(81 - x * x) : 0;
    const [px, py] = P(x, 18), [, qy] = P(x, topY + 0.3);
    el('line', { x1: px, y1: py, x2: px, y2: qy, stroke: 'rgba(111,211,255,0.55)', 'stroke-dasharray': '6 7' }, svg);
  }
  // wind-driven rain into the mouth
  el('path', { d: `M${P(-13, 12).join(' ')} Q${P(-8, 9).join(' ')} ${P(-2, 6).join(' ')}`, fill: 'none', stroke: C_OK, 'stroke-width': 2, 'stroke-dasharray': '3 5' }, svg);
  el('text', { x: 40, y: P(0, 12.8)[1], fill: C_OK, 'font-size': 12 }, svg, 'only storm rain blown into the mouth');
  el('text', { x: 40, y: P(0, 12.2)[1] + 4, fill: C_OK, 'font-size': 12 }, svg, 'reaches the inside');
  // legend
  const lg = (y, fill, text) => { el('rect', { x: 740, y, width: 22, height: 14, fill }, svg); el('text', { x: 770, y: y + 12, fill: C_INK, 'font-size': 13 }, svg, text); };
  lg(60, 'url(#never)', 'inside: never rinsed');
  lg(84, 'url(#shelter)', 'lower outside: sheltered');
  lg(108, 'rgba(111,211,255,0.55)', 'rain');
  // distance bar
  const bx = 60, by = 505, ft = 0.09; // px per ft
  el('line', { x1: bx, y1: by, x2: bx + 300 * ft, y2: by, stroke: C_HOT, 'stroke-width': 4 }, svg);
  el('line', { x1: bx, y1: by + 10, x2: bx + 3280 * ft, y2: by + 10, stroke: 'rgba(255,177,59,0.5)', 'stroke-width': 4 }, svg);
  el('text', { x: bx + 300 * ft + 8, y: by + 4, fill: C_HOT, 'font-size': 12 }, svg, '300 ft to the Bay');
  el('text', { x: bx + 3280 * ft + 8, y: by + 14, fill: C_SUN, 'font-size': 12 }, svg, 'Coastal zone (ASSDA): within 1 km (3,280 ft) of still marine water');
})();

// ================================================================ loop
const clock = new THREE.Timer();
function loop() {
  clock.update();
  rayMat.uniforms.uT.value = clock.getElapsed();
  if (active === 'sun') {
    controls.update();
    renderer.render(scene, camera);
    const w = host.clientWidth, h = host.clientHeight;
    for (const l of labels) {
      const v = l.pos.clone().project(camera);
      l.el.style.display = v.z < 1 ? '' : 'none';
      l.el.style.left = `${(v.x * 0.5 + 0.5) * w}px`; l.el.style.top = `${(-v.y * 0.5 + 0.5) * h}px`;
    }
  }
  if (active === 'wind') lab.tick(5);
  requestAnimationFrame(loop);
}
resizeSun();
updateSun();
requestAnimationFrame(loop);
window.__lessons = { lab, sunState, updateSun };
