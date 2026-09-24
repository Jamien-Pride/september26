# Cityside Park installation: sun-accurate site visualization

An interactive, physically based 3D model of the proposed rainbow-and-mirror funnel sculpture
at Cityside Park, Treasure Island, placed at its real location. You can move the sun through
any day of the year and watch the light, reflections and shadows change.

Open `index.html` through any static web server, for example
`python3 -m http.server` and then `http://localhost:8000`. WebGL 2 is required. The page has no
build step and no network dependencies other than Google Fonts.

## What is modelled, and how accurately

| Element | Source / method | Accuracy |
|---|---|---|
| Sun position | NOAA solar position algorithm with atmospheric refraction, for 37.81958° N, 122.37321° W, Pacific time with DST | ≈0.01° |
| Moon | Low-precision Meeus series; phase comes from the real Sun–Moon geometry | ≈0.3° |
| Sunlight colour | Kasten–Young air mass with Rayleigh, aerosol and ozone optical depth | Physically based |
| Terrain: Yerba Buena Island, SF hills, Marin, East Bay, Angel Island, Alcatraz | USGS 3DEP / SRTM via AWS Terrarium tiles: 4 m grid near the site, 50 m grid out to 20 km | DEM resolution |
| Treasure Island west seawall bearing | Measured from the DEM: 332.4° / 152.4° | ±0.5° |
| Park layout | Traced from the proposal's landscape plan at ≈0.25 m per plan pixel, then rotated onto the real seawall | Plan fidelity. The as-built Phase 1 park may differ. |
| Sculpture | Proposal dimensions: 18 ft mouth, 14 ft height, 7 ft throat with its top at 6.5 ft, 8 ft depth, 10 × 20 ft pad. 32 panels alternating paint and stainless; colours sampled from the rendering. | Exact to the drawings |
| Bay Bridge West Span | W1 bent at 37.7897, −122.3874, axis 40.7°, spans 354 / 704 / 354 m ×2. The Yerba Buena end lands within ~20 m of its published position. | ±50 m |
| Bay Lights | North-facing LEDs on the vertical suspenders (relit March 2026), generative pattern | Pattern is illustrative |
| SF skyline | 28 named towers at their real coordinates and heights; generated fabric elsewhere | Named towers ±50 m |
| Golden Gate Bridge, SAS tower, Oakland cranes | Real positions, simplified geometry | Silhouette level |

### Rendering

- **Stainless panels:** mirror (#8), brushed (#4, anisotropic) or bead-blast. Reflections between
  the panels inside the funnel are ray-traced analytically against the true oblique-cone surface,
  with up to four bounces, including sun shadowing inside the funnel. Everything else reflected
  comes from a live cube map captured at the sculpture.
- **Painted panels:** gloss urethane, candy metallic or satin powder coat, each with a clear coat.
- **Reflected sunlight:** about 180k sun rays (0.53° solar disk plus finish roughness) are traced
  off the stainless panels and binned on the ground and at head height (1.7 m). The ground map is
  drawn into the scene as real extra light, so reflected patches appear on the pad and lawn.
  Turn on the heat map in *Reflected sunlight* to see it.
- **Bay water:** a planar mirror reflection distorted by wind-driven normals, Fresnel reflectance
  for water (F0 = 0.02), a GGX sun-glitter lobe that widens with distance, murky green-grey body
  colour, and an adjustable tide.
- **Sky:** Preetham daylight model with clouds. At night: skyglow from SF and Oakland, stars and
  the moon.
- **Atmosphere:** exponential-height aerial perspective with a 1.2 km scale height, plus an
  optional marine layer (fog).
- **Lighting and exposure:** exposure meters like a camera reading an 18% grey card, with a cap
  so dusk and night still look dark.

## Reflected-sunlight findings (mouth facing 229°, mirror finish)

These results come from sweeping the model across the solstices and equinoxes. 1.0× means as
bright as direct sun.

| Date | Worst moment | Sun | Peak at head height | Area above 1× at head height |
|---|---|---|---|---|
| Mar 20 | 7:00 PM | 268°, 3.6° up | 1.5× | 0.3 m² |
| Jun 21 | 8:20 PM | 299°, 2.0° up | 1.5× | 0.5 m² |
| Sep 23 | 6:40 PM | 266°, 4.2° up | 1.5× | 0.3 m² |
| Dec 21 | 4:40 PM | 238°, 1.9° up | **2.1×** | 0.7 m² |

Ground patches stay below 1× all year. The concave funnel therefore makes glare rather than a
burn hazard. The worst case is a low winter sun shining straight into the mouth.

## Controls

- **Orbit mode:** drag to orbit, scroll or pinch to zoom.
- **Walk mode:** drag to look. Use W A S D or the arrow keys to move, and hold Shift to jog. Touch
  screens get an on-screen joystick. You can walk through the 7 ft throat.
- **Time strip:** drag to move the sun. The chips jump to dawn, sunrise, solar noon, golden hour,
  sunset, blue hour and night.
- **Sculpture:** set which way the mouth faces, and choose the paint and steel finishes and the
  uplights.
- **Conditions:** haze, clouds, marine layer, wind and tide.
- **Lens:** 16–85 mm full-frame equivalents, for matching site photographs.

Debug URL parameters: `?q=low|medium|high`, `?tm=agx|aces` (tone mapping), `?ev=1.2`
(exposure bias).

## Layout

```
index.html        UI and styles
js/main.js        renderer, camera, sun/exposure, render loop
js/sun.js         solar & lunar ephemeris, Pacific time helpers
js/sculpture.js   geometry, materials, analytic cone ray tracing
js/caustics.js    reflected-sunlight solver
js/park.js        Cityside Park layout, ground shader, riprap, furniture, buildings
js/vegetation.js  coast live oaks, palms, native planting, Yerba Buena woodland
js/grass.js       instanced lawn blades
js/water.js       Bay water
js/sky.js         daylight sky, night sky, moon
js/atmosphere.js  aerial perspective and marine layer
js/bridge.js      Bay Bridge West Span, Bay Lights, Golden Gate
js/city.js        San Francisco / Oakland skyline
js/terrain.js     DEM loading, land cover, terrain meshes
data/             DEM grids in the site's local metre frame
vendor/three/     three.js r186 (MIT)
```
