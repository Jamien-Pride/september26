// Fully synthesised sound: no audio files. Off until the visitor opts in.
export class TrainAudio {
  constructor() {
    this.ac = null;
    this.on = false;
  }

  async toggle() {
    if (!this.ac) this.build();
    if (this.on) {
      this.on = false;
      this.master.gain.setTargetAtTime(0, this.ac.currentTime, 0.15);
    } else {
      await this.ac.resume();
      this.on = true;
      this.master.gain.setTargetAtTime(0.85, this.ac.currentTime, 0.3);
    }
    return this.on;
  }

  build() {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    this.ac = ac;
    this.master = ac.createGain();
    this.master.gain.value = 0;
    this.master.connect(ac.destination);

    const n = ac.sampleRate * 4;
    const brown = ac.createBuffer(1, n, ac.sampleRate);
    const white = ac.createBuffer(1, n, ac.sampleRate);
    const bd = brown.getChannelData(0), wd = white.getChannelData(0);
    let last = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      wd[i] = w;
      last = (last + 0.02 * w) / 1.02;
      bd[i] = last * 3.5;
    }
    const loop = (buf) => {
      const s = ac.createBufferSource();
      s.buffer = buf;
      s.loop = true;
      s.start();
      return s;
    };

    this.pan = ac.createStereoPanner ? ac.createStereoPanner() : ac.createGain();
    this.pan.connect(this.master);

    // Low rumble of the train
    this.rumbleF = ac.createBiquadFilter();
    this.rumbleF.type = 'lowpass';
    this.rumbleF.frequency.value = 120;
    this.rumbleG = ac.createGain();
    this.rumbleG.gain.value = 0;
    loop(brown).connect(this.rumbleF).connect(this.rumbleG).connect(this.pan);

    // Wheel/air hiss
    this.hissF = ac.createBiquadFilter();
    this.hissF.type = 'bandpass';
    this.hissF.frequency.value = 900;
    this.hissF.Q.value = 0.6;
    this.hissG = ac.createGain();
    this.hissG.gain.value = 0;
    loop(white).connect(this.hissF).connect(this.hissG).connect(this.pan);

    // The famous BART brake squeal: a few inharmonic partials with wobble.
    this.squealG = ac.createGain();
    this.squealG.gain.value = 0;
    this.squealG.connect(this.pan);
    this.squealOsc = [2870, 3420, 4390, 6150].map((f, i) => {
      const o = ac.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const g = ac.createGain();
      g.gain.value = [0.5, 0.35, 0.25, 0.1][i];
      o.connect(g).connect(this.squealG);
      o.start();
      return o;
    });

    // Station ambience: HVAC hum
    const ambF = ac.createBiquadFilter();
    ambF.type = 'lowpass';
    ambF.frequency.value = 260;
    const ambG = ac.createGain();
    ambG.gain.value = 0.05;
    loop(brown).connect(ambF).connect(ambG).connect(this.master);
  }

  update({ speed, near, braking, pan }) {
    if (!this.ac || !this.on) return;
    const t = this.ac.currentTime;
    const v = Math.min(1, Math.abs(speed) / 70);
    this.rumbleG.gain.setTargetAtTime(near * (0.08 + 0.9 * v) * 0.7, t, 0.08);
    this.rumbleF.frequency.setTargetAtTime(70 + v * 260, t, 0.1);
    this.hissG.gain.setTargetAtTime(near * Math.pow(v, 1.4) * 0.35, t, 0.08);
    this.hissF.frequency.setTargetAtTime(500 + v * 1400, t, 0.1);
    const band = Math.exp(-Math.pow((Math.abs(speed) - 22) / 14, 2));
    const sq = braking * near * band * 0.05 * (0.6 + 0.4 * Math.sin(t * 7.3) * Math.sin(t * 2.1));
    this.squealG.gain.setTargetAtTime(Math.max(0, sq), t, 0.05);
    this.squealOsc.forEach((o, i) => o.frequency.setTargetAtTime(o.frequency.value * (1 + Math.sin(t * (3 + i)) * 0.0015), t, 0.05));
    if (this.pan.pan) this.pan.pan.setTargetAtTime(pan, t, 0.1);
  }

  // Door chime: three descending tones.
  chime() {
    if (!this.ac || !this.on) return;
    const ac = this.ac, t0 = ac.currentTime + 0.02;
    [988, 831, 659].forEach((f, i) => {
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      const t = t0 + i * 0.22;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.12, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
      o.connect(g).connect(this.master);
      o.start(t);
      o.stop(t + 0.75);
    });
  }
}
