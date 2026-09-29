# september26

Portfolio front page: a straight-on view across a BART platform as a Fleet of the Future train pulls in, stops, and opens its doors.

## Run it

It's plain ES modules with no build step, but modules need to be served over HTTP:

```sh
npx http-server -c-1 .     # or: python3 -m http.server
```

Then open http://localhost:8080.

## Controls

| Input | Action |
| --- | --- |
| Click / `Space` | Call a train early, or close the doors while it's berthed |
| `X` | Send a non-stopping "Not in service" train through at speed |
| `M` | Toggle sound (synthesised with Web Audio, off by default) |
| Mouse | Parallax. The camera shifts slightly, with real per-depth perspective |

## How it's built

Everything is drawn procedurally on a `<canvas>`. No photos or image assets are used.

- **`js/camera.js`**: a pinhole camera in feet. Every surface is placed at a real depth: the train side at 11 ft, the far wall at 24 ft, the tactile strip at 8–10 ft. Perspective, parallax and reflections fall out of that.
- **`js/station.js`**: static layers (ceiling, far wall, trackbed, platform) are rendered once per resize. Parallax is applied exactly: vertical planes translate, and horizontal planes skew about the horizon.
- **`js/train.js`**: cars, livery, sliding doors, and an interior drawn in true perspective with seats, riders and stanchions. Glass and paint reflections stay fixed in screen space while the train slides under them, the way real reflections do.
- **`js/main.js`**: the arrival/dwell/departure state machine, a two-pass motion blur, the mirrored floor reflection, and headlight effects.
- **`js/config.js`**: station name, destination, car count, timings, and poster placeholders.

The font is [Hind](https://fonts.google.com/specimen/Hind) (SIL Open Font License), self-hosted in `fonts/`.
