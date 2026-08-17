# Symbiote — Interactive WebGL Organism

## Comprehensive Project Specification, Creative Direction & Technical Architecture

> **Project status:** Concept / pre-production  
> **Primary goal:** Build a frontend-only interactive digital-art
> website centered around a floating, glossy black symbiote-like
> organism that behaves as though it is alive and reacts to the user’s
> cursor.

------------------------------------------------------------------------

## 1. Executive Summary

This project is **not** intended to be a Venom character website, a
conventional 3D landing page, or a looping animation.

The intended experience is an **interactive digital organism**:

> A floating symbiote exists in the center of a dark cinematic webpage.
> It continuously exhibits autonomous movement, subtly breathes and
> deforms, watches the user’s cursor, and reacts to the user’s presence
> as though the cursor is an external stimulus.

The user should feel:

> **“There is something alive on this page, and it noticed me.”**

The website UI should support that illusion rather than compete with it.

The creature should be inspired by the visual language of the supplied
reference — glossy black biological material, wet highlights, irregular
tendrils, stretched organic forms, and dark cinematic lighting — while
remaining an original symbiote-like organism rather than a direct
recreation of Venom.

------------------------------------------------------------------------

# 2. Core Creative Direction

## 2.1 The central idea

The project should be treated as a **digital-art experiment whose
subject happens to be a symbiote**.

The most important design principle is:

> **The cursor should perturb the organism’s life, not control it like a
> joystick.**

This distinction is critical.

A weak implementation would make every tentacle point at the cursor.

A stronger implementation makes the organism have its own behavior:

- some tendrils notice the cursor strongly
- some react weakly
- some ignore it
- some continue their own idle movement
- some investigate
- some retract
- some twitch unpredictably

The creature therefore appears to have independent internal behavior.

------------------------------------------------------------------------

# 3. Visual References

## 3.1 Original supplied texture reference

The supplied image is useful primarily as a **material and silhouette
reference**:

- near-black body
- wet/specular highlights
- irregular biological edges
- short spikes and tendrils
- stretched membrane-like forms
- dark environment
- high contrast between black material and reflected light

<figure>
<img src="reference-venom-texture.png"
alt="Original symbiote texture reference" />
<figcaption aria-hidden="true">Original symbiote texture
reference</figcaption>
</figure>

## 3.2 Initial landing-page exploration

The first generated exploration was intentionally more aggressive and
scattered.

<figure>
<img src="concept-01-scattered-symbiote.png"
alt="Initial symbiote landing-page concept" />
<figcaption aria-hidden="true">Initial symbiote landing-page
concept</figcaption>
</figure>

This version established the HUD language but made the organism too
violent and spatially scattered.

It should **not** be treated as the final creature composition.

## 3.3 More contained organism

The second iteration brought the creature into a more cohesive central
mass.

<figure>
<img src="concept-02-contained-symbiote.png"
alt="Contained symbiote concept" />
<figcaption aria-hidden="true">Contained symbiote concept</figcaption>
</figure>

This established an important direction:

- one central organism
- fewer giant outward projections
- controlled silhouette
- calmer visual presence
- still enough appendages to communicate biological activity

## 3.4 Floating organism — primary visual direction

The third iteration established the current preferred composition.

<figure>
<img src="concept-03-floating-symbiote.png"
alt="Floating symbiote concept" />
<figcaption aria-hidden="true">Floating symbiote concept</figcaption>
</figure>

This is the key visual target:

- organism centered on the page
- creature visibly floating
- subtle ground/reflection below it
- dark cinematic environment
- glossy black material
- tendrils surrounding the central mass without exploding across the
  entire viewport
- minimal HUD around it

**This should be treated as the current primary visual reference.**

## 3.5 Loader / awakening storyboard

The latest exploration shows the proposed loader evolving into an
awakening sequence.

<figure>
<img src="concept-04-loader-storyboard.png"
alt="Loader sequence storyboard" />
<figcaption aria-hidden="true">Loader sequence storyboard</figcaption>
</figure>

This should be treated as a **conceptual storyboard**, not a literal UI
specification. The actual implementation should be subtler and more
seamless.

------------------------------------------------------------------------

# 4. Final Experience

The page should feel like this:

``` text
                    SYMBIOTE
                       │
                 dark environment
                       │

             ┌─────────────────────┐
             │                     │
             │      ORGANISM       │
             │        ◉            │
             │    ╱  │  ╲          │
             │  ╱    │    ╲        │
             │       │             │
             │   floating          │
             │                     │
             └─────────────────────┘

                MOVE YOUR CURSOR

             THE SYMBIOTE IS WATCHING
```

The creature is the hero.

The interface is intentionally restrained.

------------------------------------------------------------------------

# 5. What The Creature Is

The creature should be:

- a central organic mass
- roughly spherical / amoeba-like
- asymmetrical
- glossy
- almost completely black
- covered with primary and secondary tendrils
- continuously moving
- floating in space
- capable of subtle body deformation
- capable of responding to cursor position and movement

It should **not** look like:

- a humanoid Venom character
- a monster with a face
- a spider
- a conventional alien
- a rigid 3D sculpture
- a particle cloud
- a simple metaball blob

The desired feeling is:

> **wet biological matter that has learned to move.**

------------------------------------------------------------------------

# 6. Recommended Asset Strategy

## 6.1 Use a real 3D asset

For the target visual quality, the recommended approach is a **hybrid
3D/WebGL system**.

Do not attempt to generate the entire final organism procedurally from
scratch in the browser.

Instead:

1.  Art-direct the main creature as a 3D asset.
2.  Rig its primary tendrils.
3.  Export it as `.glb`.
4.  Load it into the browser with Three.js / React Three Fiber.
5.  Use runtime physics, shaders and behavior logic to make it alive.

Architecture:

``` text
                     BLENDER
                        │
                        │ .glb
                        ▼
              ┌──────────────────┐
              │  SYMBIOTE ASSET  │
              │                  │
              │ Body             │
              │ Primary tendrils │
              │ Skeleton         │
              │ Materials        │
              └────────┬─────────┘
                       │
                       ▼
               THREE.JS / R3F
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
       Physics      Behavior      Shaders
          │            │            │
          └────────────┼────────────┘
                       ▼
                     WebGL
                       │
                       ▼
                    Browser
```

------------------------------------------------------------------------

# 7. Why Not A Video?

A video can reproduce the appearance but cannot provide genuine
interaction.

A video-based approach would produce:

``` text
idle.mp4
    ↓
cursor appears
    ↓
play reaction clip
```

This is visually convincing only until the user interacts in an
unexpected way.

The desired implementation instead allows:

``` text
cursor position
cursor velocity
cursor direction
distance to creature
distance to individual tentacles
time since movement
```

to influence the simulation continuously.

That is what makes the creature feel responsive instead of pre-recorded.

------------------------------------------------------------------------

# 8. Blender Asset Plan

## 8.1 Central body

Start with an irregular organic mass.

It should not be a perfect sphere.

The silhouette should contain:

- bulges
- depressions
- membrane-like folds
- small spikes
- asymmetric regions
- smooth transitions into appendages

## 8.2 Primary tendrils

Create approximately **15–25 major tendrils**.

These should be the most important controllable appendages.

Each should be:

- curved
- tapered
- organic
- individually variable
- connected naturally to the body

## 8.3 Tentacle rig

Major tendrils should use bone chains.

Example:

``` text
BODY
 │
 ●  bone 1
  \
   ●  bone 2
    \
     ●  bone 3
      \
       ●  bone 4
        \
         ●  TIP
```

Approximately 5–10 bones per major tentacle is a reasonable starting
point.

## 8.4 Secondary appendages

Do not individually rig hundreds of tiny protrusions.

Use a hybrid system:

- 15–25 major tendrils → actual geometry + rig/physics
- small spikes and micro appendages → shader/procedural deformation
  where possible

This provides visual richness without making the runtime simulation
unnecessarily expensive.

------------------------------------------------------------------------

# 9. Tentacle Generation Strategy

A useful optimization is to create a small number of excellent base
tentacle forms and vary them procedurally.

Each generated/placed tentacle can have parameters such as:

``` text
length
radius
curl
rotation
phase
speed
attention
curiosity
restlessness
```

Example:

``` text
Tentacle #01
attention = 0.90
speed = 0.70
curiosity = 0.80
restlessness = 0.30

Tentacle #02
attention = 0.20
speed = 1.40
curiosity = 0.10
restlessness = 0.80
```

This creates variation without manually animating every appendage.

------------------------------------------------------------------------

# 10. Runtime Animation Philosophy

The creature should never be completely still.

It needs a continuous baseline of autonomous movement.

Possible idle layers:

``` text
slow body breathing
+
very slow floating
+
micro surface noise
+
independent tentacle motion
+
small random twitches
+
occasional subtle contraction
```

The important property is **low amplitude**.

The organism should not look like it is constantly attacking.

------------------------------------------------------------------------

# 11. Floating System

The creature should visibly float.

The floating motion should be extremely slow and organic.

Conceptually:

``` text
Y = baseY
  + slowSine
  + breathing
  + lowFrequencyNoise
  + reactionOffset
```

Do not use a simple:

``` text
UP
DOWN
UP
DOWN
```

motion.

Layer multiple frequencies so the movement feels organic and almost
imperceptible.

The ground below can contain an extremely subtle reflection/shadow to
communicate that the creature is suspended above it.

------------------------------------------------------------------------

# 12. Tentacle Physics

Major tendrils should use spring/damped-chain behavior.

Conceptually:

``` text
Target
  ↓
 [●]
  │
  │ spring
  ▼
 [●]
  │
  ▼
 [●]
  │
  ▼
 TIP
```

When the target moves:

- the base remains connected to the body
- the rest of the chain follows with inertia
- the tip lags
- the chain overshoots slightly
- damping brings it back to equilibrium

This gives the characteristic organic delay.

The goal is not physically perfect simulation.

The goal is **convincing secondary motion**.

------------------------------------------------------------------------

# 13. Cursor Interaction Model

The pointer system should collect more than X/Y coordinates.

Track:

``` text
cursor.position
cursor.velocity
cursor.acceleration
cursor.direction
cursor.distanceFromCreature
cursor.distanceFromEachTentacle
cursor.timeSinceMovement
cursor.timeSinceEnter
cursor.isInsideInfluenceZone
cursor.isPressed
```

These values become inputs to the organism’s behavior.

------------------------------------------------------------------------

# 14. Interaction Zones

Use several invisible influence zones.

## Zone 0 — Outside

Distance \> approximately 600px.

Behavior:

- calm
- mostly autonomous
- no obvious cursor response

## Zone 1 — Awareness

Approximately 400–600px.

Behavior:

- one or two tendrils subtly orient toward the cursor
- extremely weak response

The user should almost wonder if they caused it.

## Zone 2 — Curiosity

Approximately 200–400px.

Behavior:

- more tendrils begin reacting
- body movement becomes slightly more active
- surface deformation increases

## Zone 3 — Attention

Approximately 50–200px.

Behavior:

- creature clearly watches cursor
- selected tendrils investigate it
- some tendrils orient toward it
- body becomes slightly more active

## Zone 4 — Contact

Approximately \<50px.

Behavior:

- localized body deformation
- tendril recoil or approach
- small surface ripple
- stronger reaction

These values are starting points, not fixed requirements.

------------------------------------------------------------------------

# 15. Cursor Velocity Is A First-Class Signal

The organism should react differently to slow and fast cursor movement.

### Slow movement

``` text
cursor → → → → →

Creature:
calmly follows
```

### Fast movement

``` text
cursor ───────────────→

Creature:
tendrils lag
body reacts
appendages whip slightly
then settle
```

This is important because it makes the creature react to **how the user
behaves**, not merely where the cursor is.

------------------------------------------------------------------------

# 16. Not Every Tentacle Should Follow The Cursor

This is one of the most important design rules.

Do not do:

``` text
every tentacle → cursor
```

Instead:

``` text
3 tendrils  → strong response
4 tendrils  → weak response
8 tendrils  → mostly independent
5 tendrils  → autonomous idle behavior
```

The exact numbers can change.

The principle should remain.

The user should perceive an organism with internal behavior.

------------------------------------------------------------------------

# 17. Symbiote Behavior State Machine

The creature can use a lightweight state machine rather than an AI
model.

``` text
                     ┌──────────────┐
                     │     IDLE     │
                     └──────┬───────┘
                            │
                     cursor enters
                            │
                            ▼
                     ┌──────────────┐
                     │    AWARE     │
                     └──────┬───────┘
                            │
                     cursor gets closer
                            │
                            ▼
                     ┌──────────────┐
                     │   CURIOUS    │
                     └──────┬───────┘
                            │
                      cursor touches
                            │
                            ▼
                     ┌──────────────┐
                     │   REACTIVE   │
                     └──────┬───────┘
                            │
                       cursor leaves
                            │
                            ▼
                     ┌──────────────┐
                     │   RECOVER    │
                     └──────┬───────┘
                            │
                            ▼
                           IDLE
```

Transitions should be interpolated rather than instantaneous.

------------------------------------------------------------------------

# 18. Body-Level Reactions

Cursor attention should influence the entire organism, not just the
tentacles.

Example conceptual parameters:

| State     |   Body Scale |      Float | Tentacle Activity | Surface Motion |
|-----------|-------------:|-----------:|------------------:|---------------:|
| Idle      |         1.00 |        Low |               Low |            Low |
| Aware     |         1.01 |       Low+ |              Low+ |           Low+ |
| Curious   |         1.02 |     Medium |            Medium |         Medium |
| Attention |         1.04 |    Medium+ |              High |           High |
| Contact   |         1.05 |       High |              High |           High |
| Recover   | interpolated | decreasing |        decreasing |     decreasing |

The exact values should be tuned visually.

------------------------------------------------------------------------

# 19. Shader System

The body should use custom GLSL shaders for the fine-grained material
and deformation.

Conceptual pipeline:

``` text
Base mesh
   ↓
Noise displacement
   ↓
Breathing deformation
   ↓
Cursor-local deformation
   ↓
Surface normal distortion
   ↓
Specular / reflection
   ↓
Post processing
   ↓
Final image
```

A cursor position can be passed into the shader as a uniform.

This allows local deformation around the cursor without changing the
underlying mesh topology.

------------------------------------------------------------------------

# 20. Material Design

The material should feel like:

- wet oil
- liquid latex
- black slime
- biological membrane

It should **not** look like:

- chrome
- plastic
- ordinary rubber
- matte black clay

The majority of the object should remain nearly black.

The visual information should come from controlled highlights.

Conceptually:

``` text
██████████████████████
██████████████████████
██████████░███████████
██████████████████████
███████░██████████████
██████████████████████
```

The eye discovers the form through reflections.

------------------------------------------------------------------------

# 21. Lighting

Use very controlled lighting.

### Key light

Soft side/overhead light.

### Rim light

Very subtle white/blue edge highlight.

### Fill

Almost nothing.

### Environment

Very dark environment/HDRI.

### Ground

Subtle reflective surface.

### Fog

Low-density atmospheric fog.

The lighting should reveal the creature without making it bright.

------------------------------------------------------------------------

# 22. Camera

The camera should remain relatively stable.

Potential behavior:

- subtle breathing-scale camera response
- tiny parallax
- very small reaction to strong cursor movement
- optional slow cinematic drift

Avoid aggressive camera movement.

The user should feel that **the creature moves**, not that the camera is
constantly moving around it.

------------------------------------------------------------------------

# 23. Page UI

The current preferred layout is based on the floating concept.

Potential elements:

### Top-left

``` text
SYMBIOTE
```

### Top-center

``` text
MOVE YOUR CURSOR
```

### Top-right

``` text
ABOUT    BEHAVIOR    EXPERIMENT
```

### Left

``` text
IT'S
ALIVE.

A digital symbiote that
reacts to your presence.
It watches. It listens.
It remembers.
```

### Right

``` text
REACTIVITY
●
●
●
●
●
```

### Bottom-left

``` text
● ───── IDLE
```

### Bottom-center

``` text
THE SYMBIOTE IS WATCHING
```

### Bottom-right

``` text
INTERACT ●
```

The exact copy is not final.

The UI exists to reinforce the experiment, not dominate it.

------------------------------------------------------------------------

# 24. UI Behavior

The UI should itself be somewhat alive.

During high creature activity:

``` text
UI opacity ↓
background darkness ↑
vignette ↑
subtle glow ↑
```

When the user is idle:

``` text
UI returns to calm state
```

The UI should never become visually noisy.

------------------------------------------------------------------------

# 25. Symbiote Awakening Loader

## 25.1 Purpose

The project should not use a generic:

``` text
Loading...
██████████░░░░
```

loader.

Instead, loading is presented as the organism **waking up**.

The loader should feel like the beginning of the experience.

------------------------------------------------------------------------

# 26. Loader Concept

The loader has three major conceptual stages:

``` text
IDENTIFICATION
       ↓
EMERGENCE
       ↓
AWAKENING
       ↓
INTERACTIVE PAGE
```

## Stage 01 — Identification

A custom title/logo treatment appears against darkness.

``` text
S Y M B I O T E
```

The title should be an image/SVG texture rather than relying on a random
system font.

The title treatment can contain:

- custom typography
- color
- texture
- distortion
- subtle highlights

## Stage 02 — Emergence

Black symbiote material begins appearing around the title.

Tendrils:

- creep into the frame
- distort the title
- overlap letters
- stretch around the logo

## Stage 03 — Consumption / Formation

The organism gradually overtakes the title.

The title can:

- distort
- dissolve
- become occluded
- merge visually with the creature

## Stage 04 — Awakening

The central mass forms.

Primary tendrils emerge.

The organism starts floating.

Its idle animation begins.

## Stage 05 — Ready

The title disappears or becomes secondary.

``` text
MOVE YOUR CURSOR
```

appears.

The interactive scene is now ready.

------------------------------------------------------------------------

# 27. Loader Should Use Real Asset Readiness

Avoid fake timers.

Do not rely on:

``` js
setTimeout(() => {
  showWebsite();
}, 3000);
```

Instead, use actual initialization state:

``` text
APP BOOT
   │
   ├── Load GLB
   ├── Load textures
   ├── Compile shaders
   ├── Initialize environment
   ├── Initialize physics
   ├── Initialize behavior
   └── Render stable first frame
             │
             ▼
          REVEAL
```

The loader animation can be time-aware, but the final transition should
wait for actual readiness.

If assets load extremely quickly, the sequence should still feel
intentional rather than flashing past instantly.

------------------------------------------------------------------------

# 28. Title Asset Strategy

The title treatment should preferably be:

### Option A — SVG

Best for:

- crisp scaling
- masks
- distortion
- goo effects
- procedural animation

### Option B — Transparent PNG

Useful if the title artwork is highly complex.

### Option C — WebGL texture

Best for advanced integration.

The title can then be:

- distorted
- dissolved
- masked
- covered by procedural goo
- transitioned into the creature

A WebGL texture is the long-term preferred option if the loader becomes
highly integrated with the 3D scene.

------------------------------------------------------------------------

# 29. Seamless Loader-to-Creature Transition

The ideal implementation is:

``` text
Loader
   │
   │ same WebGL scene
   ▼
Title
   │
   ▼
Goo appears
   │
   ▼
Goo forms creature
   │
   ▼
Creature begins floating
   │
   ▼
HUD fades in
   │
   ▼
Interactive state
```

Avoid a hard:

``` text
loader screen
       CUT
homepage
```

The transition should feel like one continuous scene.

------------------------------------------------------------------------

# 30. Technical Stack

## Frontend

- React
- Vite
- TypeScript

## 3D

- Three.js
- React Three Fiber
- Drei

## Shaders

- GLSL
- custom ShaderMaterial

## Physics

Initially custom spring/damped-chain physics.

A full physics engine is not required for the first implementation.

## Asset Creation

- Blender
- GLB export

## Optional post-processing

- Effect Composer
- very subtle bloom
- vignette
- film grain
- extremely restrained chromatic aberration

## Optional audio

Web Audio can later provide:

- low ambient hum
- subtle creature breathing
- reactive low-frequency pulses
- click/startle sounds

Audio should be optional and muted by default if introduced.

------------------------------------------------------------------------

# 31. Suggested Runtime Architecture

``` text
src/
│
├── experience/
│   ├── Symbiote.tsx
│   ├── SymbioteBody.tsx
│   ├── TentacleSystem.ts
│   ├── SymbioteBehavior.ts
│   ├── CursorField.ts
│   └── FloatingMotion.ts
│
├── shaders/
│   ├── symbiote.vert
│   ├── symbiote.frag
│   ├── tentacle.vert
│   └── tentacle.frag
│
├── physics/
│   ├── SpringChain.ts
│   └── AttractionField.ts
│
├── interaction/
│   ├── PointerTracker.ts
│   └── InteractionState.ts
│
├── loader/
│   ├── AwakeningLoader.tsx
│   ├── TitleTreatment.tsx
│   └── LoadingState.ts
│
├── ui/
│   ├── HUD.tsx
│   ├── Status.tsx
│   └── Navigation.tsx
│
└── App.tsx
```

------------------------------------------------------------------------

# 32. Frame Loop

Conceptually:

``` text
every frame
    │
    ├── Read cursor
    │
    ├── Calculate cursor velocity
    │
    ├── Calculate distance to creature
    │
    ├── Update organism state
    │
    ├── Calculate tentacle targets
    │
    ├── Run spring physics
    │
    ├── Update body deformation
    │
    ├── Update shader uniforms
    │
    ├── Update floating motion
    │
    └── Render
```

This should be optimized to avoid unnecessary React state updates on
every frame.

High-frequency animation data should live in refs / animation state
rather than triggering React re-renders.

------------------------------------------------------------------------

# 33. Performance Strategy

Do not simulate every visual detail individually.

### GPU

Handle:

- body shading
- surface noise
- micro deformation
- normal distortion
- lighting
- post-processing

### CPU

Handle:

- approximately 15–25 major tentacle chains
- behavior state
- cursor tracking
- interaction calculations

### Optional future GPU simulation

If necessary, more of the tentacle/field simulation can later move to
the GPU.

The initial target should prioritize visual quality and maintain a
comfortable desktop frame rate.

------------------------------------------------------------------------

# 34. Alternative: Fully Procedural Organism

A fully procedural approach is possible.

Possible pipeline:

``` text
SDF / metaballs
      ↓
Marching Cubes / implicit surface
      ↓
Organic mesh
      ↓
Noise
      ↓
Cursor field
      ↓
Shader
```

This could create a very interesting alien-liquid organism.

However, it provides less direct artistic control over the exact
silhouette.

For the current visual target, this should be treated as a **future
experimental branch**, not the primary implementation.

The hybrid asset + WebGL approach is preferred.

------------------------------------------------------------------------

# 35. Why Hybrid Is The Recommended Approach

| Requirement             |  3D Asset | Procedural Only |        Hybrid |
|-------------------------|----------:|----------------:|--------------:|
| Art-directed silhouette | Excellent |          Medium |     Excellent |
| Complex tendrils        | Excellent |          Harder |     Excellent |
| Cursor interaction      |    Medium |       Excellent |     Excellent |
| Physics                 |    Medium |       Excellent |     Excellent |
| Material quality        | Excellent |       Excellent |     Excellent |
| Easy iteration          |    Medium |          Harder |          Good |
| Predictable performance |      Good |        Variable |          Good |
| Exact visual target     | Excellent |          Harder | **Excellent** |

**Recommendation: Hybrid.**

------------------------------------------------------------------------

# 36. Development Roadmap

Do not build the entire website at once.

## Prototype 01 — Body

Build only:

- black background
- floating creature
- excellent material
- excellent lighting

No UI.

Success criterion:

> The creature already looks good when completely idle.

------------------------------------------------------------------------

## Prototype 02 — Tendrils

Add:

- 15–25 primary tendrils
- autonomous movement
- small independent variations

Success criterion:

> The creature looks alive without user interaction.

------------------------------------------------------------------------

## Prototype 03 — Physics

Add:

- spring chains
- inertia
- lag
- overshoot
- damping

Success criterion:

> Tendril movement feels organic rather than keyframed.

------------------------------------------------------------------------

## Prototype 04 — Cursor

Add:

- cursor position
- distance
- velocity
- direction
- influence field

Success criterion:

> The creature notices the cursor.

------------------------------------------------------------------------

## Prototype 05 — Behavior

Add:

``` text
IDLE
AWARE
CURIOUS
REACTIVE
RECOVER
```

Success criterion:

> The creature appears to have behavioral states.

------------------------------------------------------------------------

## Prototype 06 — Material

Tune:

- blackness
- roughness
- specular response
- reflections
- surface noise
- wetness
- rim light

Success criterion:

> It visually approaches the generated concept.

------------------------------------------------------------------------

## Prototype 07 — Environment

Add:

- fog
- floor
- reflection
- camera
- atmosphere

Success criterion:

> The scene feels cinematic rather than like a raw 3D viewport.

------------------------------------------------------------------------

## Prototype 08 — Loader

Build:

- title treatment
- asset-aware loading
- goo emergence
- creature formation
- seamless transition

Success criterion:

> Loading feels like the organism waking up.

------------------------------------------------------------------------

## Prototype 09 — UI

Add:

- HUD
- navigation
- status
- interaction hints
- reactivity indicator

Success criterion:

> The UI supports the creature without competing with it.

------------------------------------------------------------------------

# 37. First Critical Milestone

Before building the polished website, create a standalone prototype
containing only:

``` text
black background
+
floating symbiote
```

Then:

> Move the cursor near it.

The desired result:

``` text
cursor approaches
      ↓
some tendrils notice
      ↓
body subtly deforms
      ↓
tendrils follow with lag
      ↓
cursor moves away
      ↓
creature recoils
      ↓
creature settles
      ↓
autonomous idle resumes
```

If this 10-second interaction feels alive, the hardest conceptual part
of the project has been solved.

Everything else is refinement.

------------------------------------------------------------------------

# 38. Core Design Rules

These should remain visible throughout development.

### Rule 1

**The creature is the product.**

The UI is secondary.

### Rule 2

**The creature has its own life.**

The cursor perturbs it; it does not control it.

### Rule 3

**Not every tentacle reacts.**

Independent behavior creates the illusion of life.

### Rule 4

**Movement should have inertia.**

Avoid instant positional changes.

### Rule 5

**The creature should be mostly black.**

Highlights reveal its shape.

### Rule 6

**Subtlety is more valuable than constant spectacle.**

The creature should spend most of its time calm.

### Rule 7

**The loader is part of the experience.**

It should feel like awakening, not waiting.

### Rule 8

**Avoid direct Venom replication.**

Use the supplied imagery as a material/visual reference and create an
original symbiote-like organism.

------------------------------------------------------------------------

# 39. Potential Future Features

These should not be part of the first MVP, but the architecture should
leave room for them.

## Click reaction

A sudden localized shockwave/recoil.

## Mouse-button hold

Potentially create an attraction/pressure interaction.

## Multi-pointer

Different behavior on touch devices.

## Touch support

Finger becomes the stimulus.

## Device motion

On mobile, device orientation could influence the organism.

## Audio reactivity

The creature could subtly pulse in response to microphone/audio input.

## Time-based personality

Longer interaction could gradually change its behavior.

## Memory

The creature could remember approximate recent cursor patterns during a
session.

## Modes

Potential future modes:

``` text
CALM
CURIOUS
AGITATED
HUNTING
SLEEP
```

These should be introduced only if they strengthen the core experience.

------------------------------------------------------------------------

# 40. Mobile Considerations

The first version should be desktop-first because the cursor is a major
part of the experience.

However, the interaction model can be generalized:

``` text
Pointer abstraction
        │
        ├── Mouse
        ├── Touch
        └── Pen
```

On touch:

- finger position = cursor position
- finger velocity = cursor velocity
- touch down = contact
- touch release = retreat

The underlying behavior system should not care whether the stimulus came
from a mouse or finger.

------------------------------------------------------------------------

# 41. Final Experience Summary

The finished page should feel like:

1.  Darkness.
2.  A title appears.
3.  The title begins to become contaminated by black organic matter.
4.  The symbiote forms.
5.  Tendrils emerge.
6.  The organism begins floating.
7.  The UI quietly appears.
8.  The user moves the cursor.
9.  A few tendrils notice.
10. The organism gradually becomes curious.
11. The cursor gets closer.
12. The creature reacts more strongly.
13. The cursor moves away.
14. The creature settles.
15. The user realizes it is continuously alive even when they do
    nothing.

The ultimate target is not:

> **“Look at this cool 3D model.”**

It is:

> **“Why does this thing feel like it’s watching me?”**

------------------------------------------------------------------------

# 42. Recommended Next Implementation Step

Do **not** start by building the final webpage.

Start with:

### `Symbiote Prototype 01`

Deliver only:

``` text
React + Three.js/R3F
        +
one .glb symbiote
        +
black environment
        +
floating animation
        +
camera
        +
lighting
```

Then iterate visually until the creature itself matches the desired
concept.

After that:

``` text
Prototype 02
→ tendril rigging

Prototype 03
→ physics

Prototype 04
→ cursor

Prototype 05
→ behavior

Prototype 06
→ shaders

Prototype 07
→ loader

Prototype 08
→ final HUD
```

This sequence minimizes risk and ensures that the central experience is
solved before investing time in the surrounding website.

------------------------------------------------------------------------

# 43. Final Technical Direction

**Primary approach:**

> **Blender-authored organic GLB + React Three Fiber + Three.js + custom
> GLSL + custom spring physics + procedural behavior + real asset-aware
> awakening loader.**

**No backend is required.**

Everything after asset creation can run entirely client-side.

The project should be treated as an **interactive WebGL art
experiment**, not a normal marketing website.

------------------------------------------------------------------------

## One-Sentence Project Definition

> **A frontend-only cinematic WebGL experience featuring an original
> floating symbiote that continuously behaves as a living organism and
> reacts organically to the user’s cursor, introduced through a
> title-driven “awakening” loader that seamlessly transforms into the
> interactive creature.**
