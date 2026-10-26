# Symbiote

**An interactive WebGL organism.** A floating, wet-black, symbiote-like
creature lives in the middle of a dark page and reacts to your cursor. It
watches the cursor, reaches for it, coils around it and lets go. The cursor
disturbs its life rather than steering it like a joystick.

![The creature at rest](docs/images/creature.png)

Built with [three.js](https://threejs.org/) and [Vite](https://vitejs.dev/).
There's no backend and no build-time assets: everything is generated in code at runtime.

---

## Contents

- [Quick start](#quick-start)
- [Interacting with it](#interacting-with-it)
- [How it looks the way it does](#how-it-looks-the-way-it-does)
- [How it behaves](#how-it-behaves)
- [Architecture](#architecture)
- [Performance](#performance)
- [Project layout](#project-layout)
- [Target vs. current](#target-vs-current)
- [Roadmap](#roadmap)

## Quick start

Requires Node.js 18+ and a browser with WebGL 2.

```bash
npm install
npm run dev        # http://localhost:5199
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server with hot reload on **http://localhost:5199** |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serves the production build on http://localhost:5199 |

The port is fixed at 5199 with `strictPort` (see `vite.config.js`). If another
project is already using it, Vite stops with an error instead of quietly
moving to another port, so you never end up looking at the wrong app.

## Interacting with it

| You do | The creature does |
| --- | --- |
| Leave the cursor alone | Breathes, drifts and slowly turns. Its arms sway on their own |
| Move the cursor near it | The long arms turn and *sniff* toward the cursor |
| Hold the cursor within reach | The bold arms grab it and coil their tips around it, and thin strings stretch out to it from the body |
| Drag the held cursor around | The arms follow with lag and whip, like springs |
| Flick the mouse fast | The shy arms flinch back |
| Move the cursor away or off the page | The arms let go, recoil, and wait a moment before reaching again |

![Reaching for and coiling around the cursor (red dot)](docs/images/grab.png)

## How it looks the way it does

| Look | Technique |
| --- | --- |
| **One fused, organic mass** | The body, trunk roots, forks and merges are one implicit surface: a density field polygonized with marching cubes. Strands that come close fuse with smooth fillets instead of crossing with hard creases |
| **One arm splits into many** | 11 thick trunks fork into 26 thinner arms |
| **Many arms merge into one** | 9 trunks merge into a neighbour, and about half braid apart again further out |
| **Mixed lengths, mostly short** | Power-law length classes: 7 long reachers, 12 medium arms and 15 short buds |
| **Fully 3D** | Arms leave the body in every direction, including toward and away from the viewer |
| **Fine, hair-like tips** | Instanced GPU tubes, bent along simulated spines in the vertex shader. They taper out of the fused mass |
| **Wet black gloss, streaked highlights** | `MeshPhysicalMaterial` (black, clearcoat 1, slight iridescence) lit **only** by a PMREM environment built from thin emissive light strips. Highlights come out as long streaks rather than dots |
| **Holed webbing** | Noise-perforated membranes between neighbouring arms and in fork crotches |
| **Cinematic stage** | A misty floor lit from above, under a dark radial background |

![Branching arm close-up](docs/images/branching.png)

The random layout is seeded (mulberry32), so the creature has the same
art-directed shape on every load.

## How it behaves

- **Idle life:** each arm bends with two-axis curvature waves at its own frequency and speed, so no two arms move in sync.
- **Spring follow:** every spine point is a second-order spring chasing its target. Tips are looser than roots, which gives the arms lag, overshoot and whip.
- **Interest:** reachers are ranked by how directly they face the cursor and whether they can reach it. Each arm has a *boldness* that sets how quickly it commits and whether it flinches when the cursor moves fast.
- **Grab:** a grabbing arm follows a curve from its root toward the cursor. Its last stretch wraps into an irregular, tilted coil, so no two coils are perfect circles.
- **Release:** if the cursor stays out of reach, the arms let go and wait out a cooldown, so they don't chase it endlessly.

## Architecture

```
pointer ──► cursor (raycast onto the creature's plane, smoothed speed)
               │
               ▼
          rig.update()            CPU: tendril simulation (springs, waves, grabs)
               │ spine points + normals
      ┌────────┴──────────┐
      ▼                   ▼
 tubes / webbing      mass.update()  ──postMessage──► massWorker
 (GPU: spines in       (packs thick                  (stamps the density field,
  float textures,       segments)                     runs marching cubes)
  vertex shader)                  ◄──transferable buffers── triangles
      │                   │
      └────────┬──────────┘
               ▼
        three.js render (PMREM strip-light environment, ACES tone mapping)
```

## Performance

- Building the fused surface (stamping the field plus marching cubes) takes about 20 ms, so it runs in a **Web Worker**. Only one job is in flight at a time, the buffers are transferred rather than copied, and the main thread uploads only the triangles that were produced.
- All tubes are drawn as **one instanced mesh**, and the shape of every tendril is read from float textures.
- Measured at about **100–120 fps** in Chromium, with no difference between idle and grabbing.

## Project layout

```
index.html                 canvas + module entry
vite.config.js             fixed dev/preview port (5199)
src/
  main.js                  renderer, camera, materials, cursor, frame loop
  style.css                page background
  creature/
    rig.js                 tendril topology + simulation (lengths, forks, merges, grabs)
    tubes.js               instanced tube geometry bent along spines
    mass.js                drives the fused implicit surface
    massWorker.js          field stamping + marching cubes (Web Worker)
    massConfig.js          field settings shared with the worker
    webbing.js             holed membranes between arms
    shell.js               perforated film around the body
    env.js                 strip-light studio environment (PMREM)
    stage.js               misty floor
    noise.js               shared GLSL simplex noise
docs/
  SYMBIOTE_INTERACTIVE_WEBGL_SPEC.md   creative direction + technical spec
  images/                  README renders
mockup references/         visual target
scripts/
  screenshot.mjs           Playwright screenshot helper
  fps-check.mjs            Playwright frame-rate probe
```

## Target vs. current

On the left is the mockup this project is aiming for. On the right is a render
of the current build.

![Mockup vs. current render](docs/images/vs-mockup.png)

## Roadmap

- [x] Wet-black material with streaked reflections
- [x] Fine tapering tendrils and holed webbing
- [x] Cursor sniff, grab, coil, flinch and release
- [x] Mixed tendril lengths and a fully 3D layout
- [x] Organic topology: forks, merges and braids fused into one mass
- [ ] Splashier, less ball-like core
- [ ] Fine splatter droplets
- [ ] Page UI from the mockup (nav, "It's alive." copy, reactivity meter, status bar)
- [ ] Touch tuning and a reduced-motion mode

See [the spec](docs/SYMBIOTE_INTERACTIVE_WEBGL_SPEC.md) for the full creative
direction.
