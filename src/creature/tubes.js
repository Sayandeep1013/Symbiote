import * as THREE from 'three';
import { GOO_VERTEX_PARS, patchGoo } from './goo.js';

// Every tendril, branch, fibre and spike is one instance of the same template
// tube. Its spine (SEGS points + a reference normal per point) lives in a row
// of two float textures that the CPU rig rewrites each frame; the vertex
// shader bends the template along that spine with a Catmull-Rom curve.
// This keeps hundreds of strands to one draw call.
//
// Two radius profiles:
//   0 tendril  - tapers from r0 to r1, with bulges travelling outward
//   1 string   - a stretched bridge of goo: blobs where it's attached at each
//                end (r0, r1), a thin middle (rMid) and beads along it

export const SEGS = 20;
const RINGS = 40;
const RADIAL = 10;

export function createTubes(count, material, gooU) {
  // template: (t along the strand 0..1, angle around it)
  const verts = RINGS * (RADIAL + 1);
  const tube = new Float32Array(verts * 2);
  let v = 0;
  for (let r = 0; r < RINGS; r++) {
    // rings bunch toward the tip where curvature and taper change fastest
    const t = Math.pow(r / (RINGS - 1), 0.85);
    for (let a = 0; a <= RADIAL; a++) {
      tube[v++] = t;
      tube[v++] = (a / RADIAL) * Math.PI * 2;
    }
  }
  const index = [];
  for (let r = 0; r < RINGS - 1; r++) {
    for (let a = 0; a < RADIAL; a++) {
      const i0 = r * (RADIAL + 1) + a;
      const i1 = i0 + RADIAL + 1;
      index.push(i0, i1, i0 + 1, i0 + 1, i1, i1 + 1);
    }
  }

  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts * 3), 3));
  geo.setAttribute('aTube', new THREE.BufferAttribute(tube, 2));
  geo.setIndex(index);
  geo.instanceCount = count;

  const row = new Float32Array(count);
  for (let i = 0; i < count; i++) row[i] = i;
  // x: root radius, y: tip radius, z: taper exponent, w: cross-section flatness
  const shape = new Float32Array(count * 4);
  // x: seed, y: bulge amount, z: length, w: profile
  const extra = new Float32Array(count * 4);
  // x: travelling-bulge speed; strings only: y: middle radius, z: bead
  // radius, w: bead count
  const goo = new Float32Array(count * 4);
  geo.setAttribute('aRow', new THREE.InstancedBufferAttribute(row, 1));
  const shapeAttr = new THREE.InstancedBufferAttribute(shape, 4);
  const extraAttr = new THREE.InstancedBufferAttribute(extra, 4);
  const gooAttr = new THREE.InstancedBufferAttribute(goo, 4);
  for (const a of [shapeAttr, extraAttr, gooAttr]) a.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aShape', shapeAttr);
  geo.setAttribute('aExtra', extraAttr);
  geo.setAttribute('aGoo', gooAttr);

  const posData = new Float32Array(SEGS * count * 4);
  const nrmData = new Float32Array(SEGS * count * 4);
  const posTex = new THREE.DataTexture(posData, SEGS, count, THREE.RGBAFormat, THREE.FloatType);
  const nrmTex = new THREE.DataTexture(nrmData, SEGS, count, THREE.RGBAFormat, THREE.FloatType);
  posTex.needsUpdate = true;
  nrmTex.needsUpdate = true;

  const uniforms = {
    uSpinePos: { value: posTex },
    uSpineNrm: { value: nrmTex },
    uTime: { value: 0 },
  };

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    patchGoo(shader, gooU);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
${GOO_VERTEX_PARS}
uniform sampler2D uSpinePos;
uniform sampler2D uSpineNrm;
uniform float uTime;
attribute vec2 aTube;
attribute float aRow;
attribute vec4 aShape;
attribute vec4 aExtra;
attribute vec4 aGoo;

vec3 spineP(int i, int row){ return texelFetch(uSpinePos, ivec2(clamp(i, 0, ${SEGS - 1}), row), 0).xyz; }
vec3 spineN(int i, int row){ return texelFetch(uSpineNrm, ivec2(clamp(i, 0, ${SEGS - 1}), row), 0).xyz; }
`)
      .replace('#include <beginnormal_vertex>', `
int sRow = int(aRow + 0.5);
float sT = aTube.x;
float sF = sT * float(${SEGS - 1});
int sI = int(floor(sF));
float sU = sF - float(sI);
if (sI >= ${SEGS - 1}) { sI = ${SEGS - 2}; sU = 1.0; }

vec3 q0 = spineP(sI - 1, sRow);
vec3 q1 = spineP(sI, sRow);
vec3 q2 = spineP(sI + 1, sRow);
vec3 q3 = spineP(sI + 2, sRow);
vec3 ca = 2.0 * q0 - 5.0 * q1 + 4.0 * q2 - q3;
vec3 cb = -q0 + 3.0 * q1 - 3.0 * q2 + q3;
vec3 sPos = 0.5 * (2.0 * q1 + (q2 - q0) * sU + ca * sU * sU + cb * sU * sU * sU);
vec3 sTan = normalize(0.5 * ((q2 - q0) + 2.0 * ca * sU + 3.0 * cb * sU * sU) + 1e-6);

vec3 sRef = mix(spineN(sI, sRow), spineN(sI + 1, sRow), sU);
vec3 sNrm = normalize(sRef - sTan * dot(sRef, sTan) + 1e-6);
vec3 sBin = cross(sTan, sNrm);

float sLen = aExtra.z;
float sR;
if (aExtra.w < 0.5) {
  // taper, plus bulges travelling outward along it (peristalsis) so strands
  // aren't machined cones. Mirrored by radiusAt() in rig.js for the mass
  sR = mix(aShape.x, aShape.y, pow(sT, aShape.z));
  sR *= 1.0 + aExtra.y * sin(sT * 19.0 + aExtra.x * 7.0 - uTime * aGoo.x) * (1.0 - sT);
} else {
  // a goo string: blobs at the attached ends, a thin middle, beads
  float e0 = exp(-sT * sLen / max(aShape.x * 2.5, 1e-4));
  float e1 = exp(-(1.0 - sT) * sLen / max(aShape.y * 2.5, 1e-4));
  sR = aGoo.y + (aShape.x - aGoo.y) * e0 + (aShape.y - aGoo.y) * e1;
  sR += aGoo.z * pow(max(0.0, sin(sT * aGoo.w * PI)), 8.0);
}
float sA = aTube.y;
float sFlat = aShape.w;
vec3 tubePos = sPos + sNrm * cos(sA) * sR + sBin * sin(sA) * sR * sFlat;
vec3 objectNormal = normalize(sNrm * cos(sA) * sFlat + sBin * sin(sA));

// goo pattern: stretched along the strand (fibrous grooves that run with it),
// tight around it; bump height follows the radius so thin threads stay smooth
const float GOO_FA = 18.0;
const float GOO_FR = 26.0;
vGoo = vec3(sT * sLen * GOO_FA, cos(sA) * sR * GOO_FR, sin(sA) * sR * GOO_FR) + aExtra.x * vec3(1.3, 0.7, 0.9);
vGooJ0 = sTan * GOO_FA;
vGooJ1 = sNrm * GOO_FR;
vGooJ2 = sBin * (GOO_FR / max(sFlat, 0.3));
vGooAmp = min(0.0055, sR * 0.06);
vGooAO = aExtra.w < 0.5 ? mix(0.6, 1.0, smoothstep(0.0, 0.3, sT)) : 1.0;
vGooDry = gooDryAt(vec3(vGoo.x, aExtra.x, 0.0));
#ifdef USE_TANGENT
  vec3 objectTangent = sTan;
#endif
`)
      .replace('#include <begin_vertex>', 'vec3 transformed = tubePos;');
  };
  material.customProgramCacheKey = () => 'symbiote-tubes';

  const mesh = new THREE.Mesh(geo, material);
  mesh.frustumCulled = false;

  return {
    mesh,
    posTex,
    shape,
    extra,
    goo,
    posData,
    nrmData,
    commit() {
      shapeAttr.needsUpdate = true;
      extraAttr.needsUpdate = true;
      gooAttr.needsUpdate = true;
    },
    upload(time) {
      uniforms.uTime.value = time;
      posTex.needsUpdate = true;
      nrmTex.needsUpdate = true;
    },
  };
}
