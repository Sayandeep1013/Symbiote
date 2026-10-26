import * as THREE from 'three';
import { SEGS } from './tubes.js';

// Sticky goo strings (docs/VENOM_GOO_PROPERTIES.md, B3-B7). Wherever goo
// comes apart - strands unzipping, tips that touched, an arm letting go of
// the cursor - a bridge of goo stays stretched between the two sides:
//   - its volume is conserved, so it thins as it stretches: r = sqrt(V / pi L)
//   - once thin it forms beads on a string and its middle thins faster
//   - it sags with its weight, less as it pulls taut
//   - it snaps when too thin or too long, and each half whips back to its
//     anchor as a tail with a drop on the end, and is absorbed
// Each string is drawn as one more instance of the tube mesh.

const DOWN = new THREE.Vector3(0, -1, 0);
const MAX_LEN = 1.15;
const SNAP_R = 0.0016;
const TAIL_LIFE = 0.9;

export function createStrings(capacity, { anchorPos, anchorRadius }) {
  const items = Array.from({ length: capacity }, (_, i) => ({
    active: false,
    seed: i * 7.31,
    ref: new THREE.Vector3(0, 0, 1),
    pts: Array.from({ length: SEGS }, () => new THREE.Vector3()),
    vel: Array.from({ length: SEGS }, () => new THREE.Vector3()),
    target: Array.from({ length: SEGS }, () => new THREE.Vector3()),
    A: null,
    B: null,
    free: new THREE.Vector3(),
    freeVel: new THREE.Vector3(),
    tail: false,
    volume: 0,
    rInit: 0,
    nBeads: 3,
    age: 0,
    // render parameters, read by main.js
    len: 0,
    rA: 0,
    rB: 0,
    rMid: 0,
    bead: 0,
  }));

  const pA = new THREE.Vector3();
  const pB = new THREE.Vector3();
  const tmp = new THREE.Vector3();

  function take() {
    return items.find((it) => !it.active) || null;
  }

  function reset(it) {
    it.active = true;
    it.age = 0;
    it.seed = Math.random() * 100;
    it.ref.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
  }

  function layStraight(it, a, b) {
    for (let k = 0; k < SEGS; k++) {
      it.pts[k].lerpVectors(a, b, k / (SEGS - 1));
      it.vel[k].set(0, 0, 0);
    }
  }

  // a bridge between two anchors. An anchor is { t, s } (a material point on
  // a tendril) or { cursor: true }
  function spawnBridge(A, B, r) {
    const it = take();
    if (!it) return null;
    reset(it);
    it.A = A;
    it.B = B;
    it.tail = false;
    anchorPos(A, pA);
    anchorPos(B, pB);
    // it's born short and fat; the length it's born with sets its volume
    const L0 = Math.max(pA.distanceTo(pB), 0.04);
    it.rInit = r;
    it.volume = Math.PI * r * r * L0;
    // a string born long (thrown at the cursor) can stretch further
    it.maxLen = Math.max(MAX_LEN, L0 * 1.5);
    it.nBeads = 2 + Math.floor(Math.random() * 4);
    layStraight(it, pA, pB);
    return it;
  }

  function spawnTail(A, freePos, freeVel, r) {
    const it = take();
    if (!it) return null;
    reset(it);
    it.A = A;
    it.B = null;
    it.tail = true;
    it.rInit = r;
    it.free.copy(freePos);
    it.freeVel.copy(freeVel);
    anchorPos(A, pA);
    layStraight(it, pA, freePos);
    return it;
  }

  function snap(it) {
    // break at the thinnest point (the middle); each half recoils
    const mid = it.pts[SEGS >> 1];
    const midVel = it.vel[SEGS >> 1];
    const B = it.B;
    it.tail = true;
    it.B = null;
    it.age = 0;
    it.free.copy(mid);
    it.freeVel.copy(midVel);
    if (B && !B.cursor) spawnTail(B, mid, midVel, it.rInit);
  }

  function update(dt, cursor) {
    for (const it of items) {
      if (!it.active) continue;
      it.age += dt;
      if (!anchorPos(it.A, pA)) {
        it.active = false;
        continue;
      }

      if (!it.tail) {
        if ((it.B.cursor && !cursor.active) || !anchorPos(it.B, pB)) {
          snap(it);
        } else {
          const L = pA.distanceTo(pB);
          const rMid = Math.sqrt(it.volume / (Math.PI * Math.max(L, 1e-3)));
          // beads on a string: past a point the middle thins on its own
          // and evenly spaced beads swell along it
          const q = rMid / it.rInit;
          const beading = 1 - THREE.MathUtils.smoothstep(q, 0.25, 0.65);
          it.rMid = rMid * (1 - 0.65 * beading);
          it.bead = rMid * 1.5 * beading;
          it.len = L;
          if (it.rMid < SNAP_R || L > it.maxLen || it.age > 6) snap(it);
        }
      }

      if (it.tail) {
        // the free end whips back to its anchor, overshoots, and is absorbed
        tmp.subVectors(pA, it.free).multiplyScalar(70);
        tmp.addScaledVector(it.freeVel, -7).addScaledVector(DOWN, 1.2);
        it.freeVel.addScaledVector(tmp, dt);
        it.free.addScaledVector(it.freeVel, dt);
        pB.copy(it.free);
        it.len = pA.distanceTo(pB);
        const life = 1 - it.age / TAIL_LIFE;
        if (life <= 0 || (it.age > 0.15 && it.len < 0.012)) {
          it.active = false;
          continue;
        }
        it.rMid = 0.0025 * life;
        it.bead = 0;
      }

      // end blobs: where it's stuck on, and the drop on a tail's free end
      it.rA = Math.max(it.rMid, anchorRadius(it.A));
      it.rB = it.tail ? 0.009 * (1 - it.age / TAIL_LIFE) + it.rMid : Math.max(it.rMid, anchorRadius(it.B));

      // everything sags a little; heavy, slack strings sag most
      const sag = it.tail ? 0 : it.len * (0.07 + 0.18 * Math.min(1, it.rMid / it.rInit));
      for (let k = 0; k < SEGS; k++) {
        const u = k / (SEGS - 1);
        it.target[k].lerpVectors(pA, pB, u).addScaledVector(DOWN, sag * Math.sin(Math.PI * u));
      }
      it.pts[0].copy(pA);
      it.pts[SEGS - 1].copy(pB);
      // springy, so a string wobbles when its ends move
      const w = 22;
      for (let k = 1; k < SEGS - 1; k++) {
        const v = it.vel[k];
        tmp.subVectors(it.target[k], it.pts[k]).multiplyScalar(w * w);
        tmp.addScaledVector(v, -0.9 * w);
        v.addScaledVector(tmp, dt);
        it.pts[k].addScaledVector(v, dt);
      }
    }
  }

  // how many strings hang off one tendril, so one strand doesn't turn into
  // a comb
  function countOn(t) {
    let n = 0;
    for (const it of items) if (it.active && ((it.A && it.A.t === t) || (it.B && it.B.t === t))) n++;
    return n;
  }

  return { items, spawnBridge, update, countOn, activeCount: () => items.filter((i) => i.active).length };
}
