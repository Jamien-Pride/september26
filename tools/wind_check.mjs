import { Slice } from '../js/lessons/wind.js';
for (const delta of [0, 19, 41]) {
  const p = new Slice('plan', 250, 128, 0.1), s = new Slice('section', 250, 72, 0.1);
  p.setGeometry(delta); s.setGeometry(delta);
  let ap = 0, as = 0, n = 0, mx = 0;
  for (let i = 0; i < 6000; i++) {
    p.step(); s.step();
    if (i > 3000 && i % 10 === 0) { ap += p.throatRatio(); as += s.throatRatio(); n++; }
  }
  // max speed anywhere at 1.2 m in plan, relative to inflow
  for (let k = 0; k < p.ux.length; k++) if (!p.solid[k]) mx = Math.max(mx, Math.hypot(p.ux[k], p.uy[k]) / 0.09);
  console.log('delta', delta, 'throat plan', (ap / n).toFixed(2), 'section', (as / n).toFixed(2), 'max plan speed ratio', mx.toFixed(2), 'solid cells', p.solid.reduce((a, b) => a + b, 0), s.solid.reduce((a, b) => a + b, 0));
}
