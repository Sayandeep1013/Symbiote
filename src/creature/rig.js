import * as THREE from 'three';
import { SEGS } from './tubes.js';

// Procedural tendril network. It's built like organic matter rather than a
// ball with sticks in it:
//   trunk   - leaves the body in any direction. Lengths follow a power law:
//             a few long reachers, more medium arms, lots of short buds
//   arm     - a trunk that splits (one-to-many) continues as 2-3 arms
//   merge   - some trunks flow into a neighbour partway out (many-to-one)
//   looper  - arms that curl back into the mass (tangle, cavities)
//   wrapper - strands crawling over the body surface
//   fibre   - hair-thin strands fraying off the tips
//   spike   - short splash points on the body
// The thick parts of all of these are also fused into one implicit surface
// (mass.js), which is what makes junctions read as one material.
export const BODY_R = 0.8;
export const ROOT_DEPTH = 0.7; // trunks start this far out, inside the body

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

// smooth 1D pseudo-noise, cheap enough to run per spine point on the CPU
const wave = (x, seed) =>
  Math.sin(x + seed * 12.9898) * 0.55 +
  Math.sin(x * 2.31 + seed * 4.21) * 0.3 +
  Math.sin(x * 4.13 + seed * 7.77) * 0.15;

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function randomUnit(v) {
  const u = random() * 2 - 1;
  const th = random() * Math.PI * 2;
  const s = Math.sqrt(1 - u * u);
  return v.set(Math.cos(th) * s, u, Math.sin(th) * s);
}

function fibDir(i, n, v) {
  const golden = Math.PI * (3 - Math.sqrt(5));
  const y = 1 - ((i + 0.5) / n) * 2;
  const r = Math.sqrt(1 - y * y);
  return v.set(Math.cos(golden * i) * r, y, Math.sin(golden * i) * r);
}

function makeTendril(kind, props) {
  return {
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
    lag: 1,
    mergeInto: null,
    sMerge: 1,
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

// a curvature wave's sideways swing is curl / k^2 (k = waves per unit
// length), so set curl from the swing we actually want to see
function setSwing(t, amplitude) {
  const k = t.freq / t.len;
  t.curl = amplitude * k * k;
}

export function radiusAt(t, s) {
  return t.r0 + (t.r1 - t.r0) * Math.pow(s, t.taper);
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
        freq: rand(5, 8),
        speed: rand(0.7, 1.2),
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
      setSwing(t, splits ? rand(0.02, 0.05) : rand(0.06, 0.11));
      if (!splits) t.hook = rand(6, 10) * (random() < 0.5 ? -1 : 1);
      t.splits = splits;
    }
    trunks.push(t);
    tendrils.push(t);
  }

  // ---------- many-to-one: some trunks flow into a neighbour ----------
  // half of them are braids: they fuse for a stretch, then split apart again
  for (let i = 0; i < trunks.length; i++) {
    const b = trunks[i];
    // a forking trunk may merge too: two trunks fuse, then fan out into arms
    if (b.cls === 'short' || random() > 0.75) continue;
    let best = null;
    let bestDot = 0.7;
    for (let j = 0; j < i; j++) {
      const a = trunks[j];
      if (a.cls === 'short' || a.mergeInto) continue;
      const d = a.dir.dot(b.dir);
      if (d > bestDot) { bestDot = d; best = a; }
    }
    if (best) {
      b.mergeInto = best;
      b.sMerge = rand(0.25, 0.45);
      b.sUnmerge = random() < 0.5 ? Math.min(0.92, b.sMerge + rand(0.3, 0.45)) : 2;
      if (b.sUnmerge > 1) b.hook = 0;
    }
  }

  // ---------- one-to-many: split trunks continue as 2-3 arms ----------
  const reachers = [];
  for (const t of trunks) {
    if (!t.splits) {
      if (t.cls !== 'short') reachers.push(t);
      continue;
    }
    const n = t.cls === 'long' ? (random() < 0.65 ? 2 : 3) : 2 + pick(2);
    const rest = t.total - t.len;
    for (let c = 0; c < n; c++) {
      const arm = makeTendril('arm', {
        parent: t,
        s0: 1,
        len: t.cls === 'long' ? rest * rand(0.75, 1.15) : rest * rand(0.6, 1.0),
        freq: rand(5, 8),
        speed: rand(0.8, 1.3),
        r0: t.r1 * rand(0.72, 0.85),
        r1: 0.003,
        taper: rand(0.75, 1.0),
        flat: rand(0.6, 0.9),
        bulge: 0.12,
        curlGrow: rand(1.4, 2.2),
        hook: rand(6, 10) * (random() < 0.5 ? -1 : 1),
        spread: t.cls === 'long' ? rand(0.45, 0.8) : rand(0.6, 1.0),
      });
      randomUnit(arm.side);
      setSwing(arm, t.cls === 'long' ? rand(0.06, 0.1) : rand(0.03, 0.06));
      t.children.push(arm);
      tendrils.push(arm);
      if (t.cls === 'long') reachers.push(arm);
    }
  }

  // ---------- body mass: loopers and surface crawlers ----------
  for (let i = 0; i < 16; i++) {
    const t = makeTendril('looper', {
      len: rand(0.7, 1.2),
      freq: rand(0.8, 1.4),
      speed: rand(0.2, 0.45),
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
      speed: rand(0.2, 0.4),
      r0: rand(0.06, 0.1),
      r1: rand(0.015, 0.03),
      taper: 1,
      flat: rand(0.5, 0.8),
      bulge: 0.3,
      lag: 0.6,
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

  for (const r of reachers) r.reacher = true;

  // fibres take their root radius from the parent at the branch point
  for (const t of tendrils) {
    if (t.kind === 'fibre') t.r0 = Math.min(t.r0, radiusAt(t.parent, t.s0) * 0.6);
  }

  // ---------- per-frame growth ----------
  const h = new THREE.Vector3();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const p = new THREE.Vector3();
  const q = new THREE.Vector3();

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
    t.headDir.copy(h);

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
      h.addScaledVector(b, wave(x * 0.83 + 1.7, t.seed + 31) * amp * ds);

      // fibres of an arm that's grabbing reach for the cursor too
      if (t.kind === 'fibre' && t.parent.g > 0.3 && cursor && cursor.active) {
        tmp.copy(cursor.pos).sub(p).normalize();
        h.addScaledVector(tmp, t.parent.g * 14 * ds);
      }

      if (t.hook) {
        const hk = Math.max(0, (s - 0.72) / 0.28);
        h.addScaledVector(a, t.hook * hk * hk * ds);
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

    // many-to-one: past the merge point, flow onto the partner's path. The
    // implicit surface then fuses the two into one thicker strand
    if (t.mergeInto) {
      const m = t.mergeInto;
      for (let k = 1; k < SEGS; k++) {
        const s = k / (SEGS - 1);
        const w =
          smoothstep(t.sMerge, Math.min(1, t.sMerge + 0.25), s) *
          (1 - smoothstep(t.sUnmerge - 0.15, t.sUnmerge, s));
        if (w <= 0) continue;
        const sm = Math.min(1, (s * t.len) / m.len);
        samplePts(m.target, sm, q);
        t.target[k].lerp(q, w);
      }
    }
  }

  // ---------- cursor behaviour ----------
  // The cursor is a stimulus, not a joystick. Each frame the reachers that
  // face it get an interest level from their own boldness: the nearest bold
  // one sniffs toward it, a few lunge and coil around it once it's close,
  // shy ones flinch away from fast movement. Everything else keeps swimming.
  const GRAB_ARMS = 6;
  const GRAB_STRINGS = 10;
  const reach = new THREE.Vector3();
  const goal = new THREE.Vector3();
  const c1 = new THREE.Vector3();
  const toC = new THREE.Vector3();
  const rootPos = new THREE.Vector3();
  let holdTime = 0;
  let cooldown = 0;

  // how far a reacher's tip can get from the body, counting its trunk
  function reachOf(t) {
    return t.kind === 'arm' ? t.parent.len + t.len : t.len;
  }
  function baseDir(t) {
    return t.kind === 'arm' ? t.parent.dir : t.dir;
  }

  function decideInterest(cursor, dt) {
    cooldown = Math.max(0, cooldown - dt);
    for (const t of reachers) t.gTarget = 0;
    for (const t of spikes) t.gTarget = 0;
    if (!cursor.active) {
      holdTime = 0;
      return;
    }

    const d = cursor.pos.length();
    toC.copy(cursor.pos).normalize();
    const ranked = reachers
      .map((t) => ({ t, facing: baseDir(t).dot(toC), reachable: BODY_R * ROOT_DEPTH + reachOf(t) * 1.2 >= d }))
      .filter((r) => r.facing > 0.3)
      .sort((x, y) => y.facing - x.facing);

    const fast = cursor.speed > 6;
    const near = ranked.some((r) => r.reachable);

    if (fast) {
      // sudden movement: shy reachers on that side recoil, bold ones ignore it
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
      // dragged out of reach: let go and whip back
      if (holdTime > 0.5 && !ranked.some((r) => r.reachable && r.t.g > 0.6)) cooldown = 1.2;
    } else {
      holdTime = 0;
      // sniffing: the closest bold reacher leans out toward it
      const lead = ranked.find((r) => r.t.bold > 0.3);
      if (lead && d < BODY_R + reachOf(lead.t) * 1.9) lead.t.gTarget = 0.3;
    }
  }

  // a split trunk whose arm is reaching bends toward the cursor too, so the
  // whole limb moves, not just the fork
  function trunkInterest(t) {
    if (!t.splits) return 0;
    let g = 0;
    for (const c of t.children) g = Math.max(g, c.g);
    return g * 0.6;
  }

  // blend a strand's natural pose toward one reaching for (and coiling around)
  // the cursor; g < 0 pulls it back toward its root instead
  function applyInterest(t, g, cursor, coil) {
    if (Math.abs(g) < 0.002) return;
    rootPos.copy(t.target[0]);

    if (g < 0) {
      for (let k = 1; k < SEGS; k++) t.target[k].sub(rootPos).multiplyScalar(1 + g * 0.45).add(rootPos);
      return;
    }

    goal.copy(cursor.pos).sub(rootPos);
    const dist = goal.length();
    // arms can only stretch so far; the thin strings pay out as needed
    const maxLen = t.kind === 'spike' ? 4 : t.len * 1.25;
    if (!coil) goal.multiplyScalar(Math.min(1, t.len / Math.max(dist, 1e-3)));
    else if (dist > maxLen) goal.multiplyScalar(maxLen / dist);
    goal.add(rootPos);

    const wrapR = t.kind === 'spike' ? 0.05 + 0.08 * t.bold : 0.13 + 0.08 * t.bold;
    // arrive from the root side, then coil the last stretch around the point
    const back = Math.atan2(rootPos.y - goal.y, rootPos.x - goal.x);
    const sArrive = coil ? 0.8 : 1;
    c1.copy(t.headDir).multiplyScalar(Math.min(dist, t.len) * 0.45).add(rootPos);

    for (let k = 1; k < SEGS; k++) {
      const s = k / (SEGS - 1);
      if (s <= sArrive) {
        const u = s / sArrive;
        const iu = 1 - u;
        const ex = goal.x + (coil ? Math.cos(back) * wrapR : 0);
        const ey = goal.y + (coil ? Math.sin(back) * wrapR : 0);
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
        const ex = Math.cos(ang) * r;
        const ey = Math.sin(ang) * r * (0.55 + 0.45 * Math.cos(t.wrapTilt));
        reach.set(
          goal.x + t.wrapOff.x * u + ex,
          goal.y + t.wrapOff.y * u + ey,
          goal.z + Math.sin(ang) * r * Math.sin(t.wrapTilt)
        );
      }
      // the root stays put; the reach takes over along the strand
      t.target[k].lerp(reach, g * Math.min(1, s / 0.3));
    }
  }

  function update(dt, time, cursor) {
    decideInterest(cursor, dt);
    for (const t of reachers.concat(spikes)) {
      // bold ones lunge; letting go is fast for everyone
      const rate = t.gTarget > t.g ? 2 + 6 * t.bold : 5;
      t.g += (t.gTarget - t.g) * (1 - Math.exp(-dt * rate));
    }

    for (const t of tendrils) {
      grow(t, time, cursor);
      if (t.kind === 'trunk' && t.splits) applyInterest(t, trunkInterest(t), cursor, false);
      else if (t.reacher || t.kind === 'spike') applyInterest(t, t.g, cursor, true);

      if (t.fresh) {
        for (let k = 0; k < SEGS; k++) t.pts[k].copy(t.target[k]);
        t.fresh = false;
        continue;
      }
      // damped springs toward the target, looser toward the tip: fluid lag,
      // and a little overshoot so a released arm whips back
      t.pts[0].copy(t.target[0]);
      for (let k = 1; k < SEGS; k++) {
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

  // ---------- webbing ----------
  // films between neighbouring trunks just outside the body, and in the
  // crotch of every fork (the web between fingers)
  const pairs = [];
  const idx = (t) => tendrils.indexOf(t);
  for (let i = 0; i < trunks.length; i++) {
    const ta = trunks[i];
    if (ta.cls === 'short') continue;
    for (let j = i + 1; j < trunks.length; j++) {
      const tb = trunks[j];
      if (tb.cls === 'short' || ta.dir.dot(tb.dir) < 0.82 || random() > 0.6) continue;
      const start = (BODY_R * (0.92 - ROOT_DEPTH)) / Math.min(ta.len, tb.len);
      pairs.push({ a: idx(ta), b: idx(tb), start, reach: start + rand(0.15, 0.28) });
    }
  }
  for (const t of trunks) {
    for (let c = 0; c + 1 < t.children.length; c++) {
      pairs.push({ a: idx(t.children[c]), b: idx(t.children[c + 1]), start: 0, reach: rand(0.22, 0.38) });
    }
  }

  return { tendrils, pairs, update };
}
