import { CONFIG, GEO } from './config.js';
import { rng, roundRectPath, dotText, easeInOut } from './util.js';
import { FONT } from './station.js';

// Fleet of the Future style cars. Units: feet, car-local x runs 0..L (left→right), y is up from floor.
const T = GEO.zTrain;
export const GAP = 2.4;
const DOOR_W = 4.3;
const DOOR_H = 6.5;
const WIN_Y0 = 2.95;
const WIN_Y1 = 6.05;
const BOT = -0.75;
const TOP = 7.35;
const CAB = 9.5;

const WHITE = '#eef0ee';
const BLUE = '#1f93d1';
const CHAMP = '#b7ae9c';
const DOOR = '#c2bcae';

const SKIN = ['#8d5a3b', '#c68e6b', '#e8b894', '#5a3825', '#a86f4c', '#f0c8a8'];
const CLOTH = ['#2b2f3a', '#6b2d2d', '#3d5a40', '#c9b27c', '#1f3b5c', '#7a7a7a', '#b85c38', '#e6e1d6', '#472d52', '#111215'];
const HAIR = ['#1a1410', '#3b2a1e', '#6b4b2e', '#9a9a9a', '#0f0c0a', '#b58a4a'];

function carSpec(type, cab, seed) {
  const L = type === 'D' ? 70 : 57;
  const r = rng(seed);
  // Layout with the cab (if any) on the right; mirrored afterwards for a left cab.
  const doors = type === 'D' ? [11.2, 30.7, 50.2] : [9.8, 28.5, 47.2];
  const endR = type === 'D' ? L - CAB - 0.7 : L - 1.3;
  const park = DOOR_W + 0.2;
  const segs = [];
  let a = 1.3;
  for (const c of doors) { segs.push([a, c - park]); a = c + park; }
  segs.push([a, endR]);
  const windows = [];
  for (const [s0, s1] of segs) {
    const len = s1 - s0;
    if (len > 8) {
      const w = (len - 1.2) / 2;
      windows.push([s0, s0 + w], [s1 - w, s1]);
    } else windows.push([s0, s1]);
  }
  let spec = {
    type, L, doors, windows: windows.map(([x0, x1]) => ({ x0, x1 })),
    cab: type === 'D' ? 'right' : null,
    interior: [0.6, type === 'D' ? L - CAB : L - 0.6],
    number: String(type === 'D' ? 3001 + Math.floor(r() * 290) : 4001 + Math.floor(r() * 390)),
  };

  // seats (profile view) outside the door standing zones
  const zones = [];
  let za = spec.interior[0] + 0.4;
  for (const c of doors) { zones.push([za, c - 3.1]); za = c + 3.1; }
  zones.push([za, spec.interior[1] - 0.4]);
  const seats = [];
  for (const [z0, z1] of zones) {
    let facing = -1;
    for (let x = z0; x + 2.3 <= z1; x += 2.75) {
      seats.push({ x: facing < 0 ? x + 2.1 : x + 0.2, facing: -facing });
      facing = -facing;
    }
  }
  const person = (x, facing, standing) => ({
    x, facing, standing,
    skin: SKIN[Math.floor(r() * SKIN.length)],
    top: CLOTH[Math.floor(r() * CLOTH.length)],
    pants: CLOTH[Math.floor(r() * 4)],
    hair: HAIR[Math.floor(r() * HAIR.length)],
    h: 0.92 + r() * 0.14,
    bag: r() < 0.25,
  });
  spec.seatsNear = seats;
  spec.seatsFar = seats.map((s) => ({ ...s }));
  spec.peopleNear = seats.filter(() => r() < 0.42).map((s) => person(s.x + s.facing * 0.55, s.facing, false));
  spec.peopleFar = spec.seatsFar.filter(() => r() < 0.5).map((s) => person(s.x + s.facing * 0.55, s.facing, false));
  spec.standing = [];
  for (const c of doors) {
    if (r() < 0.55) spec.standing.push(person(c + (r() - 0.5) * 3.5, r() < 0.5 ? 1 : -1, true));
  }

  if (cab === 'left') spec = mirror(spec);
  return spec;
}

function mirror(s) {
  const L = s.L, m = (x) => L - x;
  const flipP = (p) => ({ ...p, x: m(p.x), facing: -p.facing });
  return {
    ...s,
    cab: 'left',
    doors: s.doors.map(m),
    windows: s.windows.map((w) => ({ x0: m(w.x1), x1: m(w.x0) })),
    interior: [m(s.interior[1]), m(s.interior[0])],
    seatsNear: s.seatsNear.map(flipP),
    seatsFar: s.seatsFar.map(flipP),
    peopleNear: s.peopleNear.map(flipP),
    peopleFar: s.peopleFar.map(flipP),
    standing: s.standing.map(flipP),
  };
}

export function buildTrain(n = CONFIG.cars) {
  const cars = [];
  for (let i = 0; i < n; i++) {
    const end = i === 0 || i === n - 1;
    const cab = i === 0 ? 'right' : i === n - 1 ? 'left' : null;
    cars.push(carSpec(end ? 'D' : 'E', cab, 1000 + i * 97));
  }
  const length = cars.reduce((a, c) => a + c.L, 0) + GAP * (n - 1);
  return { cars, length };
}

// World x of car i's left end, given the head (front, right end of car 0).
export function carLeft(train, i, head) {
  let x = head;
  for (let j = 0; j <= i; j++) x -= train.cars[j].L + (j ? GAP : 0);
  return x;
}

// Head position that centres the middle door of car `ci` on x = 0.
export function stopHeadFor(train, ci = 2) {
  const left = carLeft(train, ci, 0);
  const car = train.cars[ci];
  const door = car.doors[1];
  return -(left + door);
}

// ---------------------------------------------------------------------------

export function drawTrain(ctx, cam, train, head, st) {
  const [va, vb] = cam.xRange(T, 8);
  let x = head;
  for (let i = 0; i < train.cars.length; i++) {
    const car = train.cars[i];
    const right = x;
    const left = x - car.L;
    if (left < vb && right > va) drawCar(ctx, cam, car, left, st);
    if (i < train.cars.length - 1) {
      const gl = left - GAP;
      if (left > va && gl < vb) drawGap(ctx, cam, gl, left, st.bounce);
    }
    x = left - GAP;
  }
}

function drawGap(ctx, cam, x0, x1, b) {
  ctx.save();
  cam.plane(ctx, T + 0.5, 0, b);
  ctx.fillStyle = '#18191b';
  ctx.fillRect(x0 - 0.3, -0.2, x1 - x0 + 0.6, 6.7);
  ctx.fillStyle = '#26272a';
  for (let x = x0 + 0.15; x < x1; x += 0.22) ctx.fillRect(x, -0.2, 0.08, 6.7);
  // coupler
  ctx.fillStyle = '#0c0c0d';
  ctx.fillRect(x0 - 0.3, -0.6, x1 - x0 + 0.6, 0.5);
  ctx.restore();
}

function bodyPath(ctx, car) {
  const L = car.L;
  if (car.cab === 'left') {
    ctx.moveTo(0.9, BOT);
    ctx.quadraticCurveTo(0, BOT, 0, BOT + 0.9);
    ctx.lineTo(0, 3.0);
    ctx.quadraticCurveTo(0.05, 3.9, 0.55, 4.7);
    ctx.lineTo(1.75, TOP - 0.4);
    ctx.quadraticCurveTo(2.0, TOP, 2.9, TOP);
  } else {
    ctx.moveTo(0.3, BOT);
    ctx.quadraticCurveTo(0, BOT, 0, BOT + 0.3);
    ctx.lineTo(0, TOP - 0.9);
    ctx.quadraticCurveTo(0, TOP, 0.9, TOP);
  }
  if (car.cab === 'right') {
    ctx.lineTo(L - 2.9, TOP);
    ctx.quadraticCurveTo(L - 2.0, TOP, L - 1.75, TOP - 0.4);
    ctx.lineTo(L - 0.55, 4.7);
    ctx.quadraticCurveTo(L - 0.05, 3.9, L, 3.0);
    ctx.lineTo(L, BOT + 0.9);
    ctx.quadraticCurveTo(L, BOT, L - 0.9, BOT);
  } else {
    ctx.lineTo(L - 0.9, TOP);
    ctx.quadraticCurveTo(L, TOP, L, TOP - 0.9);
    ctx.lineTo(L, BOT + 0.3);
    ctx.quadraticCurveTo(L, BOT, L - 0.3, BOT);
  }
  ctx.closePath();
}

function cabWindow(car) {
  const L = car.L;
  // Side window just behind the windscreen.
  return car.cab === 'right' ? { x0: L - 6.9, x1: L - 3.0 } : car.cab === 'left' ? { x0: 3.0, x1: 6.9 } : null;
}

function cabWindowPath(ctx, car) {
  const L = car.L;
  if (car.cab === 'right') {
    ctx.moveTo(L - 6.9 + 0.4, 3.35);
    ctx.lineTo(L - 3.35, 3.35);
    ctx.quadraticCurveTo(L - 2.9, 3.35, L - 2.75, 3.8);
    ctx.lineTo(L - 2.1, 6.0);
    ctx.quadraticCurveTo(L - 2.0, 6.3, L - 2.4, 6.3);
    ctx.lineTo(L - 6.5, 6.3);
    ctx.quadraticCurveTo(L - 6.9, 6.3, L - 6.9, 5.9);
    ctx.lineTo(L - 6.9, 3.75);
    ctx.quadraticCurveTo(L - 6.9, 3.35, L - 6.5, 3.35);
    ctx.closePath();
  } else if (car.cab === 'left') {
    ctx.moveTo(6.5, 3.35);
    ctx.lineTo(3.35, 3.35);
    ctx.quadraticCurveTo(2.9, 3.35, 2.75, 3.8);
    ctx.lineTo(2.1, 6.0);
    ctx.quadraticCurveTo(2.0, 6.3, 2.4, 6.3);
    ctx.lineTo(6.5, 6.3);
    ctx.quadraticCurveTo(6.9, 6.3, 6.9, 5.9);
    ctx.lineTo(6.9, 3.75);
    ctx.quadraticCurveTo(6.9, 3.35, 6.5, 3.35);
    ctx.closePath();
  }
}

function windowsPath(ctx, car) {
  for (const w of car.windows) roundRectPath(ctx, w.x0, WIN_Y0, w.x1 - w.x0, WIN_Y1 - WIN_Y0, 0.42);
}

function doorOpeningsPath(ctx, car) {
  for (const c of car.doors) ctx.rect(c - DOOR_W / 2, 0, DOOR_W, DOOR_H);
}

function drawCar(ctx, cam, car, x0, st) {
  const b = st.bounce;
  const L = car.L;

  // 1. Interior, visible through every opening.
  ctx.save();
  cam.plane(ctx, T, x0, b);
  ctx.beginPath();
  windowsPath(ctx, car);
  doorOpeningsPath(ctx, car);
  ctx.clip();
  drawInterior(ctx, cam, car, x0, b);
  // tinted glass over the windows (doors are open holes)
  cam.plane(ctx, T, x0, b);
  ctx.beginPath();
  windowsPath(ctx, car);
  ctx.fillStyle = 'rgba(8,12,16,0.66)';
  ctx.fill();
  // destination sign inside the window right of the middle door
  const w = car.windows.find((w) => w.x0 > car.doors[1]) || car.windows[0];
  drawSideSign(ctx, w.x0 + 0.3, WIN_Y1 - 0.25, st.dest);
  ctx.restore();

  // Cab interior is dark; just glass.
  const cw = cabWindow(car);
  if (cw) {
    cam.plane(ctx, T, x0, b);
    ctx.beginPath();
    cabWindowPath(ctx, car);
    ctx.fillStyle = '#0d1115';
    ctx.fill();
  }

  // 2. Body shell with openings cut out.
  ctx.save();
  cam.plane(ctx, T, x0, b);
  ctx.beginPath();
  bodyPath(ctx, car);
  windowsPath(ctx, car);
  doorOpeningsPath(ctx, car);
  if (cw) cabWindowPath(ctx, car);
  ctx.clip('evenodd');
  ctx.fillStyle = WHITE;
  ctx.fillRect(-1, BOT - 1, L + 2, TOP - BOT + 2);
  drawLivery(ctx, car);
  // drip rail along the roofline
  ctx.fillStyle = 'rgba(120,126,132,0.55)';
  ctx.fillRect(-1, 6.92, L + 2, 0.05);
  // skirt below the floor line
  ctx.fillStyle = '#3c3e41';
  ctx.fillRect(-1, BOT - 1, L + 2, 0.95);
  // road grime creeping up from the bottom
  const gr = ctx.createLinearGradient(0, 1.6, 0, 0);
  gr.addColorStop(0, 'rgba(110,98,80,0)');
  gr.addColorStop(1, 'rgba(110,98,80,0.16)');
  ctx.fillStyle = gr;
  ctx.fillRect(-1, 0, L + 2, 1.6);
  if (car.cab) drawWindscreen(ctx, car);
  shadeBody(ctx, L);
  ctx.restore();

  // 3. Gaskets & door frames
  cam.plane(ctx, T, x0, b);
  ctx.lineWidth = 0.05;
  ctx.strokeStyle = 'rgba(40,44,48,0.9)';
  ctx.beginPath();
  windowsPath(ctx, car);
  if (cw) cabWindowPath(ctx, car);
  ctx.stroke();
  ctx.lineWidth = 0.06;
  ctx.strokeStyle = 'rgba(30,32,34,0.9)';
  ctx.beginPath();
  for (const c of car.doors) ctx.rect(c - DOOR_W / 2 - 0.05, 0, DOOR_W + 0.1, DOOR_H + 0.05);
  ctx.stroke();
  // door jamb shadow inside the opening, visible when open
  if (st.doors > 0.01) {
    for (const c of car.doors) {
      const side = Math.sign(x0 + c - cam.camX) || 1;
      const jw = 0.35 * Math.min(1, Math.abs(x0 + c - cam.camX) / 8 + 0.15);
      const xj = side > 0 ? c + DOOR_W / 2 - jw : c - DOOR_W / 2;
      ctx.fillStyle = 'rgba(60,62,64,0.95)';
      ctx.fillRect(xj, 0, jw, DOOR_H);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(c - DOOR_W / 2, DOOR_H - 0.25, DOOR_W, 0.25);
      // threshold plate
      ctx.fillStyle = '#8f9192';
      ctx.fillRect(c - DOOR_W / 2, -0.02, DOOR_W, 0.09);
    }
  }

  // 4. Door leaves slide outward over the body.
  const glass = [];
  const open = easeInOut(Math.min(1, Math.max(0, st.doors)));
  for (const c of car.doors) {
    const hw = DOOR_W / 2, sh = hw * open;
    for (const side of [-1, 1]) {
      const inner = c + side * sh;
      const outer = c + side * (hw + sh);
      const lx0 = Math.min(inner, outer), lx1 = Math.max(inner, outer);
      drawLeaf(ctx, lx0, lx1, side);
      const gx0 = side < 0 ? lx0 + 0.36 : lx0 + 0.22;
      const gx1 = side < 0 ? lx1 - 0.22 : lx1 - 0.36;
      glass.push([gx0, gx1]);
    }
  }

  // 5a. Fixed-in-screen reflection on the painted body (and door leaves).
  if (st.paintEnv) {
    ctx.save();
    cam.plane(ctx, T, x0, b);
    ctx.beginPath();
    bodyPath(ctx, car);
    windowsPath(ctx, car);
    if (st.doors > 0.01) doorOpeningsPath(ctx, car);
    if (cw) cabWindowPath(ctx, car);
    ctx.clip('evenodd');
    ctx.setTransform(cam.dpr, 0, 0, cam.dpr, 0, 0);
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 0.5;
    ctx.drawImage(st.paintEnv.c, 0, 0, st.paintEnv.w, st.paintEnv.h);
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 1;
    ctx.drawImage(st.paintEnv.c, 0, 0, st.paintEnv.w, st.paintEnv.h);
    ctx.restore();
  }

  // 5. Fixed-in-screen reflections across all glass.
  if (st.env) {
    ctx.save();
    cam.plane(ctx, T, x0, b);
    ctx.beginPath();
    windowsPath(ctx, car);
    if (cw) cabWindowPath(ctx, car);
    for (const [gx0, gx1] of glass) roundRectPath(ctx, gx0, 3.0, gx1 - gx0, 3.05, 0.3);
    ctx.clip();
    ctx.setTransform(cam.dpr, 0, 0, cam.dpr, 0, 0);
    ctx.globalCompositeOperation = 'screen';
    ctx.drawImage(st.env.c, 0, 0, st.env.w, st.env.h);
    ctx.restore();
  }

  // 6. Details: door status lights, logo, car number.
  cam.plane(ctx, T, x0, b);
  for (const c of car.doors) {
    const on = st.doorLights;
    ctx.fillStyle = on ? '#ff2b1c' : '#4a1d18';
    ctx.beginPath();
    roundRectPath(ctx, c - 0.32, DOOR_H + 0.18, 0.64, 0.15, 0.06);
    ctx.fill();
  }
  if (car.cab) {
    const lx = car.cab === 'right' ? L - 6.6 : 3.3;
    drawLogo(ctx, cam, x0, b, lx, 1.05, 1.25);
  }
  const nx = car.cab === 'left' ? L - 2.2 : 1.1;
  textOnPlane(ctx, cam, T, x0, b, nx, 0.55, 0.36, car.number, '600', '#4b5b69', 'left');
}

// The raked windscreen wraps around the nose; from the side it reads as a dark sloped band.
function drawWindscreen(ctx, car) {
  const L = car.L;
  const m = car.cab === 'left' ? (x) => L - x : (x) => x;
  ctx.beginPath();
  ctx.moveTo(m(L - 2.55), TOP + 0.1);
  ctx.lineTo(m(L - 1.2), TOP + 0.1);
  ctx.lineTo(m(L + 0.2), 4.35);
  ctx.lineTo(m(L - 0.75), 4.35);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, TOP, 0, 4.3);
  g.addColorStop(0, '#1d2329');
  g.addColorStop(1, '#0c0f12');
  ctx.fillStyle = g;
  ctx.fill();
  // headlight cluster on the nose corner
  ctx.fillStyle = '#23272b';
  ctx.beginPath();
  roundRectPath(ctx, m(L - 0.55) - (car.cab === 'left' ? 0.5 : 0), 1.1, 0.5, 0.7, 0.2);
  ctx.fill();
}

function drawLeaf(ctx, x0, x1, side) {
  ctx.beginPath();
  roundRectPath(ctx, x0, 0.02, x1 - x0, DOOR_H - 0.02, 0.12);
  const g = ctx.createLinearGradient(0, DOOR_H, 0, 0);
  g.addColorStop(0, '#d6d1c5');
  g.addColorStop(0.55, DOOR);
  g.addColorStop(1, '#8e887c');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 0.035;
  ctx.strokeStyle = 'rgba(40,40,40,0.6)';
  ctx.stroke();
  // window (semi-transparent so whatever is behind reads through)
  const gx0 = side < 0 ? x0 + 0.36 : x0 + 0.22;
  const gx1 = side < 0 ? x1 - 0.22 : x1 - 0.36;
  ctx.beginPath();
  roundRectPath(ctx, gx0, 3.0, gx1 - gx0, 3.05, 0.3);
  ctx.fillStyle = 'rgba(10,13,17,0.8)';
  ctx.fill();
  ctx.lineWidth = 0.05;
  ctx.strokeStyle = '#26282b';
  ctx.stroke();
  // rubber nosing on the leading edge
  const ex = side < 0 ? x1 - 0.08 : x0;
  ctx.fillStyle = '#1b1c1e';
  ctx.fillRect(ex, 0.05, 0.08, DOOR_H - 0.1);
  // subtle vertical brushed highlight
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(x0 + (x1 - x0) * 0.2, 0.2, 0.06, 2.5);
}

function drawLivery(ctx, car) {
  const L = car.L;
  // Swooshes at each car end: blue band, then a champagne sweep.
  const ends = [];
  const cabOff = 6.3;
  ends.push({ e: 0, dir: 1, off: car.cab === 'left' ? cabOff : 0 });
  ends.push({ e: L, dir: -1, off: car.cab === 'right' ? cabOff : 0 });
  for (const { e, dir, off } of ends) {
    const X = (u) => e + dir * (u + off);
    // blue
    ctx.beginPath();
    ctx.moveTo(X(0.9), TOP + 0.2);
    ctx.lineTo(X(4.9), TOP + 0.2);
    ctx.bezierCurveTo(X(3.6), 4.2, X(2.6), 2.0, X(2.3), BOT - 0.2);
    ctx.lineTo(X(off ? -0.4 : -0.5), BOT - 0.2);
    ctx.bezierCurveTo(X(0.2), 2.5, X(0.4), 5.2, X(0.9), TOP + 0.2);
    ctx.closePath();
    ctx.fillStyle = BLUE;
    ctx.fill();
    // champagne sweep
    ctx.beginPath();
    ctx.moveTo(X(4.9), TOP + 0.2);
    ctx.lineTo(X(6.9), TOP + 0.2);
    ctx.bezierCurveTo(X(5.0), 4.5, X(4.0), 1.5, X(4.3), BOT - 0.2);
    ctx.lineTo(X(2.3), BOT - 0.2);
    ctx.bezierCurveTo(X(2.6), 2.0, X(3.6), 4.2, X(4.9), TOP + 0.2);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, TOP, 0, BOT);
    g.addColorStop(0, '#cfc7b6');
    g.addColorStop(1, CHAMP);
    ctx.fillStyle = g;
    ctx.fill();
    // thin white pinstripe between them
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 0.06;
    ctx.beginPath();
    ctx.moveTo(X(4.9), TOP + 0.2);
    ctx.bezierCurveTo(X(3.6), 4.2, X(2.6), 2.0, X(2.3), BOT - 0.2);
    ctx.stroke();
  }
}

function shadeBody(ctx, L) {
  // Curved car side lit from above: multiply for form, then a soft shoulder highlight.
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  const g = ctx.createLinearGradient(0, TOP, 0, BOT);
  g.addColorStop(0, 'rgb(150,155,160)');
  g.addColorStop(0.07, 'rgb(215,218,220)');
  g.addColorStop(0.14, 'rgb(255,255,255)');
  g.addColorStop(0.55, 'rgb(246,246,246)');
  g.addColorStop(0.82, 'rgb(215,216,216)');
  g.addColorStop(0.9, 'rgb(170,171,172)');
  g.addColorStop(1, 'rgb(90,92,95)');
  ctx.fillStyle = g;
  ctx.fillRect(-1, BOT - 1, L + 2, TOP - BOT + 2);
  ctx.restore();
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const h = ctx.createLinearGradient(0, TOP, 0, 5.8);
  h.addColorStop(0, 'rgba(255,255,255,0)');
  h.addColorStop(0.35, 'rgba(255,255,255,0.35)');
  h.addColorStop(0.6, 'rgba(255,255,255,0.05)');
  h.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = h;
  ctx.fillRect(-1, 5.8, L + 2, TOP - 5.8);
  ctx.restore();
}

function drawSideSign(ctx, x, yTop, text) {
  const cols = dotText(text);
  const pitch = 0.04;
  const w = cols.length * pitch + 0.16;
  ctx.fillStyle = 'rgba(0,0,0,0.85)';
  ctx.fillRect(x, yTop - 7 * pitch - 0.14, w, 7 * pitch + 0.14);
  ctx.fillStyle = '#ff4a26';
  for (let i = 0; i < cols.length; i++) {
    for (let j = 0; j < 7; j++) {
      if (cols[i][j]) ctx.fillRect(x + 0.08 + i * pitch, yTop - 0.07 - (j + 1) * pitch, pitch * 0.75, pitch * 0.75);
    }
  }
}

function drawLogo(ctx, cam, x0, b, x, y, h) {
  // Stylised "ba" mark built from primitives (no font needed).
  const t = h * 0.2;
  const R = h * 0.31;
  ctx.fillStyle = '#0b1a2e';
  ctx.fillRect(x, y, t, h);
  ctx.lineWidth = t;
  ctx.strokeStyle = '#0b1a2e';
  ctx.beginPath();
  ctx.arc(x + R, y + R, R - t / 2, 0, Math.PI * 2);
  ctx.stroke();
  const ax = x + 2 * R + R * 0.95;
  ctx.strokeStyle = '#0a97d6';
  ctx.beginPath();
  ctx.arc(ax, y + R, R - t / 2, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#0a97d6';
  ctx.fillRect(ax + R - t, y, t, 2 * R);
  textOnPlane(ctx, cam, T, x0, b, x + 2 * R - t * 0.2, y + h - 0.02, h * 0.2, 'B A R T', '700', '#0b1a2e', 'left');
  cam.plane(ctx, T, x0, b);
}

function textOnPlane(ctx, cam, z, x0, b, x, y, sizeFt, str, weight, color, align) {
  const s = cam.f / z;
  const sx = cam.cx + cam.ox + (x0 + x - cam.camX) * s;
  const sy = cam.hy + cam.oy + (cam.eye - b - y) * s;
  ctx.save();
  ctx.setTransform(cam.dpr, 0, 0, cam.dpr, 0, 0);
  ctx.fillStyle = color;
  ctx.font = `${weight} ${sizeFt * s}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(str, sx, sy);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Interior: drawn with true perspective (far wall is ~2x further than the near side).

function drawInterior(ctx, cam, car, x0, b) {
  const zn = T + 0.3;
  const zf = T + GEO.carWidth - 0.3;
  const [ia, ib] = car.interior;
  const d = cam.dpr;
  const P = (x, y, z) => [
    cam.cx + cam.ox + (x0 + x - cam.camX) * cam.f / z,
    cam.hy + cam.oy + (cam.eye - b - y) * cam.f / z,
  ];
  const quad = (pts, fill) => {
    ctx.beginPath();
    ctx.moveTo(...pts[0]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(...pts[i]);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  };

  // Base fill (in case of gaps) — lit interior.
  ctx.setTransform(d, 0, 0, d, 0, 0);
  ctx.fillStyle = '#b9bfc2';
  ctx.fillRect(P(ia, 0, zn)[0], 0, P(ib, 0, zn)[0] - P(ia, 0, zn)[0], cam.h);

  // Far wall
  cam.plane(ctx, zf, x0, b);
  ctx.fillStyle = '#d3d8da';
  ctx.fillRect(ia, 0, ib - ia, 7.0);
  ctx.fillStyle = '#9aa3a8';
  ctx.fillRect(ia, 0, ib - ia, WIN_Y0 - 0.15);
  ctx.fillStyle = '#26303a';
  ctx.beginPath();
  windowsPath(ctx, car);
  ctx.fill();
  // far-side windows show the dim station wall beyond
  ctx.fillStyle = 'rgba(120,110,90,0.18)';
  for (const w of car.windows) ctx.fillRect(w.x0 + 0.2, WIN_Y0 + 0.2, w.x1 - w.x0 - 0.4, 1.0);
  for (const c of car.doors) {
    for (const side of [-1, 1]) {
      const lx0 = side < 0 ? c - DOOR_W / 2 : c, lx1 = lx0 + DOOR_W / 2;
      ctx.fillStyle = '#b9b3a6';
      ctx.fillRect(lx0, 0, lx1 - lx0, DOOR_H);
      ctx.fillStyle = '#2b333b';
      ctx.fillRect(lx0 + 0.3, 3.0, lx1 - lx0 - 0.6, 3.0);
    }
    ctx.fillStyle = '#1d1e20';
    ctx.fillRect(c - 0.03, 0, 0.06, DOOR_H);
  }

  // Floor and ceiling planes
  ctx.setTransform(d, 0, 0, d, 0, 0);
  const fl = [P(ia, 0, zn), P(ib, 0, zn), P(ib, 0, zf), P(ia, 0, zf)];
  const fg = ctx.createLinearGradient(0, fl[0][1], 0, fl[2][1]);
  fg.addColorStop(0, '#7c7f81');
  fg.addColorStop(1, '#5c6064');
  quad(fl, fg);
  const cy = 6.95;
  quad([P(ia, cy, zn), P(ib, cy, zn), P(ib, cy, zf), P(ia, cy, zf)], '#eef1f1');
  for (const zc of [zn + 2.3, zf - 2.3]) {
    quad([P(ia, cy - 0.01, zc - 0.28), P(ib, cy - 0.01, zc - 0.28), P(ib, cy - 0.01, zc + 0.28), P(ia, cy - 0.01, zc + 0.28)], '#ffffff');
  }
  // luggage-rack style ceiling edge on both sides
  quad([P(ia, 6.6, zf - 0.8), P(ib, 6.6, zf - 0.8), P(ib, cy, zf - 0.8), P(ia, cy, zf - 0.8)], '#c3c8ca');

  // Far seats + riders
  cam.plane(ctx, zf - 1.25, x0, b);
  for (const s of car.seatsFar) drawSeat(ctx, s);
  for (const p of car.peopleFar) drawPerson(ctx, p);

  // Standing riders near doors
  cam.plane(ctx, zn + 4.8, x0, b);
  for (const p of car.standing) drawPerson(ctx, p);

  // Stanchions: three-branch poles at each doorway
  cam.plane(ctx, zn + 2.3, x0, b);
  for (const c of car.doors) {
    const pg = ctx.createLinearGradient(c - 0.07, 0, c + 0.07, 0);
    pg.addColorStop(0, '#8d9294');
    pg.addColorStop(0.45, '#f2f4f4');
    pg.addColorStop(1, '#7c8184');
    ctx.fillStyle = pg;
    ctx.fillRect(c - 0.065, 0, 0.13, 7);
    ctx.strokeStyle = '#d7dbdc';
    ctx.lineWidth = 0.1;
    ctx.beginPath();
    ctx.moveTo(c, 5.1); ctx.quadraticCurveTo(c - 0.1, 6.3, c - 0.8, 7.0);
    ctx.moveTo(c, 5.1); ctx.quadraticCurveTo(c + 0.1, 6.3, c + 0.8, 7.0);
    ctx.stroke();
  }
  // grab rail
  ctx.fillStyle = '#c9cdcf';
  ctx.fillRect(ia, 6.15, ib - ia, 0.09);

  // Near seats + riders (right behind the glass)
  cam.plane(ctx, zn + 1.2, x0, b);
  for (const s of car.seatsNear) drawSeat(ctx, s);
  for (const p of car.peopleNear) drawPerson(ctx, p);

  // Interior light falloff toward the floor
  ctx.setTransform(d, 0, 0, d, 0, 0);
  const top = P(0, 7, zn)[1], bot = P(0, 0, zn)[1];
  const lg = ctx.createLinearGradient(0, top, 0, bot);
  lg.addColorStop(0, 'rgba(255,255,255,0)');
  lg.addColorStop(0.6, 'rgba(20,24,30,0.05)');
  lg.addColorStop(1, 'rgba(20,24,30,0.3)');
  ctx.fillStyle = lg;
  ctx.fillRect(P(ia, 0, zn)[0], top, P(ib, 0, zn)[0] - P(ia, 0, zn)[0], bot - top);

  // Threshold / car wall thickness at the openings
  quad([P(ia, 0, T), P(ib, 0, T), P(ib, 0, zn), P(ia, 0, zn)], '#9c9e9f');
}

function drawSeat(ctx, s) {
  const f = s.facing;
  const bx = s.x;
  // pedestal
  ctx.fillStyle = '#2a2d31';
  ctx.fillRect(Math.min(bx, bx + f * 1.3), 0, 1.3, 1.35);
  // cushion
  ctx.fillStyle = '#23456f';
  ctx.beginPath();
  roundRectPath(ctx, Math.min(bx, bx + f * 1.6), 1.3, 1.6, 0.36, 0.12);
  ctx.fill();
  // backrest (slightly reclined)
  ctx.beginPath();
  ctx.moveTo(bx - f * 0.05, 1.4);
  ctx.lineTo(bx + f * 0.35, 1.4);
  ctx.lineTo(bx + f * 0.22, 3.6);
  ctx.quadraticCurveTo(bx + f * 0.05, 3.85, bx - f * 0.2, 3.6);
  ctx.closePath();
  ctx.fillStyle = '#2d5585';
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(Math.min(bx - f * 0.15, bx + f * 0.15), 3.1, 0.3, 0.45);
}

function drawPerson(ctx, p) {
  const f = p.facing, x = p.x, k = p.h;
  if (p.standing) {
    ctx.fillStyle = p.pants;
    ctx.fillRect(x - 0.28, 0, 0.24, 2.9 * k);
    ctx.fillRect(x + 0.04, 0, 0.24, 2.9 * k);
    ctx.fillStyle = p.top;
    ctx.beginPath();
    roundRectPath(ctx, x - 0.42, 2.75 * k, 0.84, 2.15 * k, 0.28);
    ctx.fill();
    if (p.bag) {
      ctx.fillStyle = '#2a2622';
      ctx.beginPath();
      roundRectPath(ctx, x - f * 0.35 - 0.3, 3.0 * k, 0.6, 1.3, 0.12);
      ctx.fill();
    }
    ctx.fillStyle = p.skin;
    ctx.fillRect(x - 0.09, 4.8 * k, 0.18, 0.3);
    ctx.beginPath();
    ctx.ellipse(x + f * 0.04, 5.35 * k, 0.3, 0.38, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = p.hair;
    ctx.beginPath();
    ctx.ellipse(x - f * 0.03, 5.5 * k, 0.31, 0.26, 0, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  // seated, in profile, facing +f
  ctx.fillStyle = p.pants;
  ctx.beginPath();
  roundRectPath(ctx, Math.min(x, x + f * 1.35), 1.6, 1.35, 0.5, 0.2);
  ctx.fill();
  ctx.fillRect(x + f * 1.15 - 0.2, 0.05, 0.38, 1.9);
  ctx.fillStyle = '#16171a';
  ctx.fillRect(Math.min(x + f * 1.0, x + f * 1.5), 0, 0.5, 0.18);
  ctx.fillStyle = p.top;
  ctx.beginPath();
  roundRectPath(ctx, x - 0.42 - f * 0.05, 1.75, 0.84, 2.25 * k, 0.3);
  ctx.fill();
  // arm
  ctx.fillStyle = shade(p.top);
  ctx.beginPath();
  roundRectPath(ctx, Math.min(x, x + f * 0.9), 2.25, 0.9, 0.28, 0.13);
  ctx.fill();
  ctx.fillStyle = p.skin;
  ctx.fillRect(x - 0.08, 3.85 * k, 0.17, 0.3);
  ctx.beginPath();
  ctx.ellipse(x + f * 0.06, 4.35 * k, 0.29, 0.37, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = p.hair;
  ctx.beginPath();
  ctx.ellipse(x - f * 0.03, 4.5 * k, 0.3, 0.25, 0, 0, Math.PI * 2);
  ctx.fill();
}

function shade(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) * 0.75, g = ((n >> 8) & 255) * 0.75, b2 = (n & 255) * 0.75;
  return `rgb(${r | 0},${g | 0},${b2 | 0})`;
}
