// Interface: time-of-day strip, view presets, sculpture and conditions controls,
// and the reflected-sunlight readout.

const $ = (id) => document.getElementById(id);
const fmtTime = (min) => {
  const m = ((Math.round(min) % 1440) + 1440) % 1440;
  let h = Math.floor(m / 60); const mm = String(m % 60).padStart(2, '0');
  const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12;
  return `${h}:${mm} ${ap}`;
};
const compass = (az) => ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'][Math.round(az / 22.5) % 16];

export function initUI(state, cb) {
  const slider = $('time'), dateIn = $('date'), play = $('play'), strip = $('strip');
  let events = null;
  const pad = (n) => String(n).padStart(2, '0');

  slider.addEventListener('input', () => { cb.onTime(+slider.value); $('clock').textContent = fmtTime(+slider.value); });
  slider.addEventListener('pointerdown', () => cb.onDrag(true));
  slider.addEventListener('pointerup', () => cb.onDrag(false));
  slider.addEventListener('change', () => cb.onDrag(false));
  dateIn.addEventListener('change', () => {
    const [y, m, d] = dateIn.value.split('-').map(Number);
    if (!y) return;
    events = cb.onDate(y, m, d); drawStrip(); drawChips();
  });
  play.addEventListener('click', () => {
    const p = play.getAttribute('aria-pressed') !== 'true';
    play.setAttribute('aria-pressed', String(p)); play.textContent = p ? 'Pause' : 'Play';
    cb.onPlay(p);
  });
  $('lens').addEventListener('change', (e) => cb.onLens(+e.target.value));
  $('speed').addEventListener('change', (e) => cb.onSpeed(+e.target.value));

  // presets
  const pv = $('presets');
  for (const [k, p] of Object.entries(cb.presets)) {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = p.label; b.dataset.preset = k;
    b.addEventListener('click', () => cb.onPreset(k)); pv.appendChild(b);
  }
  for (const b of document.querySelectorAll('[data-mode]')) b.addEventListener('click', () => {
    document.querySelectorAll('[data-mode]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    cb.onMode(b.dataset.mode);
    document.body.classList.toggle('walking', b.dataset.mode === 'walk');
  });
  for (const b of document.querySelectorAll('[data-quality]')) {
    b.setAttribute('aria-pressed', String(b.dataset.quality === state.quality));
    b.addEventListener('click', () => {
      document.querySelectorAll('[data-quality]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      cb.onQuality(b.dataset.quality);
    });
  }
  // sculpture
  const facing = $('facing');
  facing.value = state.facing;
  const showFacing = () => { $('facing-val').textContent = `${Math.round(facing.value)}° ${compass(+facing.value)}`; };
  showFacing();
  facing.addEventListener('input', () => { showFacing(); cb.onFacing(+facing.value); });
  $('facing-reset').addEventListener('click', () => { facing.value = 229.4; showFacing(); cb.onFacing(229.4); });
  const fin = () => cb.onFinish($('paint').value, $('metal').value);
  $('paint').addEventListener('change', fin); $('metal').addEventListener('change', fin);
  $('uplights').addEventListener('change', (e) => cb.onUplights(e.target.value));
  // conditions
  const cond = () => {
    const c = { haze: +$('haze').value, fog: +$('fog').value, wind: +$('wind').value, tide: +$('tide').value, clouds: +$('clouds').value };
    $('tide-val').textContent = `${c.tide >= 0 ? '+' : '−'}${Math.abs(c.tide * 3.281).toFixed(1)} ft`;
    cb.onConditions(c);
  };
  for (const id of ['haze', 'fog', 'wind', 'tide', 'clouds']) $(id).addEventListener('input', cond);
  cond();
  $('heat').addEventListener('change', (e) => cb.onHeatmap(e.target.checked));
  // panel toggle
  const panel = $('panel'), tog = $('panel-toggle');
  const setPanel = (open) => { panel.hidden = !open; tog.setAttribute('aria-expanded', String(open)); tog.textContent = open ? 'Hide controls' : 'Controls'; };
  setPanel(window.innerWidth > 760);
  tog.addEventListener('click', () => setPanel(panel.hidden));

  // touch joystick for walk mode
  const joy = $('joy'), knob = $('joy-knob');
  let jid = null;
  joy.addEventListener('pointerdown', (e) => { jid = e.pointerId; joy.setPointerCapture(jid); move(e); });
  joy.addEventListener('pointermove', (e) => { if (e.pointerId === jid) move(e); });
  const end = () => { jid = null; knob.style.transform = ''; cb.onJoystick(0, 0); };
  joy.addEventListener('pointerup', end); joy.addEventListener('pointercancel', end);
  function move(e) {
    const r = joy.getBoundingClientRect();
    let x = (e.clientX - r.left - r.width / 2) / (r.width / 2), y = (e.clientY - r.top - r.height / 2) / (r.height / 2);
    const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
    knob.style.transform = `translate(${x * 28}px, ${y * 28}px)`;
    cb.onJoystick(x, -y);
  }

  function drawStrip() {
    if (!events) return;
    const c = strip, ctx = c.getContext('2d');
    const w = c.width = c.clientWidth * devicePixelRatio, h = c.height = c.clientHeight * devicePixelRatio;
    const g = ctx.createLinearGradient(0, 0, w, 0);
    for (const [min, el] of events.samples) {
      if (min % 10) continue;
      g.addColorStop(min / 1440, skyTone(el));
    }
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    // sun elevation curve
    ctx.beginPath();
    const maxE = 90;
    events.samples.forEach(([min, el], i) => { const x = min / 1440 * w, y = h * 0.92 - Math.max(el, -6) / maxE * h * 1.4; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
    ctx.strokeStyle = 'rgba(255,215,130,0.85)'; ctx.lineWidth = 1.5 * devicePixelRatio; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (const k of ['sunrise', 'noon', 'sunset']) if (events[k]) ctx.fillRect(events[k] / 1440 * w - devicePixelRatio / 2, 0, devicePixelRatio, h);
  }
  function drawChips() {
    const box = $('chips'); box.textContent = '';
    if (!events) return;
    const list = [
      ['Civil dawn', events.civilDawn], ['Sunrise', events.sunrise], ['Solar noon', events.noon],
      ['Golden hour', events.goldenPmStart], ['Sunset', events.sunset], ['Blue hour', events.sunset != null ? events.sunset + 15 : null],
      ['Night', events.civilDusk != null ? events.civilDusk + 45 : null],
    ];
    for (const [label, t] of list) {
      if (t == null) continue;
      const b = document.createElement('button'); b.type = 'button';
      b.innerHTML = `<span>${label}</span><b>${fmtTime(t)}</b>`;
      b.addEventListener('click', () => { slider.value = Math.round(t); cb.onTime(Math.round(t)); $('clock').textContent = fmtTime(t); cb.onDrag(false); });
      box.appendChild(b);
    }
  }
  window.addEventListener('resize', drawStrip);

  return {
    setTime(min) { slider.value = Math.round(min); $('clock').textContent = fmtTime(min); },
    setDate(d, ev) { dateIn.value = `${d.y}-${pad(d.m)}-${pad(d.d)}`; events = ev; drawStrip(); drawChips(); },
    setReadout({ az, el, tz }) {
      $('tz').textContent = tz;
      $('sunpos').textContent = `Sun ${el >= 0 ? '' : '−'}${Math.abs(el).toFixed(1)}° alt · ${az.toFixed(0)}° ${compass(az)}`;
    },
    setAnalysis(s, sun) {
      const f = (x) => x < 0.05 ? '—' : `${x.toFixed(2)}×`;
      $('st-share').textContent = s.reflectedShare ? `${Math.round(s.reflectedShare * 100)}%` : '—';
      $('st-ground').textContent = f(s.groundPeak);
      $('st-head').textContent = f(s.headPeak);
      $('st-area').textContent = s.headArea > 0.01 ? `${s.headArea.toFixed(1)} m²` : '—';
      const warn = s.headPeak > 1.5 || s.groundPeak > 2.0;
      $('st-flag').dataset.level = sun.el <= 0 ? 'none' : warn ? 'warn' : 'ok';
      $('st-flag').textContent = sun.el <= 0 ? 'Sun is down' : warn ? 'Concentrated glare' : 'Diffuse reflections';
    },
  };
}

function skyTone(el) {
  // colour ramp for the day strip, from the sky itself
  const stops = [[-18, [12, 16, 30]], [-8, [34, 38, 72]], [-3, [110, 70, 110]], [0, [228, 128, 74]], [5, [240, 176, 96]], [12, [150, 190, 222]], [40, [118, 170, 222]]];
  let c = stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    if (el < stops[i][0]) { const t = Math.max(0, (el - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0])); c = stops[i - 1][1].map((v, k) => v + (stops[i][1][k] - v) * t); break; }
    c = stops[i][1];
  }
  return `rgb(${c.map(Math.round).join(',')})`;
}
