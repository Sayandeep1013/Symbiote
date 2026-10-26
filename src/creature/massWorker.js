import { MarchingCubes } from 'three/examples/jsm/objects/MarchingCubes.js';
import { MASS } from './massConfig.js';

// Builds the fused implicit surface off the main thread: stamp every thick
// strand and the body into a density field, then polygonize it.

const { RES, HALF, SUPPORT, ISO, BODY_R, BODY_BLEND, MAX_POLYS } = MASS;

// never rendered here; the addon only reads material.flatShading
const mc = new MarchingCubes(RES, { flatShading: false }, false, false, MAX_POLYS);
mc.isolation = ISO;
const size = mc.size;
const size2 = mc.size2;
const half = mc.halfsize;
const field = mc.field;

// per-strand scratch: kernels along one strand combine with max (no bulge at
// segment joints), then the strand is summed into the field (soft union, so
// strands that come close fuse with a fillet)
const scratch = new Float32Array(mc.size3);
const touched = new Int32Array(mc.size3);

const toGrid = (v) => (v / HALF) * half + half;
const toWorld = (i) => ((i - half) / half) * HALF;

function stampSegment(s, o, nTouched) {
  const ax = s[o], ay = s[o + 1], az = s[o + 2];
  const bx = s[o + 3], by = s[o + 4], bz = s[o + 5];
  const ra = s[o + 6], rb = s[o + 7], wa = s[o + 8], wb = s[o + 9];
  const rMax = Math.max(ra, rb) * SUPPORT;
  const x0 = Math.max(1, Math.floor(toGrid(Math.min(ax, bx) - rMax)));
  const x1 = Math.min(size - 2, Math.ceil(toGrid(Math.max(ax, bx) + rMax)));
  const y0 = Math.max(1, Math.floor(toGrid(Math.min(ay, by) - rMax)));
  const y1 = Math.min(size - 2, Math.ceil(toGrid(Math.max(ay, by) + rMax)));
  const z0 = Math.max(1, Math.floor(toGrid(Math.min(az, bz) - rMax)));
  const z1 = Math.min(size - 2, Math.ceil(toGrid(Math.max(az, bz) + rMax)));
  const dx = bx - ax, dy = by - ay, dz = bz - az;
  const len2 = Math.max(dx * dx + dy * dy + dz * dz, 1e-8);

  for (let z = z0; z <= z1; z++) {
    const pz = toWorld(z) - az;
    for (let y = y0; y <= y1; y++) {
      const py = toWorld(y) - ay;
      const row = z * size2 + y * size;
      for (let x = x0; x <= x1; x++) {
        const px = toWorld(x) - ax;
        let h = (px * dx + py * dy + pz * dz) / len2;
        h = h < 0 ? 0 : h > 1 ? 1 : h;
        const qx = px - dx * h, qy = py - dy * h, qz = pz - dz * h;
        const r = (ra + (rb - ra) * h) * SUPPORT;
        const d2 = (qx * qx + qy * qy + qz * qz) / (r * r);
        if (d2 >= 1) continue;
        const k = 1 - d2;
        const v = k * k * k * (wa + (wb - wa) * h);
        const i = row + x;
        const old = scratch[i];
        if (old === 0) touched[nTouched++] = i;
        if (v > old) scratch[i] = v;
      }
    }
  }
  return nTouched;
}

function stampBody(time) {
  // lumpy, slowly churning core; the fillet width lets every root fuse in
  const reach = BODY_R * 1.25 + BODY_BLEND;
  const g0 = Math.max(1, Math.floor(toGrid(-reach)));
  const g1 = Math.min(size - 2, Math.ceil(toGrid(reach)));
  for (let z = g0; z <= g1; z++) {
    const pz = toWorld(z);
    for (let y = g0; y <= g1; y++) {
      const py = toWorld(y);
      const row = z * size2 + y * size;
      for (let x = g0; x <= g1; x++) {
        const px = toWorld(x);
        const r = Math.sqrt(px * px + py * py + pz * pz) + 1e-6;
        if (r > reach) continue;
        const ux = px / r, uy = py / r, uz = pz / r;
        const lump =
          0.13 * Math.sin(ux * 2.3 + time * 0.35 + Math.sin(uy * 1.9)) * Math.sin(uz * 2.1 - time * 0.27) +
          0.07 * Math.sin(uy * 4.1 - time * 0.4 + uz * 2.0) * Math.sin(ux * 3.7 + time * 0.3) +
          0.03 * Math.sin((ux + uz) * 7.3 + time * 0.5);
        const sd = r - BODY_R * (1 + lump);
        if (sd >= BODY_BLEND) continue;
        const k = 1 - sd / BODY_BLEND;
        field[row + x] += ISO * k * k;
      }
    }
  }
}

self.onmessage = (e) => {
  const { segs, strandEnds, time } = e.data;
  field.fill(0);
  mc.normal_cache.fill(0);
  stampBody(time);

  let seg = 0;
  for (let s = 0; s < strandEnds.length; s++) {
    let nTouched = 0;
    for (; seg < strandEnds[s]; seg++) nTouched = stampSegment(segs, seg * 10, nTouched);
    for (let n = 0; n < nTouched; n++) {
      const i = touched[n];
      field[i] += scratch[i];
      scratch[i] = 0;
    }
  }

  mc.update();
  const n = mc.count * 3;
  const positions = mc.positionArray.slice(0, n);
  const normals = mc.normalArray.slice(0, n);
  self.postMessage({ positions, normals, count: mc.count, segs, strandEnds }, [
    positions.buffer,
    normals.buffer,
    segs.buffer,
    strandEnds.buffer,
  ]);
};
