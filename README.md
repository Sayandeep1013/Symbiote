# Symbiote

An interactive WebGL organism: a floating, wet-black, symbiote-like creature
that lives in the middle of the page and reacts to your cursor. It reaches
for it, wraps around it and lets go, without ever being steered like a
joystick.

![The creature at rest](docs/images/creature.png)

## Running it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build into dist/
```

Move the cursor near the creature. Its long arms sniff toward the cursor, then
grab it and coil their tips around it. Thin strings stretch out from the body.
A fast flick of the mouse makes the shy arms flinch away.

## What it's made of

| Look | How it's built |
| --- | --- |
| One fused, organic mass | The body, trunk roots, forks and merges are one implicit surface (a density field plus marching cubes), so strands that touch fuse with smooth fillets |
| Arms that split, one into many | 11 thick trunks fork into 26 thinner arms |
| Arms that merge, many into one | 9 trunks merge into a neighbour, and about half braid apart again further out |
| Mixed lengths, mostly short | 7 long reachers, 12 medium arms and 15 short buds |
| Fully 3D | Arms leave the body in every direction, toward and away from the viewer too |
| Fine, hair-like tips | Instanced GPU tubes, bent along simulated spines in the vertex shader |
| Wet black gloss with streak highlights | `MeshPhysicalMaterial` (black, clearcoat) lit only by an environment map built from thin light strips |
| Webbing with holes | Noise-perforated membranes between neighbouring arms and inside forks |

![Branching arm close-up](docs/images/branching.png)

### Behaviour

The arms move as springs that follow their target, so they lag behind and
whip. When the cursor comes within reach, the boldest long arms sniff toward
it, then grab it with irregular, tilted coils. Spikes on the body stretch thin
strings out to it. If the cursor moves fast, the shy arms flinch away. When the
cursor leaves, they let go and wait out a cooldown before reaching again.

![Reaching for and coiling around the cursor (red dot)](docs/images/grab.png)

### Performance

The fused surface costs about 20 ms per rebuild, so it runs in a Web Worker
and the main thread only uploads the triangles that changed. The page runs at
about 100+ fps in Chromium. The creature's random layout is seeded, so it
looks the same on every load.

## Layout

```
src/
  main.js                  renderer, camera, materials, cursor, frame loop
  style.css
  creature/
    rig.js                 tendril topology + simulation (forks, merges, grabs)
    tubes.js               instanced tube geometry bent along spines
    mass.js                drives the fused implicit surface
    massWorker.js          field stamping + marching cubes (Web Worker)
    massConfig.js          shared field settings
    webbing.js             holed membranes between arms
    shell.js               perforated film around the body
    env.js                 strip-light studio environment
    stage.js               misty floor
    noise.js               shared GLSL simplex noise
docs/
  SYMBIOTE_INTERACTIVE_WEBGL_SPEC.md   creative direction + spec
scripts/                   Playwright screenshot / fps helpers
```

## Target vs. current

The mockup on the left is the target; the right is a render from this build.

![Mockup vs. current render](docs/images/vs-mockup.png)

Still to do: a splashier, less ball-like core, fine splatter droplets, and the
page UI from the mockup.

Built with [three.js](https://threejs.org/) and [Vite](https://vitejs.dev/).
