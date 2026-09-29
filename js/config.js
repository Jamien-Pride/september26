// Everything you might want to tweak lives here.

export const CONFIG = {
  station: 'Embarcadero',
  destination: 'SFO Airport',
  line: 'Yellow',
  cars: 8,

  // Timing (seconds). Real BART dwells are longer; these are tuned for a landing page.
  firstTrainDelay: 1.6,
  headway: 5,          // empty platform between trains
  arrivalTime: 6.5,    // from nose entering frame to full stop
  doorOpenDelay: 0.9,
  dwell: 6,
  expressSpeed: 115,   // ft/s for a non-stopping train (~78 mph, heavily exaggerated)

  // Posters on the far wall. These are the obvious place for portfolio projects later.
  posters: [
    { kicker: '01', title: 'Project One', hue: 12 },
    { kicker: '02', title: 'Project Two', hue: 205 },
    { kicker: '03', title: 'Project Three', hue: 48 },
    { kicker: '04', title: 'Project Four', hue: 280 },
    { kicker: '05', title: 'Project Five', hue: 160 },
    { kicker: '06', title: 'Project Six', hue: 330 },
  ],
};

// Scene geometry in feet. Camera stands on the platform looking straight across the tracks.
export const GEO = {
  eye: 5.0,            // eye height above platform
  zTrain: 11,          // distance to the near side of the train
  edgeGap: 0.3,        // platform edge sits this much closer than the train side
  carWidth: 10.5,
  zWall: 24,           // far trackside wall
  trackDrop: 3.5,      // top of rail sits this far below the platform
  ceiling: 14.2,
  railZ: [15.1, 20.6], // BART's broad 5'6" gauge
  thirdRailZ: 22.3,
  yellowWidth: 2,
  graniteWidth: 0.5,

  // Virtual framing: the scene is laid out for a 1000-unit-tall viewport.
  virtualH: 1000,
  horizon: 420,        // screen y of eye level in virtual units
  pxPerFtAtTrain: 66.7,
};
