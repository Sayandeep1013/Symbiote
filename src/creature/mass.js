import * as THREE from 'three';
import { SEGS } from './tubes.js';
import { BODY_R, radiusAt } from './rig.js';
import { MASS } from './massConfig.js';

// One implicit surface for everything thick: the body, trunk roots, forks,
// merges and loopers. Strands that come close fuse with a fillet, which is
// what makes the creature read as one organic material instead of tubes
// pushed into a ball. Thin strands fade out of the field and carry on as the
// tube meshes, so the tubes appear to grow out of the mass.
//
// Stamping the field and running marching cubes costs ~20ms of CPU, so it
// runs in a worker; this side ships it the strands and swaps in each result.

if (MASS.BODY_R !== BODY_R) throw new Error('massConfig BODY_R out of sync with rig');

const MASS_KINDS = new Set(['trunk', 'arm', 'looper', 'wrapper']);
const FLOATS_PER_SEG = 10;

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function createMass(rig, material) {
  const strands = rig.tendrils.filter((t) => MASS_KINDS.has(t.kind));
  const maxSegs = strands.length * (SEGS - 1);

  const geometry = new THREE.BufferGeometry();
  const maxVerts = MASS.MAX_POLYS * 3;
  const position = new THREE.BufferAttribute(new Float32Array(maxVerts * 3), 3);
  const normal = new THREE.BufferAttribute(new Float32Array(maxVerts * 3), 3);
  position.setUsage(THREE.DynamicDrawUsage);
  normal.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', position);
  geometry.setAttribute('normal', normal);
  geometry.setDrawRange(0, 0);

  const mesh = new THREE.Mesh(geometry, material);
  // the worker polygonizes in [-1, 1]
  mesh.scale.setScalar(MASS.HALF);
  mesh.frustumCulled = false;

  const worker = new Worker(new URL('./massWorker.js', import.meta.url), { type: 'module' });
  let busy = false;
  // buffers ping-pong with the worker (transferred, not copied)
  let segs = new Float32Array(maxSegs * FLOATS_PER_SEG);
  let strandEnds = new Int32Array(strands.length);

  worker.onmessage = (e) => {
    const d = e.data;
    position.array.set(d.positions);
    normal.array.set(d.normals);
    for (const attr of [position, normal]) {
      attr.clearUpdateRanges();
      attr.addUpdateRange(0, d.count * 3);
      attr.needsUpdate = true;
    }
    geometry.setDrawRange(0, d.count);
    segs = d.segs;
    strandEnds = d.strandEnds;
    busy = false;
  };

  function update(time) {
    // only ever one job in flight: the surface follows the latest pose
    if (busy) return;
    let n = 0;
    strands.forEach((t, si) => {
      for (let k = 0; k < SEGS - 1; k++) {
        const ra = radiusAt(t, k / (SEGS - 1));
        const rb = radiusAt(t, (k + 1) / (SEGS - 1));
        if (ra < MASS.R_MIN * 0.8 && rb < MASS.R_MIN * 0.8) break;
        const a = t.pts[k];
        const b = t.pts[k + 1];
        const o = n * FLOATS_PER_SEG;
        segs[o] = a.x; segs[o + 1] = a.y; segs[o + 2] = a.z;
        segs[o + 3] = b.x; segs[o + 4] = b.y; segs[o + 5] = b.z;
        segs[o + 6] = ra; segs[o + 7] = rb;
        // fade a strand out of the mass gradually as it thins, so the surface
        // narrows onto its tube instead of stepping down to it at a collar
        segs[o + 8] = smoothstep(MASS.R_MIN * 0.8, MASS.R_MIN * 2.8, ra);
        segs[o + 9] = smoothstep(MASS.R_MIN * 0.8, MASS.R_MIN * 2.8, rb);
        n++;
      }
      strandEnds[si] = n;
    });
    busy = true;
    worker.postMessage({ segs, strandEnds, time }, [segs.buffer, strandEnds.buffer]);
  }

  return { mesh, update };
}
