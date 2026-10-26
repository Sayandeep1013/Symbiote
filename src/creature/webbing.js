import * as THREE from 'three';
import { SEGS } from './tubes.js';
import { SNOISE } from './noise.js';
import { GOO_VERTEX_PARS, patchGoo } from './goo.js';

// Membranes stretched between the bases of neighbouring arms, like the
// webbing in a splash crown. They read the same spine texture as the tubes,
// so they move with the arms for free. The free edge is scalloped and the
// sheet is eaten through with holes that grow toward that edge: a lacy,
// torn film instead of a solid fin.

const U_SEGS = 24;
const V_SEGS = 24;

export function createWebbing(pairs, posTex, material, gooU) {
  const verts = (U_SEGS + 1) * (V_SEGS + 1);
  const grid = new Float32Array(verts * 2);
  let n = 0;
  for (let v = 0; v <= V_SEGS; v++) {
    for (let u = 0; u <= U_SEGS; u++) {
      grid[n++] = u / U_SEGS;
      grid[n++] = v / V_SEGS;
    }
  }
  const index = [];
  for (let v = 0; v < V_SEGS; v++) {
    for (let u = 0; u < U_SEGS; u++) {
      const i0 = v * (U_SEGS + 1) + u;
      const i1 = i0 + U_SEGS + 1;
      index.push(i0, i1, i0 + 1, i0 + 1, i1, i1 + 1);
    }
  }

  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts * 3), 3));
  geo.setAttribute('aWeb', new THREE.BufferAttribute(grid, 2));
  geo.setIndex(index);
  geo.instanceCount = pairs.length;

  // x,y: spine rows of the two arms; z: where the web starts along them,
// w: how far up the arms it reaches (fractions of arm length)
  const pairData = new Float32Array(pairs.length * 4);
  const seedData = new Float32Array(pairs.length);
  pairs.forEach((p, i) => {
    pairData.set([p.a, p.b, p.start, p.reach], i * 4);
    seedData[i] = Math.random() * 50;
  });
  // start/reach change at runtime: a sticky film stretches further up the
  // arms while they pull apart
  const pairAttr = new THREE.InstancedBufferAttribute(pairData, 4);
  pairAttr.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aPair', pairAttr);
  geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seedData, 1));

  const SPINE = `
vec3 wSpineP(int i, int row){ return texelFetch(uSpinePos, ivec2(clamp(i, 0, ${SEGS - 1}), row), 0).xyz; }
vec3 wSpineAt(int row, float s){
  float f = clamp(s, 0.0, 1.0) * float(${SEGS - 1});
  int i = int(floor(f));
  float u = f - float(i);
  if (i >= ${SEGS - 1}) { i = ${SEGS - 2}; u = 1.0; }
  vec3 q0 = wSpineP(i - 1, row), q1 = wSpineP(i, row), q2 = wSpineP(i + 1, row), q3 = wSpineP(i + 2, row);
  return 0.5 * (2.0 * q1 + (q2 - q0) * u + (2.0 * q0 - 5.0 * q1 + 4.0 * q2 - q3) * u * u + (-q0 + 3.0 * q1 - 3.0 * q2 + q3) * u * u * u);
}
vec3 webPos(vec2 w){
  int ra = int(aPair.x + 0.5);
  int rb = int(aPair.y + 0.5);
  float s = mix(aPair.z, aPair.w, w.y);
  vec3 pa = wSpineAt(ra, s);
  vec3 pb = wSpineAt(rb, s);
  vec3 p = mix(pa, pb, w.x);
  // the film sags back toward the body between the two arms
  float sag = sin(3.14159 * w.x) * (0.2 + 0.8 * w.y);
  // ripples in the film break reflections into streaks; a flat sheet
  // mirrors a whole light strip and blows out white
  float ripple = sin(w.x * 15.0 + w.y * 9.0 + aSeed) * sin(w.y * 13.0 - w.x * 5.0 + aSeed * 1.7);
  float d = distance(pa, pb);
  return p - normalize(p) * (sag * d * 0.22 + ripple * d * 0.1 * sin(3.14159 * w.x));
}`;

  material.side = THREE.DoubleSide;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uSpinePos = { value: posTex };
    patchGoo(shader, gooU);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
${GOO_VERTEX_PARS}
uniform sampler2D uSpinePos;
attribute vec2 aWeb;
attribute vec4 aPair;
attribute float aSeed;
varying vec2 vWeb;
varying vec3 vWebObj;
varying float vSeed;
${SPINE}
`)
      .replace('#include <beginnormal_vertex>', `
vec3 wP = webPos(aWeb);
vec3 wPu = webPos(aWeb + vec2(0.02, 0.0));
vec3 wPv = webPos(aWeb + vec2(0.0, 0.02));
vec3 wN = cross(wPu - wP, wPv - wP);
// where the two arms nearly touch the sheet has no width and the cross
// product degenerates: fall back to facing outward instead of a random normal
vec3 objectNormal = dot(wN, wN) > 1e-12 ? normalize(wN) : normalize(wP);
vWeb = aWeb;
vWebObj = wP;
vSeed = aSeed;
vGoo = wP * 6.0 + aSeed;
vGooJ0 = vec3(6.0, 0.0, 0.0);
vGooJ1 = vec3(0.0, 6.0, 0.0);
vGooJ2 = vec3(0.0, 0.0, 6.0);
// thin films: the holes are their texture, a bump on top is not worth its cost
vGooAmp = 0.0;
vGooDry = gooDryAt(vGoo);
// films sit in the crotches between arms: partly shut in
vGooAO = 0.75;
`)
      .replace('#include <begin_vertex>', 'vec3 transformed = wP;');

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec2 vWeb;
varying vec3 vWebObj;
varying float vSeed;
${SNOISE}
`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
// scalloped free edge: the film climbs the arms and dips between them
float edge = 1.0 - 0.6 * sin(3.14159 * vWeb.x) - 0.1 * snoise(vec3(vWeb.x * 6.0, vSeed, 0.0));
if (vWeb.y > edge) discard;
// holes, more of them toward the torn edge
float holes = snoise(vWebObj * 5.5 + vSeed) * 0.7 + snoise(vWebObj * 14.0 - vSeed) * 0.3;
float thr = 0.55 - 0.6 * smoothstep(0.2, 1.0, vWeb.y / max(edge, 0.01));
if (holes > thr) discard;
`);
  };
  material.customProgramCacheKey = () => 'symbiote-webbing';

  const mesh = new THREE.Mesh(geo, material);
  mesh.frustumCulled = false;
  return {
    mesh,
    update() {
      pairs.forEach((p, i) => {
        pairData[i * 4 + 2] = p.start;
        pairData[i * 4 + 3] = p.reach;
      });
      pairAttr.needsUpdate = true;
    },
  };
}
