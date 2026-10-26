import * as THREE from 'three';
import { SEGS } from './tubes.js';
import { createStrings } from './strings.js';

// Procedural tendril network. It's built like organic matter rather than a
// ball with sticks in it:
//   trunk   - leaves the body in any direction. Lengths follow a power law:
//             a few long reachers, more medium arms, lots of short buds
//   arm     - a trunk that splits (one-to-many) continues as 2-3 arms
//   looper  - arms that curl back into the mass (tangle, cavities)
//   wrapper - strands crawling over the body surface
//   fibre   - hair-thin strands fraying off the tips
//   spike   - short splash points on the body
// The thick parts are fused into one implicit surface (mass.js), so strands
// that come together merge into one.
//
// What makes it read as alive (docs/VENOM_GOO_PROPERTIES.md):
//   - every tendril runs its own motion equations (C1)
//   - bundles of strands zip into one wide rope and unzip again (B2)
//   - goo strings stay stretched wherever goo comes apart (B4-B7)
//   - only a few tendrils go for the cursor; the ones already on it lower the
//     urge of the rest (response thresholds, C3), and they take turns
//   - a reach is a bend travelling from base to tip (C5)
export const BODY_R = 0.8;
export const ROOT_DEPTH = 0.7; // trunks start this far out, inside the body

const TAU = Math.PI * 2;

// seeded, so the creature has one art-directed shape instead of a new
// random one on every load
let rngState = 0x5eed1e;
function random() {
  rngState |= 0;
  rngState = (rngState + 0x6d2b79f5) | 0;
  let t = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const rand = (a, b) => a + random() * (b - a);
const pick = (n) => Math.floor(random() * n);

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const clamp01 = (x) => Math.min(1, Math.max(0, x));

function randomUnit(v) {
  const u = random() * 2 - 1;
  const th = random() * TAU;
  const s = Math.sqrt(1 - u * u);
  return v.set(Math.cos(th) * s, u, Math.sin(th) * s);
}

function fibDir(i, n, v) {
  const golden = Math.PI * (3 - Math.sqrt(5));
  const y = 1 - ((i + 0.5) / n) * 2;
  const r = Math.sqrt(1 - y * y);
  return v.set(Math.cos(golden * i) * r, y, Math.sin(golden * i) * r);
}

// ---------- each tendril's own equations ----------
// A curvature wave built from three harmonics whose ratios, weights and
// phases are the tendril's own, so no two strands share a waveform
function harmonics() {
  const w = [1, rand(0.2, 0.6), rand(0.05, 0.25)];
  const sum = w[0] + w[1] + w[2];
  return {
    h: [1, rand(1.6, 2.7), rand(3.2, 5.1)],
    w: w.map((x) => x / sum),
    p: [rand(0, TAU), rand(0, TAU), rand(0, TAU)],
  };
}
const harmonic = (x, H) =>
  H.w[0] * Math.sin(x * H.h[0] + H.p[0]) + H.w[1] * Math.sin(x * H.h[1] + H.p[1]) + H.w[2] * Math.sin(x * H.h[2] + H.p[2]);

function makeGenome() {
  return {
    waveA: harmonics(),
    waveB: harmonics(),
    // the second bending axis runs at its own ratio, so the tip traces a 3D
    // figure rather than swinging in a plane
    ratioB: rand(0.6, 1.35),
    speedB: rand(0.7, 1.3),
    // the whole arm sways about its root on a slow Lissajous figure
    swayAmp: rand(0.04, 0.28),
    swayF: [rand(0.03, 0.12), rand(0.05, 0.17)],
    swayP: [rand(0, TAU), rand(0, TAU)],
    // curl breathing: it curls up and lets go over tens of seconds
    breatheAmp: rand(0.1, 0.55),
    breatheF: rand(0.03, 0.15),
    breatheP: rand(0, TAU),
    // random flicks
    twitchAmp: rand(0.6, 2.2),
    nextTwitch: rand(1, 14),
  };
}

function makeTendril(kind, props) {
  const t = {
    kind,
    parent: null,
    children: [],
    s0: 0,
    dir: new THREE.Vector3(),
    headDir: new THREE.Vector3(),
    ref: randomUnit(new THREE.Vector3()),
    side: new THREE.Vector3(),
    len: 1,
    curl: 1,
    curlGrow: 1,
    freq: 3,
    speed: 0.6,
    stiff: 0,
    hook: 0,
    seed: random() * 100,
    r0: 0.05,
    r1: 0.003,
    taper: 0.7,
    flat: 1,
    bulge: 0.1,
    // speed of the bulges travelling outward along it
    pulse: rand(0.6, 2.6),
    // viscosity: how fast the strand catches up with where it wants to be
    lag: rand(0.65, 1.15),
    genome: makeGenome(),
    // temperament
    bold: random(),
    nervous: random(),
    curious: random(),
    target: Array.from({ length: SEGS }, () => new THREE.Vector3()),
    pts: Array.from({ length: SEGS }, () => new THREE.Vector3()),
    vel: Array.from({ length: SEGS }, () => new THREE.Vector3()),
    // cursor behaviour
    state: 'idle',
    front: 0,
    engage: 0,
    lean: 0,
    flinch: 0,
    nextThink: 0,
    holdTime: 0,
    restUntil: 0,
    goal: new THREE.Vector3(),
    wrapSign: random() < 0.5 ? -1 : 1,
    // per-strand wrap character so coils don't stack as concentric rings
    wrapTurn: 0.7 + random() * 0.9,
    wrapTilt: (random() - 0.5) * 1.4,
    wrapOff: new THREE.Vector2((random() - 0.5) * 0.08, (random() - 0.5) * 0.08),
    fresh: true,
    ...props,
  };
  // how quickly it notices, how fast it reaches, how long it can hold on
  t.react = rand(0.12, 0.7) * (1.3 - 0.6 * t.bold);
  t.reachSpeed = rand(1.1, 2.4) * (0.7 + 0.6 * t.bold);
  t.endurance = rand(1.6, 4.8) * (0.6 + 0.8 * t.bold);
  // response threshold: the stimulus it takes to make it commit
  t.theta = 0.18 + 0.5 * (1 - t.bold);
  // nervous strands flick more often
  t.twitchRate = rand(0.01, 0.05) + 0.12 * t.nervous * t.nervous;
  return t;
}

// a curvature wave's sideways swing is curl / k^2 (k = waves per unit
// length), so set curl from the swing we actually want to see
function setSwing(t, amplitude) {
  const k = t.freq / t.len;
  t.curl = amplitude * k * k;
}

// mirrored by the tube vertex shader (profile 0)
export function radiusAt(t, s, time = 0) {
  const r = t.r0 + (t.r1 - t.r0) * Math.pow(s, t.taper);
  return r * (1 + t.bulge * Math.sin(s * 19 + t.seed * 7 - time * t.pulse) * (1 - s));
}

export function createRig() {
  const tendrils = [];
  const tmp = new THREE.Vector3();
  const trunks = [];

  // ---------- trunks, with power-law lengths ----------
  // exact class counts (shuffled), so the length mix is designed rather
  // than left to the dice
  const classes = [...Array(7).fill('long'), ...Array(12).fill('medium'), ...Array(15).fill('short')];
  for (let i = classes.length - 1; i > 0; i--) {
    const j = pick(i + 1);
    [classes[i], classes[j]] = [classes[j], classes[i]];
  }
  const TRUNKS = classes.length;
  for (let i = 0; i < TRUNKS; i++) {
    const cls = classes[i];
    const t = makeTendril('trunk', { cls });
    fibDir(i, TRUNKS, t.dir).addScaledVector(randomUnit(tmp), 0.22).normalize();

    if (cls === 'short') {
      // buds: fat, short, rounded off - matter that's only started to push out
      Object.assign(t, {
        len: rand(0.16, 0.45),
        freq: rand(3, 6),
        speed: rand(0.3, 0.6),
        stiff: 3,
        r0: rand(0.09, 0.14),
        r1: rand(0.012, 0.03),
        taper: rand(0.45, 0.7),
        flat: rand(0.7, 0.95),
        bulge: 0.15,
      });
      setSwing(t, rand(0.01, 0.03));
    } else {
      const total = cls === 'long' ? rand(1.8, 2.5) : rand(0.8, 1.35);
      const splits = cls === 'long' ? random() < 0.75 : random() < 0.45;
      Object.assign(t, {
        total,
        len: splits ? total * (cls === 'long' ? rand(0.4, 0.55) : rand(0.62, 0.75)) : total,
        freq: rand(4, 8.5),
        speed: rand(0.5, 1.3),
        stiff: rand(2, 3),
        r0: cls === 'long' ? rand(0.13, 0.17) : rand(0.1, 0.14),
        // a trunk that splits stays thick to the fork
        r1: 0.004,
        taper: rand(0.8, 1.05),
        flat: rand(0.6, 0.85),
        bulge: rand(0.1, 0.2),
        curlGrow: rand(1.2, 2),
      });
      if (splits) {
        t.r1 = t.r0 * rand(0.5, 0.62);
        t.taper = 1;
      }
      setSwing(t, splits ? rand(0.02, 0.05) : rand(0.05, 0.12));
      if (!splits) t.hook = rand(5, 11) * (random() < 0.5 ? -1 : 1);
      t.splits = splits;
    }
    trunks.push(t);
    tendrils.push(t);
  }

  // ---------- one-to-many: split trunks continue as 2-3 arms ----------
  for (const t of trunks) {
    if (!t.splits) continue;
    const n = t.cls === 'long' ? (random() < 0.65 ? 2 : 3) : 2 + pick(2);
    const rest = t.total - t.len;
    for (let c = 0; c < n; c++) {
      const arm = makeTendril('arm', {
        parent: t,
        s0: 1,
        len: t.cls === 'long' ? rest * rand(0.75, 1.15) : rest * rand(0.6, 1.0),
        freq: rand(4, 8.5),
        speed: rand(0.6, 1.4),
        r0: t.r1 * rand(0.72, 0.85),
        r1: 0.003,
        taper: rand(0.75, 1.0),
        flat: rand(0.6, 0.9),
        bulge: 0.12,
        curlGrow: rand(1.4, 2.2),
        hook: rand(5, 11) * (random() < 0.5 ? -1 : 1),
        spread: t.cls === 'long' ? rand(0.45, 0.8) : rand(0.6, 1.0),
      });
      randomUnit(arm.side);
      setSwing(arm, t.cls === 'long' ? rand(0.05, 0.11) : rand(0.03, 0.06));
      t.children.push(arm);
      tendrils.push(arm);
    }
  }

  // everything long enough to go for the cursor: unsplit long and medium
  // trunks, and every arm
  const reachers = tendrils.filter((t) => t.kind === 'arm' || (t.kind === 'trunk' && t.cls !== 'short' && !t.splits));

  // ---------- body mass: loopers and surface crawlers ----------
  for (let i = 0; i < 16; i++) {
    const t = makeTendril('looper', {
      len: rand(0.7, 1.2),
      freq: rand(0.8, 1.4),
      speed: rand(0.15, 0.45),
      stiff: rand(0.2, 0.5),
      r0: rand(0.1, 0.16),
      // blunt ends: loopers are body mass, not more hair
      r1: rand(0.03, 0.05),
      taper: rand(0.55, 0.8),
      flat: rand(0.55, 0.8),
      bulge: 0.2,
      curlGrow: 1,
    });
    t.curl = rand(4, 6);
    randomUnit(t.dir);
    tendrils.push(t);
  }

  for (let i = 0; i < 22; i++) {
    const t = makeTendril('wrapper', {
      len: rand(0.7, 1.3),
      curl: rand(1.2, 2.4),
      curlGrow: 0.6,
      freq: rand(1.5, 3),
      speed: rand(0.15, 0.4),
      r0: rand(0.06, 0.1),
      r1: rand(0.015, 0.03),
      taper: 1,
      flat: rand(0.5, 0.8),
      bulge: 0.3,
      lag: rand(0.5, 0.7),
    });
    randomUnit(t.dir);
    tendrils.push(t);
  }

  // ---------- fine detail: fraying fibres and splash spikes ----------
  for (const r of reachers) {
    const fibres = r.kind === 'arm' || r.cls === 'long' ? 3 : 2;
    for (let f = 0; f < fibres; f++) {
      const t = makeTendril('fibre', {
        parent: r,
        s0: rand(0.55, 0.92),
        len: rand(0.08, 0.22),
        curl: rand(8, 12),
        curlGrow: 2,
        freq: rand(2, 4),
        speed: rand(0.6, 1.5),
        r0: rand(0.006, 0.014),
        r1: 0.0015,
        taper: 0.6,
        flat: 1,
        bulge: 0,
      });
      randomUnit(t.side);
      tendrils.push(t);
    }
  }

  const spikes = [];
  for (let i = 0; i < 46; i++) {
    const t = makeTendril('spike', {
      len: random() < 0.2 ? rand(0.18, 0.32) : rand(0.05, 0.14),
      curl: rand(2, 5),
      curlGrow: 2,
      freq: rand(2, 4),
      speed: rand(0.3, 0.6),
      r0: rand(0.018, 0.04),
      r1: 0.001,
      taper: 0.55,
      flat: rand(0.6, 1),
      bulge: 0,
    });
    randomUnit(t.dir);
    spikes.push(t);
    tendrils.push(t);
  }

  // fibres take their root radius from the parent at the branch point
  for (const t of tendrils) {
    if (t.kind === 'fibre') t.r0 = Math.min(t.r0, radiusAt(t.parent, t.s0) * 0.6);
  }

  // ---------- bundles: many into one, one into many (B2) ----------
  // Every fork's arms form a bundle (zipped, they continue the trunk as one
  // rope; unzipped, it has split into several), and so do groups of 2-3
  // neighbouring trunks. Each bundle runs its own zip cycle.
  const bundles = [];
  function makeBundle(members, opts) {
    bundles.push({
      members,
      // where along the strands fusing starts, from the root (arc length)
      a0: opts.a0,
      mode: opts.mode,
      // zip front 0..1 of the fusable span, and how far it goes this cycle
      f: 0,
      fMax: rand(0.5, 0.95),
      phase: 'open',
      timer: rand(1, 9),
      zipSpeed: rand(0.2, 0.45),
      unzipSpeed: rand(0.25, 0.55),
      nextString: 0,
      webs: [],
    });
  }
  for (const t of trunks) {
    if (t.children.length > 1) makeBundle(t.children, { a0: 0, mode: random() < 0.75 ? 'root' : 'mid' });
  }
  const free = trunks.filter((t) => t.cls !== 'short');
  const taken = new Set();
  for (const a of free) {
    if (taken.has(a)) continue;
    const group = [a];
    for (const b of free) {
      if (b === a || taken.has(b) || group.length >= 3) continue;
      if (a.dir.dot(b.dir) > 0.72) group.push(b);
    }
    if (group.length < 2) continue;
    group.forEach((g) => taken.add(g));
    // trunks start inside the body: fusing starts just outside it
    makeBundle(group, { a0: BODY_R * (1 - ROOT_DEPTH) + 0.08, mode: random() < 0.6 ? 'root' : 'mid' });
  }
  const bundleOf = new Map();
  bundles.forEach((b) => b.members.forEach((m) => bundleOf.set(m, b)));

  // ---------- per-frame growth ----------
  const h = new THREE.Vector3();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const p = new THREE.Vector3();
  const q = new THREE.Vector3();

  function samplePts(pts, s, out, tangent) {
    const f = Math.min(1, Math.max(0, s)) * (SEGS - 1);
    const i = Math.min(SEGS - 2, Math.floor(f));
    const u = f - i;
    out.copy(pts[i]).lerp(pts[i + 1], u);
    if (tangent) tangent.copy(pts[i + 1]).sub(pts[i]).normalize();
    return out;
  }

  function grow(t, time, cursor) {
    const ds = t.len / (SEGS - 1);
    const G = t.genome;

    if (t.parent) {
      samplePts(t.parent.pts, t.s0, p, h);
      const spread = t.kind === 'arm' ? t.spread : 0.6;
      h.addScaledVector(t.side, spread).normalize();
    } else if (t.kind === 'trunk' || t.kind === 'looper') {
      p.copy(t.dir).multiplyScalar(BODY_R * ROOT_DEPTH);
      h.copy(t.dir);
    } else {
      // wrapper / spike: rooted on the surface
      p.copy(t.dir).multiplyScalar(BODY_R * (t.kind === 'spike' ? 0.97 : 1.0));
      if (t.kind === 'wrapper') h.crossVectors(t.dir, t.ref).normalize();
      else h.copy(t.dir);
    }

    // its own slow sway about the root
    a.crossVectors(h, t.ref);
    if (a.lengthSq() < 1e-6) a.crossVectors(h, tmp.set(0, 1, 0));
    a.normalize();
    b.crossVectors(h, a);
    h.addScaledVector(a, G.swayAmp * Math.sin(TAU * G.swayF[0] * time + G.swayP[0]));
    h.addScaledVector(b, G.swayAmp * Math.sin(TAU * G.swayF[1] * time + G.swayP[1]));
    h.normalize();
    t.headDir.copy(h);

    // engaged strands move with purpose: their own idle motion quietens
    const calm = 1 - 0.75 * t.engage;
    const breathe = 1 + G.breatheAmp * Math.sin(TAU * G.breatheF * time + G.breatheP);

    for (let k = 0; k < SEGS; k++) {
      t.target[k].copy(p);
      const s = k / (SEGS - 1);

      a.crossVectors(h, t.ref);
      if (a.lengthSq() < 1e-6) a.crossVectors(h, tmp.set(0, 1, 0));
      a.normalize();
      b.crossVectors(h, a);

      const amp = t.curl * (0.25 + s * t.curlGrow) * breathe * calm;
      const x = s * t.freq - time * t.speed;
      const xB = s * t.freq * G.ratioB - time * t.speed * G.speedB;
      h.addScaledVector(a, harmonic(x, G.waveA) * amp * ds);
      h.addScaledVector(b, harmonic(xB, G.waveB) * amp * ds);

      // fibres of an arm that's on the cursor reach for it too
      if (t.kind === 'fibre' && t.parent.engage > 0.5 && cursor.active) {
        tmp.copy(t.parent.goal).sub(p).normalize();
        h.addScaledVector(tmp, t.parent.engage * 14 * ds);
      }

      if (t.hook) {
        const hk = Math.max(0, (s - 0.72) / 0.28);
        h.addScaledVector(a, t.hook * hk * hk * ds * calm);
      }

      if (t.kind === 'trunk' || t.kind === 'looper') {
        // only the first stretch is pushed outward; past that it's free to
        // swing, so it curves along its whole length
        const leave = Math.max(0, 1 - s / 0.25);
        h.addScaledVector(t.dir, t.stiff * ds * leave * leave);
      }
      h.normalize();
      p.addScaledVector(h, ds);

      if (t.kind === 'wrapper') {
        // crawl over the surface as a raised ridge
        const r = BODY_R * (1.0 + 0.02 * Math.sin(s * 9 + t.seed));
        p.normalize().multiplyScalar(r);
        h.addScaledVector(p, -h.dot(p) / p.lengthSq()).normalize();
      }
    }
  }

  // ---------- goo strings ----------
  const strings = createStrings(56, {
    anchorPos(A, out) {
      if (!A) return false;
      if (A.cursor) {
        out.copy(cursorPos);
        return true;
      }
      samplePts(A.t.pts, A.s, out);
      return true;
    },
    anchorRadius(A) {
      if (!A || A.cursor) return 0.01;
      return Math.min(0.045, radiusAt(A.t, A.s) * 0.75);
    },
  });
  const cursorPos = new THREE.Vector3();

  // ---------- bundles: zip cycle and fusing ----------
  const centroid = new THREE.Vector3();

  function zipRange(B) {
    let lmin = Infinity;
    for (const m of B.members) lmin = Math.min(lmin, m.len);
    const span = Math.max(0, lmin - B.a0);
    if (B.mode === 'root') return [B.a0, B.a0 + B.f * span];
    // braid: a fused stretch grows from the middle both ways
    const c = B.a0 + span * 0.45;
    const half = B.f * span * 0.4;
    return [c - half, c + half];
  }

  function stepBundle(B, dt, time) {
    B.timer -= dt;
    if (B.phase === 'open' && B.timer <= 0) {
      B.phase = 'zip';
      B.fMax = rand(0.5, 0.95);
      B.stringsLeft = 1 + pick(2);
      B.nextString = 0;
    } else if (B.phase === 'zip') {
      B.f += dt * B.zipSpeed;
      if (B.f >= B.fMax) {
        B.f = B.fMax;
        B.phase = 'fused';
        B.timer = rand(2.5, 8);
      }
    } else if (B.phase === 'fused' && B.timer <= 0) {
      B.phase = 'unzip';
    } else if (B.phase === 'unzip') {
      const [, aEnd] = zipRange(B);
      B.f -= dt * B.unzipSpeed;
      // sticky: strands peeling apart leave a string or two across the gap
      if (time >= B.nextString && B.f > 0.05 && B.stringsLeft > 0 && strings.activeCount() < STRING_BUDGET) {
        const free = B.members.filter((m) => m.engage < 0.3);
        if (free.length >= 2) {
          const i = pick(free.length);
          const j = (i + 1 + pick(free.length - 1)) % free.length;
          const ma = free[i];
          const mb = free[j];
          const sa = Math.min(1, aEnd / ma.len);
          const sb = Math.min(1, aEnd / mb.len);
          const r = Math.min(radiusAt(ma, sa), radiusAt(mb, sb));
          strings.spawnBridge({ t: ma, s: sa }, { t: mb, s: sb }, THREE.MathUtils.clamp(r * 0.45, 0.006, 0.026));
          B.stringsLeft--;
        }
        B.nextString = time + rand(0.4, 1.2);
      }
      // the film between them is dragged out too
      for (const w of B.webs) w.stretch = Math.max(w.stretch, 0.3);
      if (B.f <= 0) {
        B.f = 0;
        B.phase = 'open';
        B.timer = rand(3, 11);
      }
    }
  }

  // pull members' targets onto their common centre line over the zipped
  // stretch; the implicit surface then fuses them into one wider rope. A
  // member busy with the cursor peels out of the bundle
  function fuseBundle(B) {
    if (B.f <= 0) return;
    const [lo, hi] = zipRange(B);
    const soft = 0.3;
    // sample everyone's unfused pose, not one already pulled this frame
    for (const m of B.members) {
      if (!m.orig) m.orig = m.target.map((v) => v.clone());
      for (let k = 0; k < SEGS; k++) m.orig[k].copy(m.target[k]);
    }
    for (let k = 1; k < SEGS; k++) {
      for (const m of B.members) {
        const arc = (k / (SEGS - 1)) * m.len;
        const w = smoothstep(lo - soft, lo, arc) * (1 - smoothstep(hi, hi + soft, arc));
        if (w <= 0) continue;
        centroid.set(0, 0, 0);
        let n = 0;
        for (const o of B.members) {
          if (arc > o.len) continue;
          const wo = 1 - o.engage;
          samplePts(o.orig, arc / o.len, q);
          centroid.addScaledVector(q, wo);
          n += wo;
        }
        if (n <= 0) continue;
        centroid.multiplyScalar(1 / n);
        // a little apart, so the fused rope stays lobed rather than smooth
        m.target[k].lerp(centroid, w * 0.9 * (1 - m.engage));
      }
    }
  }

  // ---------- cursor behaviour ----------
  // The cursor is a stimulus, not a joystick (C2-C8). Each reacher thinks at
  // its own reaction time. It commits when the stimulus it feels beats its
  // threshold, and every tendril already engaged weakens that stimulus for
  // the rest, so only a few ever go at once. Holding tires it out: it lets
  // go (leaving a string), rests, and another takes its turn.
  const CAP = 3;
  // strings alive at once from contacts and unzips; letting go of the cursor
  // may always leave one
  const STRING_BUDGET = 18;
  const GRAB_STRINGS = 2;
  const reach = new THREE.Vector3();
  const arrive = new THREE.Vector3();
  const goal = new THREE.Vector3();
  const c1 = new THREE.Vector3();
  const toC = new THREE.Vector3();
  const rootPos = new THREE.Vector3();
  const baseRoot = new THREE.Vector3();

  function baseOf(t) {
    return t.kind === 'arm' ? t.parent : t;
  }
  function reachOf(t) {
    return t.kind === 'arm' ? t.parent.len + t.len : t.len;
  }

  // how strongly this strand feels the cursor: does it face it, and can it
  // get there
  function sense(t, cursor) {
    const base = baseOf(t);
    baseRoot.copy(base.target[0]);
    toC.copy(cursor.pos).sub(baseRoot);
    const dist = toC.length();
    toC.multiplyScalar(1 / Math.max(dist, 1e-4));
    const facing = base.dir.dot(toC);
    const r = reachOf(t) * 1.15;
    const prox = 1 - smoothstep(r * 0.7, r * 1.5, dist);
    return { s: Math.max(0, facing) * prox, reachable: dist < r && facing > 0.15, facing };
  }

  function release(t, time, cursor, leaveString) {
    if (leaveString && cursor.active) {
      strings.spawnBridge({ t, s: 0.93 }, { cursor: true }, rand(0.008, 0.016));
    }
    t.state = 'release';
    t.restUntil = time + rand(1.5, 4.5);
  }

  function think(t, time, cursor, engaged, startled) {
    if (time < t.nextThink) return;
    t.nextThink = time + t.react * rand(0.6, 1.4);
    const st = cursor.active ? sense(t, cursor) : { s: 0, reachable: false, facing: -1 };

    switch (t.state) {
      case 'idle':
      case 'watch': {
        // the urge each one feels drops with every strand already on it
        const felt = st.s * Math.max(0, 1 - engaged / CAP);
        if (startled && st.facing > 0.2 && t.nervous > 0.5) {
          t.flinch = -0.8;
          t.state = 'idle';
        } else if (!startled && st.reachable && felt > t.theta) {
          t.state = 'reach';
          t.holdTime = 0;
        } else {
          t.state = st.s > 0.15 && t.curious > 0.35 ? 'watch' : 'idle';
        }
        break;
      }
      case 'reach':
      case 'hold':
        if (!cursor.active || !st.reachable) release(t, time, cursor, t.state === 'hold');
        else if (startled && t.nervous > 0.6) release(t, time, cursor, false);
        else if (t.state === 'hold' && t.holdTime > t.endurance) release(t, time, cursor, true);
        break;
      case 'rest':
        if (time >= t.restUntil) t.state = 'idle';
        break;
    }
  }

  function stepCursorState(t, dt) {
    if (t.state === 'reach') {
      // the bend travels out from the base (C5)
      t.front = Math.min(1.3, t.front + dt * t.reachSpeed);
      if (t.front >= 1.3) t.state = 'hold';
    } else if (t.state === 'hold') {
      t.holdTime += dt;
    } else if (t.state === 'release') {
      // and lets go from the tip back
      t.front = Math.max(0, t.front - dt * t.reachSpeed * 1.8);
      if (t.front <= 0) t.state = 'rest';
    } else if (t.front > 0) {
      t.front = Math.max(0, t.front - dt * t.reachSpeed * 1.8);
    }
    const engageTarget = t.state === 'reach' || t.state === 'hold' ? 1 : t.front / 1.3;
    t.engage += (engageTarget - t.engage) * (1 - Math.exp(-dt * 6));
    const leanTarget = t.state === 'watch' ? 0.12 + 0.2 * t.curious : 0;
    t.lean += (leanTarget - t.lean) * (1 - Math.exp(-dt * 2));
    t.flinch *= Math.exp(-dt * 2.5);
  }

  // where along a reach pose a strand would be, from its root toward the
  // goal; coilW blends the last stretch into a coil around the goal
  function posePoint(t, s, coilW, wrapR, out) {
    const back = Math.atan2(rootPos.y - goal.y, rootPos.x - goal.x);
    // plain arrival: a curve ending on the goal
    const u0 = s;
    const i0 = 1 - u0;
    arrive.set(
      i0 * i0 * rootPos.x + 2 * i0 * u0 * c1.x + u0 * u0 * goal.x,
      i0 * i0 * rootPos.y + 2 * i0 * u0 * c1.y + u0 * u0 * goal.y,
      i0 * i0 * rootPos.z + 2 * i0 * u0 * c1.z + u0 * u0 * goal.z
    );
    if (coilW <= 0.001) return out.copy(arrive);
    // coiled: arrive at the side of the goal by s = 0.8, then wrap around it
    const sArrive = 0.8;
    if (s <= sArrive) {
      const u = s / sArrive;
      const iu = 1 - u;
      const ex = goal.x + Math.cos(back) * wrapR;
      const ey = goal.y + Math.sin(back) * wrapR;
      reach.set(
        iu * iu * rootPos.x + 2 * iu * u * c1.x + u * u * ex,
        iu * iu * rootPos.y + 2 * iu * u * c1.y + u * u * ey,
        iu * iu * rootPos.z + 2 * iu * u * c1.z + u * u * goal.z
      );
    } else {
      const u = (s - sArrive) / (1 - sArrive);
      const ang = back + t.wrapSign * u * Math.PI * t.wrapTurn * 1.4;
      const r = wrapR * (1 - 0.45 * u) * (1 + 0.25 * Math.sin(u * 9 + t.seed));
      // tilted, off-centre ellipse: each strand wraps at its own angle
      reach.set(
        goal.x + t.wrapOff.x * u + Math.cos(ang) * r,
        goal.y + t.wrapOff.y * u + Math.sin(ang) * r * (0.55 + 0.45 * Math.cos(t.wrapTilt)),
        goal.z + Math.sin(ang) * r * Math.sin(t.wrapTilt)
      );
    }
    return out.copy(arrive).lerp(reach, coilW);
  }

  function setGoal(t, maxLen, clampToLen) {
    rootPos.copy(t.target[0]);
    goal.copy(t.goal).sub(rootPos);
    const dist = goal.length();
    if (clampToLen) goal.multiplyScalar(Math.min(1, t.len / Math.max(dist, 1e-3)));
    else if (dist > maxLen) goal.multiplyScalar(maxLen / dist);
    goal.add(rootPos);
    c1.copy(t.headDir).multiplyScalar(Math.min(dist, t.len) * 0.45).add(rootPos);
    return dist;
  }

  // reacher: the committed part (behind the travelling front) follows the
  // reach pose; a watcher only leans its tip a little; a flinch pulls it in
  function applyReach(t) {
    if (t.flinch < -0.01) {
      rootPos.copy(t.target[0]);
      for (let k = 1; k < SEGS; k++) t.target[k].sub(rootPos).multiplyScalar(1 + t.flinch * 0.45).add(rootPos);
    }
    if (t.front <= 0.001 && t.lean <= 0.002) return;
    setGoal(t, t.len * 1.25, false);
    const coilW = smoothstep(1.0, 1.3, t.front);
    const wrapR = 0.13 + 0.08 * t.bold;
    for (let k = 1; k < SEGS; k++) {
      const s = k / (SEGS - 1);
      const committed = clamp01((t.front - s) / 0.35);
      const w = Math.max(committed, t.lean * s * s) * Math.min(1, s / 0.15);
      if (w <= 0) continue;
      posePoint(t, s, coilW, wrapR, q);
      t.target[k].lerp(q, w);
    }
  }

  // a split trunk bends toward where its busy arm is going, so the whole limb
  // moves, not just the fork
  function applyTrunkLean(t) {
    let e = 0;
    let src = null;
    for (const c of t.children) {
      if (c.engage > e) {
        e = c.engage;
        src = c;
      }
    }
    if (!src || e < 0.01) return;
    t.goal.copy(src.goal);
    setGoal(t, t.len, true);
    for (let k = 1; k < SEGS; k++) {
      const s = k / (SEGS - 1);
      posePoint(t, s, 0, 0, q);
      t.target[k].lerp(q, e * 0.6 * Math.min(1, s / 0.3));
    }
  }

  // ---------- contact: tips that touch stick together (B4) ----------
  const stickers = tendrils.filter((t) => t.kind === 'arm' || (t.kind === 'trunk' && t.cls !== 'short'));
  const stuckUntil = new Map();
  const touching = new Set();
  let nextContact = 0;
  const pa = new THREE.Vector3();
  const pb = new THREE.Vector3();
  // where two strands touch, as material points on each, or null
  function touchPoint(ta, tb) {
    for (const sa of [0.55, 0.8]) {
      samplePts(ta.pts, sa, pa);
      for (const sb of [0.55, 0.8]) {
        samplePts(tb.pts, sb, pb);
        if (pa.distanceToSquared(pb) < 0.06 * 0.06) return [sa, sb];
      }
    }
    return null;
  }

  function checkContacts(time) {
    if (time < nextContact) return;
    nextContact = time + 0.12;
    for (let i = 0; i < stickers.length; i++) {
      const ta = stickers[i];
      for (let j = i + 1; j < stickers.length; j++) {
        const tb = stickers[j];
        const key = i * 1000 + j;
        const B = bundleOf.get(ta);
        if (B && B === bundleOf.get(tb) && B.f > 0) continue;
        const touch = touchPoint(ta, tb);
        if (!touch) {
          touching.delete(key);
          continue;
        }
        // only on first touch: strands resting against each other don't keep
        // spinning new strings
        if (!touching.has(key) && (stuckUntil.get(key) || 0) <= time && strings.activeCount() < STRING_BUDGET &&
            strings.countOn(ta) < 2 && strings.countOn(tb) < 2) {
          const [sa, sb] = touch;
          const r = Math.min(radiusAt(ta, sa), radiusAt(tb, sb));
          strings.spawnBridge({ t: ta, s: sa }, { t: tb, s: sb }, THREE.MathUtils.clamp(r * 0.6, 0.006, 0.022));
          stuckUntil.set(key, time + rand(4, 8));
        }
        touching.add(key);
      }
    }
  }

  // ---------- webbing ----------
  // films between neighbouring trunks just outside the body, and in the
  // crotch of every fork (the web between fingers). A film between strands
  // that are peeling apart is dragged further out (sticky), then recovers
  const pairs = [];
  const idx = (t) => tendrils.indexOf(t);
  function addPair(ta, tb, start, reachTo) {
    const pair = { a: idx(ta), b: idx(tb), ta, tb, start, reach: reachTo, baseReach: reachTo, stretch: 0 };
    pairs.push(pair);
    const B = bundleOf.get(ta);
    if (B && B === bundleOf.get(tb)) B.webs.push(pair);
  }
  for (let i = 0; i < trunks.length; i++) {
    const ta = trunks[i];
    if (ta.cls === 'short') continue;
    for (let j = i + 1; j < trunks.length; j++) {
      const tb = trunks[j];
      if (tb.cls === 'short' || ta.dir.dot(tb.dir) < 0.82 || random() > 0.6) continue;
      const start = (BODY_R * (0.92 - ROOT_DEPTH)) / Math.min(ta.len, tb.len);
      addPair(ta, tb, start, start + rand(0.15, 0.28));
    }
  }
  for (const t of trunks) {
    for (let c = 0; c + 1 < t.children.length; c++) {
      addPair(t.children[c], t.children[c + 1], 0, rand(0.22, 0.38));
    }
  }

  function update(dt, time, cursor) {
    if (cursor.active) cursorPos.copy(cursor.pos);
    const startled = cursor.active && cursor.speed > 6;

    // decide (each at its own pace) and advance the reach fronts
    let engaged = 0;
    for (const t of reachers) if (t.state === 'reach' || t.state === 'hold') engaged++;
    for (const t of reachers) {
      if (cursor.active) t.goal.copy(cursor.pos);
      think(t, time, cursor, engaged, startled);
      stepCursorState(t, dt);
    }

    // when an arm gets hold, the body facing the cursor throws a couple of
    // goo strings at it too; they stretch, sag and snap like any other
    let grabbed = false;
    for (const t of reachers) {
      if (t.state === 'hold' && !t.wasHolding) grabbed = true;
      t.wasHolding = t.state === 'hold';
    }
    if (grabbed && cursor.active) {
      toC.copy(cursor.pos).normalize();
      spikes
        .filter((t) => t.dir.dot(toC) > 0.5 && strings.countOn(t) === 0)
        .sort((x, y) => y.dir.dot(toC) - x.dir.dot(toC))
        .slice(0, GRAB_STRINGS)
        .forEach((t) => strings.spawnBridge({ t, s: 0.85 }, { cursor: true }, rand(0.006, 0.011)));
    }

    for (const B of bundles) stepBundle(B, dt, time);
    for (const p of pairs) {
      p.stretch *= Math.exp(-dt * 0.6);
      p.reach = Math.min(0.95, p.baseReach + p.stretch);
    }

    // natural pose for everything (parents first, so children root on them)
    for (const t of tendrils) grow(t, time, cursor);
    for (const B of bundles) fuseBundle(B);
    for (const t of tendrils) {
      if (t.kind === 'trunk' && t.splits) applyTrunkLean(t);
      else if (reachersSet.has(t)) applyReach(t);
    }

    for (const t of tendrils) {
      if (t.fresh) {
        for (let k = 0; k < SEGS; k++) t.pts[k].copy(t.target[k]);
        t.fresh = false;
        continue;
      }
      // damped springs toward the target, looser toward the tip: viscous
      // lag and a little overshoot. Stiffer while it means business (C8)
      const stiffen = 1 + 0.5 * t.engage;
      t.pts[0].copy(t.target[0]);
      for (let k = 1; k < SEGS; k++) {
        const s = k / (SEGS - 1);
        const w = (16 - 10 * s) * t.lag * stiffen;
        const kk = w * w;
        const c = 2 * 0.7 * w;
        const v = t.vel[k];
        v.x += (kk * (t.target[k].x - t.pts[k].x) - c * v.x) * dt;
        v.y += (kk * (t.target[k].y - t.pts[k].y) - c * v.y) * dt;
        v.z += (kk * (t.target[k].z - t.pts[k].z) - c * v.z) * dt;
        t.pts[k].addScaledVector(v, dt);
      }

      // a flick now and then, at its own (Poisson) rate
      const G = t.genome;
      if (time >= G.nextTwitch) {
        G.nextTwitch = time - Math.log(1 - random()) / t.twitchRate;
        if (t.engage < 0.2 && t.kind !== 'wrapper') {
          randomUnit(tmp).multiplyScalar(G.twitchAmp * (0.5 + t.nervous));
          for (let k = 1; k < SEGS; k++) {
            const s = k / (SEGS - 1);
            t.vel[k].addScaledVector(tmp, s * s);
          }
        }
      }
    }

    checkContacts(time);
    strings.update(dt, cursor);
  }
  const reachersSet = new Set(reachers);

  return { tendrils, pairs, strings, bundles, update };
}
