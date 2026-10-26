import * as THREE from 'three';
import { BODY_R } from './rig.js';
import { SNOISE } from './noise.js';

// A torn film of goo wrapped loosely around the core. Big noise-driven holes
// open into the darker body underneath, and every hole has a glossy rim:
// that's the "liquid mass with cavities" in the reference, which a solid
// lumpy sphere can't give.
export function createShell(material) {
  const geo = new THREE.IcosahedronGeometry(BODY_R * 1.12, 40);
  const uniforms = { uTime: { value: 0 } };

  material.side = THREE.DoubleSide;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
uniform float uTime;
varying vec3 vShellDir;
${SNOISE}
vec3 shellPos(vec3 d){
  float n = snoise(d * 1.8 + vec3(uTime * 0.1, 0.0, -uTime * 0.07));
  return d * (${(BODY_R * 1.12).toFixed(3)} * (1.0 + 0.12 * n));
}
`)
      .replace('#include <beginnormal_vertex>', `
vec3 shD = normalize(position);
vec3 shT = normalize(cross(shD, abs(shD.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
vec3 shB = cross(shD, shT);
vec3 shP = shellPos(shD);
vec3 objectNormal = normalize(cross(shellPos(normalize(shD + shT * 0.01)) - shP, shellPos(normalize(shD + shB * 0.01)) - shP));
vShellDir = shD;
`)
      .replace('#include <begin_vertex>', 'vec3 transformed = shP;');

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
uniform float uTime;
varying vec3 vShellDir;
${SNOISE}
`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
// slowly drifting holes: the film tears open and closes over the core
float shHoles = snoise(vShellDir * 2.6 + vec3(0.0, uTime * 0.06, 0.0)) * 0.75
              + snoise(vShellDir * 7.0 - uTime * 0.05) * 0.25;
if (shHoles > 0.05) discard;
`);
  };
  material.customProgramCacheKey = () => 'symbiote-shell';

  const mesh = new THREE.Mesh(geo, material);
  return {
    mesh,
    update(time) {
      uniforms.uTime.value = time;
    },
  };
}
