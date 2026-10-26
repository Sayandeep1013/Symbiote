import * as THREE from 'three';
import { SEGS } from './tubes.js';

// Procedural tendril hierarchy. Detail lives at several scales at once, which
// is what separates "symbiote" from "blob with spikes":
//   primary  - long ribbon-ish arms that swim outward
//   wrapper  - strands crawling over the body surface (the tangled mass)
//   branch   - offshoots partway along primaries
//   fibre    - hair-thin strands fraying off near primary tips
//   spike    - short splash points on the body
export const BODY_R = 0.85;

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

// smooth 1D pseudo-noise, cheap enough to run per spine point on the CPU
const wave = (x, seed) =>
  Math.sin(x + seed * 12.9898) * 0.55 +
  Math.sin(x * 2.31 + seed * 4.21) * 0.3 +
  Math.sin(x * 4.13 + seed * 7.77) * 0.15;

function randomUnit(v) {
  const u = random() * 2 - 1;
  const th = random() * Math.PI * 2;
  const s = Math.sqrt(1 - u * u);
  return v.set(Math.cos(th) * s, u, Math.sin(th) * s);
}

function makeTendril(kind, props) {
  return {
    kind,
    parent: null,
    s0: 0,
    dir: new THREE.Vector3(),
    ref: randomUnit(new THREE.Vector3()),
    side: new THREE.Vector3(),
    len: 1,
    curl: 1,
    curlGrow: 1,
    freq: 3,
    speed: 0.6,
    stiff: 0,
    seed: random() * 100,
    r0: 0.05,
    r1: 0.003,
    taper: 0.7,
    flat: 1,
    bulge: 0.1,
    lag: 1,
    target: Array.from({ length: SEGS }, () => new THREE.Vector3()),
    pts: Array.from({ length: SEGS }, () => new THREE.Vector3()),
    vel: Array.from({ length: SEGS }, () => new THREE.Vector3()),
    // cursor interest: g > 0 reaches/grabs, g < 0 flinches back
    g: 0,
    gTarget: 0,
    bold: random(),
    wrapSign: random() < 0.5 ? -1 : 1,
    // per-strand wrap character so coils don't stack as concentric rings
    wrapTurn: 0.7 + random() * 0.9,
    wrapTilt: (random() - 0.5) * 1.4,
    wrapOff: new THREE.Vector2((random() - 0.5) * 0.08, (random() - 0.5) * 0.08),
    fresh: true,
    ...props,
  };
}

export function createRig() {
  const tendrils = [];
  const tmp = new THREE.Vector3();

  // arms fan out around the screen plane like a splash crown, with only a
  // modest tilt toward/away from the viewer, so they read at full length
  // instead of foreshortening into spikes
  const PRIMARY = 22;
  const primaries = [];
  for (let i = 0; i < PRIMARY; i++) {
    const t = makeTendril('primary', {
      len: random() < 0.5 ? rand(1.9, 2.5) : rand(1.4, 1.9),
      // snake-like: thick for most of the length, about two waves along it
      // freq is in radians of curvature-wave along the arm: ~1.5 waves
      curl: rand(2.2, 3.2),
      // calm near the root, waving harder toward the tip
      curlGrow: rand(1.6, 2.6),
      freq: rand(7, 11),
      speed: rand(0.8, 1.4),
      stiff: rand(2.0, 3.0),
      r0: rand(0.13, 0.17),
      r1: 0.004,
      // steady thinning from a fat root to a fine tip
      taper: rand(0.75, 1.0),
      flat: rand(0.65, 0.85),
      bulge: rand(0.1, 0.2),
    });
    // lateral swing of a curvature wave is curl / k^2 (k = waves per unit
    // length), so derive curl from the sideways amplitude we actually want
    // waves bend mostly in the screen plane (ref = view axis), where they
    // read; out-of-plane bending is wasted on foreshortening
    t.ref.set(0, 0, 1);
    t.planar = 0.3;
    const ang = (i / PRIMARY) * Math.PI * 2 + rand(-0.12, 0.12);
    // a wide crown: arms reaching sideways are longer than up/down ones
    t.len *= 0.72 + 0.38 * Math.abs(Math.cos(ang));
    const k = t.freq / t.len;
    // ~0.1-0.16 units of sideways swing = 30-45 degrees of heading change:
    // a snake, not a coil
    t.curl = rand(0.08, 0.13) * k * k;
    // tips curl over into a hook instead of ending in a straight needle
    t.hook = rand(7, 11) * (random() < 0.5 ? -1 : 1);
    t.dir.set(Math.cos(ang), Math.sin(ang), rand(-0.5, 0.5)).normalize();
    primaries.push(t);
    tendrils.push(t);
  }

  // loopers: medium arms that leave the body and curl straight back into the
  // mass, building the tangle with dark cavities between lobes
  for (let i = 0; i < 32; i++) {
    const t = makeTendril('looper', {
      len: rand(0.9, 1.6),
      curl: rand(4, 6),
      curlGrow: 1,
      freq: rand(0.8, 1.4),
      speed: rand(0.2, 0.45),
      stiff: rand(0.2, 0.5),
      r0: rand(0.11, 0.18),
      // blunt ends: loopers are body mass, not more hair
      r1: rand(0.03, 0.05),
      taper: rand(0.55, 0.8),
      flat: rand(0.55, 0.8),
      bulge: 0.2,
    });
    randomUnit(t.dir);
    tendrils.push(t);
  }

  for (let i = 0; i < 26; i++) {
    const t = makeTendril('wrapper', {
      len: rand(0.7, 1.4),
      curl: rand(1.2, 2.4),
      curlGrow: 0.6,
      freq: rand(1.5, 3),
      speed: rand(0.2, 0.4),
      r0: rand(0.07, 0.12),
      r1: rand(0.015, 0.03),
      taper: 1,
      flat: rand(0.5, 0.8),
      bulge: 0.3,
      lag: 0.6,
    });
    randomUnit(t.dir);
    tendrils.push(t);
  }

  for (const p of primaries) {
    // short curly offshoots flicked off along the arm, like drips thrown
    // from a whipped rope
    const branches = Math.floor(random() * 3);
    for (let b = 0; b < branches; b++) {
      const t = makeTendril('branch', {
        parent: p,
        s0: rand(0.25, 0.8),
        len: p.len * rand(0.1, 0.22),
        curl: rand(10, 16),
        curlGrow: 1.5,
        freq: rand(1.2, 2.2),
        speed: rand(0.5, 0.9),
        r1: 0.002,
        taper: 0.8,
        flat: rand(0.6, 0.9),
        bulge: 0.1,
      });
      randomUnit(t.side);
      tendrils.push(t);
    }
    const fibres = 2;
    for (let f = 0; f < fibres; f++) {
      const t = makeTendril('fibre', {
        parent: p,
        s0: rand(0.6, 0.95),
        len: rand(0.08, 0.22),
        curl: rand(8, 12),
        curlGrow: 2,
        freq: rand(2, 4),
        speed: rand(0.8, 1.4),
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

  for (let i = 0; i < 70; i++) {
    const t = makeTendril('spike', {
      len: random() < 0.2 ? rand(0.2, 0.35) : rand(0.05, 0.16),
      curl: rand(2, 5),
      curlGrow: 2,
      freq: rand(2, 4),
      speed: rand(0.3, 0.6),
      r0: rand(0.018, 0.045),
      r1: 0.001,
      taper: 0.55,
      flat: rand(0.6, 1),
      bulge: 0,
    });
    randomUnit(t.dir);
    tendrils.push(t);
  }

  // branches/fibres take their root radius from the parent at the branch point
  for (const t of tendrils) {
    if (t.parent) {
      const pr = t.parent.r0 + (t.parent.r1 - t.parent.r0) * Math.pow(t.s0, t.parent.taper);
      if (t.kind === 'branch') t.r0 = pr * rand(0.55, 0.8);
      else t.r0 = Math.min(t.r0, pr * 0.6);
    }
  }

  // ---------- per-frame growth ----------
  const h = new THREE.Vector3();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const p = new THREE.Vector3();

  function samplePts(pts, s, out, tangent) {
    const f = s * (SEGS - 1);
    const i = Math.min(SEGS - 2, Math.floor(f));
    const u = f - i;
    out.copy(pts[i]).lerp(pts[i + 1], u);
    if (tangent) tangent.copy(pts[i + 1]).sub(pts[i]).normalize();
    return out;
  }

  function grow(t, time, cursor) {
    const ds = t.len / (SEGS - 1);

    if (t.parent) {
      samplePts(t.parent.pts, t.s0, p, h);
      h.addScaledVector(t.side, t.kind === 'branch' ? 0.9 : 0.6).normalize();
    } else if (t.kind === 'primary' || t.kind === 'looper') {
      p.copy(t.dir).multiplyScalar(BODY_R * 0.72);
      h.copy(t.dir);
    } else {
      // wrapper / spike: rooted on the surface
      p.copy(t.dir).multiplyScalar(BODY_R * (t.kind === 'spike' ? 0.97 : 1.0));
      if (t.kind === 'wrapper') {
        // start tangent to the body
        h.crossVectors(t.dir, t.ref).normalize();
      } else {
        h.copy(t.dir);
      }
    }

    for (let k = 0; k < SEGS; k++) {
      t.target[k].copy(p);
      const s = k / (SEGS - 1);

      a.crossVectors(h, t.ref);
      if (a.lengthSq() < 1e-6) a.crossVectors(h, tmp.set(0, 1, 0));
      a.normalize();
      b.crossVectors(h, a);

      const amp = t.curl * (0.25 + s * t.curlGrow);
      const x = s * t.freq - time * t.speed;
      h.addScaledVector(a, wave(x, t.seed) * amp * ds);
      h.addScaledVector(b, wave(x * 0.83 + 1.7, t.seed + 31) * amp * ds * (t.planar ?? 1));

      if (t.parent && t.parent.g > 0.3 && cursor && cursor.active) {
        tmp.copy(cursor.pos).sub(p).normalize();
        h.addScaledVector(tmp, t.parent.g * 14 * ds);
      }

      if (t.hook) {
        const hk = Math.max(0, (s - 0.72) / 0.28);
        h.addScaledVector(a, t.hook * hk * hk * ds);
      }

      if (t.kind === 'primary' || t.kind === 'looper') {
        // only the first stretch is pushed outward; past that the arm is
        // free to swing, so it curves along its whole length
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

  // ---------- cursor behaviour ----------
  // The cursor is a stimulus, not a joystick. Each frame the arms that face
  // it get an interest level from their own boldness: the nearest bold arm
  // sniffs toward it, a few lunge and coil around it once it's close, and
  // shy ones flinch away from fast movement. Everything else keeps swimming.
  const GRAB_ARMS = 6;
  const GRAB_STRINGS = 10;
  let spikes = null;
  const reach = new THREE.Vector3();
  const goal = new THREE.Vector3();
  const c1 = new THREE.Vector3();
  const toC = new THREE.Vector3();
  let holdTime = 0;
  let cooldown = 0;

  function decideInterest(cursor, dt) {
    cooldown = Math.max(0, cooldown - dt);
    spikes = spikes || tendrils.filter((t) => t.kind === 'spike');
    for (const t of primaries) t.gTarget = 0;
    for (const t of spikes) t.gTarget = 0;
    if (!cursor.active) {
      holdTime = 0;
      return;
    }

    const d = cursor.pos.length();
    toC.copy(cursor.pos).normalize();
    const ranked = primaries
      .map((t) => ({ t, facing: t.dir.dot(toC), reachable: BODY_R * 0.72 + t.len * 1.2 >= d }))
      .filter((r) => r.facing > 0.35)
      .sort((x, y) => y.facing - x.facing);

    const fast = cursor.speed > 6;
    const near = ranked.length && ranked[0].reachable;

    if (fast) {
      // sudden movement: shy arms on that side recoil, bold ones ignore it
      for (const r of ranked.slice(0, 6)) if (r.t.bold < 0.45) r.t.gTarget = -0.8;
      holdTime = 0;
      return;
    }

    if (near && cooldown <= 0) {
      holdTime += dt;
      let taken = 0;
      for (const r of ranked) {
        if (!r.reachable) continue;
        // not every arm joins: the timid ones only lean in
        r.t.gTarget = r.t.bold > 0.15 ? 1 : 0.35;
        if (++taken >= GRAB_ARMS) break;
      }
      // thin strings shoot straight off the body surface at it, like the
      // strands that latch onto the cursor in the reel
      spikes
        .map((t) => ({ t, facing: t.dir.dot(toC) }))
        .filter((r) => r.facing > 0.55)
        .sort((x, y) => y.facing - x.facing)
        .slice(0, GRAB_STRINGS)
        .forEach((r) => { r.t.gTarget = 1; });
      // held too long and dragged out of reach: let go and whip back
      if (holdTime > 0.5 && !ranked.some((r) => r.reachable && r.t.g > 0.6)) {
        cooldown = 1.2;
      }
    } else {
      holdTime = 0;
      // sniffing: the closest bold arm leans out toward it
      const lead = ranked.find((r) => r.t.bold > 0.3);
      if (lead && d < BODY_R + lead.t.len * 1.9) lead.t.gTarget = 0.3;
    }
  }

  // blend an arm's natural pose toward one reaching for (and coiling around)
  // the cursor; g < 0 pulls it back toward the body instead
  function applyInterest(t, cursor) {
    const g = t.g;
    if (Math.abs(g) < 0.002) return;
    const root = t.target[0];

    if (g < 0) {
      for (let k = 1; k < SEGS; k++) {
        t.target[k].sub(root).multiplyScalar(1 + g * 0.45).add(root);
      }
      return;
    }

    goal.copy(cursor.pos).sub(root);
    const dist = goal.length();
    // arms can only stretch so far; the thin strings pay out as far as needed
    const maxLen = t.kind === 'spike' ? 4 : t.len * 1.25;
    if (dist > maxLen) goal.multiplyScalar(maxLen / dist);
    goal.add(root);

    const wrapR = t.kind === 'spike' ? 0.05 + 0.08 * t.bold : 0.13 + 0.08 * t.bold;
    // arrive from the body side, then coil the last stretch around the point
    const back = Math.atan2(root.y - goal.y, root.x - goal.x);
    const sArrive = 0.8;
    c1.copy(t.dir).multiplyScalar(Math.min(dist, t.len) * 0.45).add(root);

    for (let k = 1; k < SEGS; k++) {
      const s = k / (SEGS - 1);
      if (s <= sArrive) {
        const u = s / sArrive;
        const iu = 1 - u;
        const ex = goal.x + Math.cos(back) * wrapR;
        const ey = goal.y + Math.sin(back) * wrapR;
        reach.set(
          iu * iu * root.x + 2 * iu * u * c1.x + u * u * ex,
          iu * iu * root.y + 2 * iu * u * c1.y + u * u * ey,
          iu * iu * root.z + 2 * iu * u * c1.z + u * u * goal.z
        );
      } else {
        const u = (s - sArrive) / (1 - sArrive);
        const ang = back + t.wrapSign * u * Math.PI * t.wrapTurn * 1.4;
        const r = wrapR * (1 - 0.45 * u) * (1 + 0.25 * Math.sin(u * 9 + t.seed));
        // tilted, off-centre ellipse: each strand wraps at its own angle
        const ex = Math.cos(ang) * r;
        const ey = Math.sin(ang) * r * (0.55 + 0.45 * Math.cos(t.wrapTilt));
        reach.set(
          goal.x + t.wrapOff.x * u + ex,
          goal.y + t.wrapOff.y * u + ey,
          goal.z + Math.sin(ang) * r * Math.sin(t.wrapTilt)
        );
      }
      // the root stays put; the reach takes over along the arm
      const w = g * Math.min(1, s / 0.3);
      t.target[k].lerp(reach, w);
    }
  }

  function update(dt, time, cursor) {
    decideInterest(cursor, dt);
    for (const t of primaries.concat(spikes)) {
      // bold ones lunge; letting go is fast for everyone
      const rate = t.gTarget > t.g ? 2 + 6 * t.bold : 5;
      t.g += (t.gTarget - t.g) * (1 - Math.exp(-dt * rate));
    }

    for (const t of tendrils) {
      grow(t, time, cursor);
      if (t.kind === 'primary' || t.kind === 'spike') applyInterest(t, cursor);
      if (t.fresh) {
        for (let k = 0; k < SEGS; k++) t.pts[k].copy(t.target[k]);
        t.fresh = false;
        continue;
      }
      // damped springs toward the target, looser toward the tip: fluid lag,
      // and a little overshoot so a released arm whips back
      for (let k = 0; k < SEGS; k++) {
        if (k === 0) {
          t.pts[0].copy(t.target[0]);
          continue;
        }
        const s = k / (SEGS - 1);
        const w = (16 - 10 * s) * t.lag;
        const kk = w * w;
        const c = 2 * 0.7 * w;
        const v = t.vel[k];
        v.x += (kk * (t.target[k].x - t.pts[k].x) - c * v.x) * dt;
        v.y += (kk * (t.target[k].y - t.pts[k].y) - c * v.y) * dt;
        v.z += (kk * (t.target[k].z - t.pts[k].z) - c * v.z) * dt;
        t.pts[k].addScaledVector(v, dt);
      }
    }
  }

  // webbing between neighbouring arms of the crown (they're created in angle
  // order). It starts just outside the body and runs well up the arms, where
  // they've spread apart enough for the film to show
  const pairs = [];
  for (let i = 0; i < primaries.length; i++) {
    if (random() > 0.7) continue;
    const pa = primaries[i];
    const pb = primaries[(i + 1) % primaries.length];
    const start = Math.max(0.05, (BODY_R * 0.9 - BODY_R * 0.72) / Math.min(pa.len, pb.len));
    pairs.push({
      a: tendrils.indexOf(pa),
      b: tendrils.indexOf(pb),
      start,
      reach: start + rand(0.16, 0.3),
    });
  }

  return { tendrils, pairs, update };
}
