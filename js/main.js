import { CONFIG, GEO } from './config.js';
import { Camera } from './camera.js';
import { Station, ZONES, FONT } from './station.js';
import { buildTrain, drawTrain, stopHeadFor, carLeft } from './train.js';
import { TrainAudio } from './audio.js';
import { makeLayer, clamp } from './util.js';

const T = GEO.zTrain;
const canvas = document.getElementById('scene');
const ctx = canvas.getContext('2d', { alpha: false });
const cam = new Camera();
const station = new Station();
const train = buildTrain();
const audio = new TrainAudio();
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

let trainLayer, blurA, blurB, fx;
let ready = false;

// ---------------------------------------------------------------------------
// Train state machine: idle → arriving → stopped → departing → idle (or idle → passing → idle)

const S = {
  phase: 'idle',
  t: 0,
  timer: CONFIG.firstTrainDelay,
  head: -1e4,
  v: 0,
  doors: 0,
  bounce: 0,
  express: false,
  queueExpress: false,
  closing: false,
  chimed: false,
};

const halfView = () => cam.cx / cam.s(T) + 8;

function startTrain(express) {
  S.express = express;
  S.t = 0;
  S.doors = 0;
  S.chimed = false;
  S.closing = false;
  if (express) {
    S.phase = 'passing';
    S.v = CONFIG.expressSpeed;
    S.head = -halfView() - 90;
  } else {
    S.phase = 'arriving';
    S.stopHead = stopHeadFor(train, 1);
    S.startHead = -halfView() - 40;
    S.D = S.stopHead - S.startHead;
    S.head = S.startHead;
  }
}

function update(dt) {
  S.t += dt;
  const P = 2.2, TA = CONFIG.arrivalTime;
  switch (S.phase) {
    case 'idle':
      S.v = 0;
      S.timer -= dt;
      if (S.timer <= 0) startTrain(S.queueExpress), (S.queueExpress = false);
      break;
    case 'arriving': {
      const u = Math.min(1, S.t / TA);
      S.head = S.startHead + S.D * (1 - Math.pow(1 - u, P));
      S.v = (S.D * P * Math.pow(1 - u, P - 1)) / TA;
      if (u >= 1) { S.phase = 'stopped'; S.t = 0; S.v = 0; }
      break;
    }
    case 'stopped': {
      const t = S.t;
      S.bounce = reduceMotion ? 0 : 0.05 * Math.exp(-t / 0.45) * Math.sin((t * Math.PI * 2) / 0.6);
      const openAt = CONFIG.doorOpenDelay, openDur = 1.1;
      const chimeAt = openAt + openDur + CONFIG.dwell;
      if (S.closeNow && t < chimeAt && t > openAt + openDur) { S.t = chimeAt; S.closeNow = false; }
      if (t >= chimeAt && !S.chimed) { S.chimed = true; audio.chime(); }
      if (t < openAt) S.doors = 0;
      else if (t < openAt + openDur) S.doors = (t - openAt) / openDur;
      else if (t < chimeAt + 0.7) S.doors = 1;
      else S.doors = Math.max(0, 1 - (t - chimeAt - 0.7) / 1.2);
      S.closing = t >= chimeAt;
      if (t > chimeAt + 2.6) { S.phase = 'departing'; S.t = 0; S.v = 0; S.doors = 0; }
      break;
    }
    case 'departing': {
      const a = 11 * Math.min(1, S.t / 1.4);
      S.v += a * dt;
      S.head += S.v * dt;
      if (S.head - train.length > halfView() + 40) { S.phase = 'idle'; S.timer = CONFIG.headway; }
      break;
    }
    case 'passing':
      S.head += S.v * dt;
      if (S.head - train.length > halfView() + 90) { S.phase = 'idle'; S.timer = CONFIG.headway; }
      break;
  }
  if (S.phase !== 'stopped') S.bounce = 0;
}

// ---------------------------------------------------------------------------
// Input

const pointer = { x: 0.5, y: 0.5, active: false };
addEventListener('pointermove', (e) => {
  if (e.pointerType === 'touch') return;
  pointer.x = e.clientX / innerWidth;
  pointer.y = e.clientY / innerHeight;
  pointer.active = true;
});

function callTrain() {
  if (S.phase === 'idle') S.timer = 0;
  else if (S.phase === 'stopped' && S.doors >= 1) S.closeNow = true;
}
function express() {
  if (S.phase === 'idle') { S.queueExpress = true; S.timer = 0; } else S.queueExpress = true;
}
async function toggleSound() {
  const on = await audio.toggle();
  const b = document.getElementById('sound');
  b.setAttribute('aria-pressed', String(on));
  b.querySelector('span').textContent = on ? 'Sound on' : 'Sound off';
}

canvas.addEventListener('click', callTrain);
document.getElementById('call').addEventListener('click', callTrain);
document.getElementById('express').addEventListener('click', express);
document.getElementById('sound').addEventListener('click', toggleSound);
addEventListener('keydown', (e) => {
  if (e.target.closest && e.target.closest('button') && (e.key === ' ' || e.key === 'Enter')) return;
  if (e.key === ' ') { e.preventDefault(); callTrain(); }
  else if (e.key === 'x' || e.key === 'X') express();
  else if (e.key === 'm' || e.key === 'M') toggleSound();
});

// ---------------------------------------------------------------------------
// Rendering

function resize() {
  const w = innerWidth, h = innerHeight;
  let dpr = Math.min(window.devicePixelRatio || 1, 2);
  const budget = 4.5e6;
  if (w * h * dpr * dpr > budget) dpr = Math.sqrt(budget / (w * h));
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  cam.resize(w, h, dpr);
  station.build(cam);
  trainLayer = makeLayer(w, h, dpr);
  blurA = makeLayer(w, h, dpr * 0.5);
  blurB = makeLayer(w, h, dpr * 0.5);
  fx = makeLayer(w, h, 0.2);
}

function signGrid(time) {
  const dest = S.express || S.queueExpress ? 'Not in service' : CONFIG.destination;
  const cars = `${CONFIG.cars} car`;
  switch (S.phase) {
    case 'idle':
      if (S.queueExpress) return station.composeSign('Not in service', '', 'Stand back from the platform edge', time * 26);
      return station.composeSign(dest, cars, S.timer > 3 ? '2 min' : S.timer > 1.2 ? '1 min' : 'Arriving');
    case 'arriving':
      return station.composeSign(dest, cars, 'Arriving');
    case 'stopped':
      return station.composeSign(dest, cars, S.closing ? 'Doors closing' : 'Now boarding');
    case 'departing':
      return station.composeSign(CONFIG.destination, cars, 'Next train 4 min');
    case 'passing':
      return station.composeSign('Not in service', '', 'Stand back from the platform edge', time * 26);
  }
  return null;
}

function trainOnScreen() {
  return S.phase !== 'idle';
}

function drawTrainLights(pass) {
  if (!trainOnScreen()) return;
  const d = cam.dpr;
  const head = S.head, tail = S.head - train.length;
  const hv = halfView();
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  if (pass === 'wall') {
    // Headlight wash on the far wall ahead of the nose.
    const I = clamp(1 - (Math.abs(head + 10) - hv) / 60, 0, 1);
    if (I > 0 && head < hv + 40) {
      cam.plane(ctx, GEO.zWall, 0, 0);
      const cx = head + 18, r = 26;
      const g = ctx.createRadialGradient(cx, -1, 0, cx, -1, r);
      g.addColorStop(0, `rgba(255,244,220,${0.32 * I})`);
      g.addColorStop(0.5, `rgba(255,236,200,${0.1 * I})`);
      g.addColorStop(1, 'rgba(255,236,200,0)');
      ctx.fillStyle = g;
      ctx.fillRect(cx - r, -6, r * 2, 14);
    }
    // Red tail-light wash behind the last car.
    if (tail > -hv - 30 && tail < hv + 30) {
      cam.plane(ctx, GEO.zWall, 0, 0);
      const cx = tail - 8, r = 14;
      const g = ctx.createRadialGradient(cx, 0, 0, cx, 0, r);
      g.addColorStop(0, 'rgba(255,30,20,0.22)');
      g.addColorStop(1, 'rgba(255,30,20,0)');
      ctx.fillStyle = g;
      ctx.fillRect(cx - r, -6, r * 2, 14);
    }
  } else {
    const k = cam.k;
    // Headlight on the platform edge and a flare at the nose.
    if (head > -hv - 60 && head < hv + 30) {
      const z = ZONES.Z_EDGE - 1.2;
      const sx = cam.sx(head + 7, z), sy = cam.sy(0, z);
      const rx = 14 * cam.s(z);
      ctx.setTransform(d, 0, 0, d * (GEO.eye / z) * 1.4, 0, d * sy * (1 - (GEO.eye / z) * 1.4));
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, rx);
      g.addColorStop(0, 'rgba(255,240,210,0.28)');
      g.addColorStop(1, 'rgba(255,240,210,0)');
      ctx.fillStyle = g;
      ctx.fillRect(sx - rx, sy - rx, rx * 2, rx * 2);
      ctx.setTransform(d, 0, 0, d, 0, 0);
      const fx = cam.sx(head + 0.15, T + 1.4), fy = cam.sy(1.45 + S.bounce, T + 1.4);
      const fr = 90 * k;
      const fg = ctx.createRadialGradient(fx, fy, 0, fx, fy, fr);
      fg.addColorStop(0, 'rgba(255,255,245,1)');
      fg.addColorStop(0.08, 'rgba(255,248,225,0.8)');
      fg.addColorStop(0.3, 'rgba(255,230,190,0.18)');
      fg.addColorStop(1, 'rgba(255,230,190,0)');
      ctx.fillStyle = fg;
      ctx.fillRect(fx - fr, fy - fr, fr * 2, fr * 2);
      // anamorphic streak
      ctx.setTransform(d, 0, 0, d * 0.035, 0, d * fy * (1 - 0.035));
      const sr = 520 * k;
      const sg = ctx.createRadialGradient(fx, fy, 0, fx, fy, sr);
      sg.addColorStop(0, 'rgba(200,225,255,0.55)');
      sg.addColorStop(1, 'rgba(200,225,255,0)');
      ctx.fillStyle = sg;
      ctx.fillRect(fx - sr, fy - sr, sr * 2, sr * 2);
    }
    // Tail lights
    if (tail > -hv - 10 && tail < hv + 10) {
      ctx.setTransform(d, 0, 0, d, 0, 0);
      const fx = cam.sx(tail - 0.1, T + 1.4), fy = cam.sy(1.45, T + 1.4);
      const fr = 55 * k;
      const fg = ctx.createRadialGradient(fx, fy, 0, fx, fy, fr);
      fg.addColorStop(0, 'rgba(255,120,110,0.95)');
      fg.addColorStop(0.15, 'rgba(255,30,20,0.5)');
      fg.addColorStop(1, 'rgba(255,20,10,0)');
      ctx.fillStyle = fg;
      ctx.fillRect(fx - fr, fy - fr, fr * 2, fr * 2);
    }
  }
  ctx.restore();
}

function drawDoorSpill() {
  if (S.phase !== 'stopped' || S.doors <= 0) return;
  const [va, vb] = cam.xRange(T, 6);
  const a = Math.min(1, S.doors * 1.5);
  const z0 = ZONES.Z_EDGE + 0.2, z1 = z0 - 5;
  // Drawn into a tiny buffer and upscaled, which gives naturally feathered edges.
  const f = fx.ctx;
  f.setTransform(1, 0, 0, 1, 0, 0);
  f.clearRect(0, 0, fx.c.width, fx.c.height);
  f.setTransform(fx.dpr, 0, 0, fx.dpr, 0, 0);
  for (let i = 0; i < train.cars.length; i++) {
    const left = carLeft(train, i, S.head);
    for (const c of train.cars[i].doors) {
      const xc = left + c;
      if (xc < va || xc > vb) continue;
      const hw = 2.1 * Math.min(1, S.doors * 1.2);
      f.beginPath();
      f.moveTo(cam.sx(xc - hw, z0), cam.sy(0, z0));
      f.lineTo(cam.sx(xc + hw, z0), cam.sy(0, z0));
      f.lineTo(cam.sx(xc + hw + 2.6, z1), cam.sy(0, z1));
      f.lineTo(cam.sx(xc - hw - 2.6, z1), cam.sy(0, z1));
      f.closePath();
      const g = f.createLinearGradient(0, cam.sy(0, z0), 0, cam.sy(0, z1));
      g.addColorStop(0, `rgba(255,250,238,${0.2 * a})`);
      g.addColorStop(0.5, `rgba(255,250,238,${0.07 * a})`);
      g.addColorStop(1, 'rgba(255,250,238,0)');
      f.fillStyle = g;
      f.fill();
    }
  }
  ctx.save();
  ctx.setTransform(cam.dpr, 0, 0, cam.dpr, 0, 0);
  ctx.globalCompositeOperation = 'lighter';
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(fx.c, 0, 0, cam.w, cam.h);
  ctx.restore();
}

// Two-pass box blur along x: n1 x n2 taps for the price of n1 + n2 draws, at half resolution.
function smear(src, dst, n, span) {
  const b = dst.ctx, bd = dst.dpr;
  b.setTransform(1, 0, 0, 1, 0, 0);
  b.clearRect(0, 0, dst.c.width, dst.c.height);
  b.globalCompositeOperation = 'lighter';
  b.globalAlpha = 1 / n;
  for (let i = 0; i < n; i++) {
    const off = n === 1 ? 0 : (i / (n - 1) - 0.5) * span;
    b.setTransform(bd, 0, 0, bd, bd * off, 0);
    b.drawImage(src.c, 0, 0, cam.w, cam.h);
  }
  b.globalAlpha = 1;
  b.globalCompositeOperation = 'source-over';
}
function motionBlur(src, blurPx) {
  const n2 = clamp(Math.ceil(blurPx / 14), 2, 8);
  const n1 = clamp(Math.ceil(blurPx / n2 / 2.5), 1, 8);
  const coarse = blurPx * (n2 - 1) / n2;
  smear(src, blurA, n1, blurPx / n2);
  smear(blurA, blurB, n2, coarse);
  return blurB;
}

let last = performance.now();
let time = 0;
function frame(now) {
  requestAnimationFrame(frame);
  if (!ready) return;
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  time += dt;
  update(dt);

  // camera: pointer parallax, gentle idle drift on touch, shake from passing trains
  const k = 1 - Math.exp(-dt * 3);
  const tx = reduceMotion ? 0 : pointer.active ? (pointer.x - 0.5) * 1.1 : Math.sin(time * 0.17) * 0.25;
  const ty = reduceMotion ? 0 : pointer.active ? (0.5 - pointer.y) * 0.35 : 0;
  cam.camX += (tx - cam.camX) * k;
  cam.dEye += (ty - cam.dEye) * k;
  const tail = S.head - train.length;
  const nearest = clamp(0, tail, S.head);
  const near = trainOnScreen() ? 1 / (1 + Math.pow(nearest / 40, 2)) : 0;
  const amp = reduceMotion ? 0 : clamp(Math.abs(S.v) / 90, 0, 1) * near * 1.6 * cam.k;
  cam.ox = (Math.sin(time * 61) + Math.sin(time * 37.3)) * 0.5 * amp;
  cam.oy = (Math.sin(time * 53.1) + Math.sin(time * 29.7)) * 0.5 * amp;

  audio.update({
    speed: S.v,
    near,
    braking: S.phase === 'arriving' ? 1 : 0,
    pan: clamp(nearest / 30, -1, 1),
  });

  render();
}

function render() {
  const d = cam.dpr;
  ctx.setTransform(d, 0, 0, d, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#0b0b0c';
  ctx.fillRect(0, 0, cam.w, cam.h);

  station.drawBackground(ctx);
  drawTrainLights('wall');

  // Train → its own layer, then motion-blurred composite.
  let trainImg = null;
  if (trainOnScreen()) {
    const tctx = trainLayer.ctx;
    tctx.setTransform(1, 0, 0, 1, 0, 0);
    tctx.clearRect(0, 0, trainLayer.c.width, trainLayer.c.height);
    drawTrain(tctx, cam, train, S.head, {
      doors: S.doors,
      bounce: S.bounce,
      doorLights: S.phase === 'stopped' && (S.doors > 0 || S.closing) && (!S.closing || Math.floor(time * 4) % 2 === 0),
      dest: S.express ? 'Not in service' : CONFIG.destination,
      env: station.env,
      paintEnv: station.paintEnv,
    });
    const blurPx = reduceMotion ? 0 : Math.abs(S.v) * cam.s(T) * (1 / 60) * 0.9;
    trainImg = blurPx < 1.5 ? trainLayer : motionBlur(trainLayer, blurPx);
    ctx.setTransform(d, 0, 0, d, 0, 0);
    ctx.drawImage(trainImg.c, 0, 0, cam.w, cam.h);
  }

  station.drawFloor(ctx);

  // Polished floor: mirrored about where the car side meets the floor plane.
  station.drawReflection(ctx, trainImg, cam.hy + cam.oy + cam.eye * cam.f / T);

  drawDoorSpill();
  drawTrainLights('front');
  station.drawSign(ctx, signGrid(time));
  station.drawPost(ctx, time);
}

// ---------------------------------------------------------------------------

async function init() {
  try {
    await Promise.race([
      Promise.all(['500', '600', '700'].map((w) => document.fonts.load(`${w} 40px ${FONT}`))),
      new Promise((r) => setTimeout(r, 2000)),
    ]);
  } catch (_) { /* fall back to system fonts */ }
  resize();
  ready = true;
  document.body.classList.add('ready');
  let rt;
  addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(resize, 120);
  });
  if (reduceMotion) {
    // Start with a train already berthed rather than an entrance.
    startTrain(false);
    S.t = CONFIG.arrivalTime;
  }
}

// Debug/screenshot hook: window.__scene.set({phase, t, head})
window.__scene = {
  S, cam, train,
  set(o) { Object.assign(S, o); },
  arriveAt(t) { startTrain(false); S.t = 0; update(t); },
  stopAt(t) { startTrain(false); S.t = CONFIG.arrivalTime; update(0); S.phase = 'stopped'; S.t = 0; update(t); },
  expressAt(head) { startTrain(true); S.head = head; },
};

requestAnimationFrame(frame);
init();
