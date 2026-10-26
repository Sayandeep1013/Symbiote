import * as THREE from 'three';
import { SNOISE } from './noise.js';

// The goo surface, shared by every mesh of the creature (see
// docs/VENOM_GOO_PROPERTIES.md, section A):
//   - semi-dry, smeared gloss: a low-frequency "smear" field mixes wet patches
//     (low roughness, strong clearcoat) with satin ones, so it never reads as
//     black chrome
//   - micro relief: the normal is bent by the analytic gradient of a noise
//     height field, which breaks highlights into flecks. Analytic, because
//     screen-space derivatives of fine noise come out in 2x2 pixel blocks
//   - dark cavities: a per-vertex occlusion term kills reflections in folds
//
// Each mesh's vertex shader supplies, in creature space:
//   vGoo          goo-space coordinate of the point (sets the pattern)
//   vGooJ0..2     the creature-space directions of goo x, y, z, scaled by
//                 their frequency (the Jacobian), to carry gradients back out
//   vGooAmp       bump height in creature units
//   vGooAO        occlusion, 1 = open, 0 = buried
//   vGooDry       0 = wet patch, 1 = satin patch (from gooDryAt)

export function gooUniforms(params = {}) {
  return {
    uGooTime: { value: 0 },
    // creature space -> view space, for the bump gradient
    uGooView: { value: new THREE.Matrix3() },
    // x: wet, y: dry
    uGooRough: { value: new THREE.Vector2(...(params.rough || [0.28, 0.62])) },
    uGooCoat: { value: new THREE.Vector2(...(params.coat || [1.0, 0.2])) },
    uGooCoatRough: { value: new THREE.Vector2(...(params.coatRough || [0.06, 0.32])) },
    // how much of the surface is wet: shifts the smear threshold
    uGooWet: { value: params.wet ?? 0.0 },
  };
}

export const GOO_VERTEX_PARS = `
${SNOISE}
uniform float uGooTime;
uniform float uGooWet;
varying vec3 vGoo;
varying vec3 vGooJ0;
varying vec3 vGooJ1;
varying vec3 vGooJ2;
varying float vGooAmp;
varying float vGooAO;
varying float vGooDry;
// wet vs. satin patches, drifting slowly so they crawl a little. Runs per
// vertex on a lot of vertices and only needs to be smooth and irregular, so
// it's folded sines rather than simplex noise
float gooDryAt(vec3 g) {
  vec3 p = g * 0.18 + vec3(0.0, uGooTime * 0.02, 0.0);
  float n = sin(p.x * 2.1 + sin(p.y * 1.7 + p.z * 0.6) * 1.8) * sin(p.y * 1.9 - sin(p.z * 2.3 + p.x * 0.8) * 1.6) * 0.65
          + sin(p.z * 4.3 + sin(p.x * 3.7) * 1.4 + 1.3) * sin(p.x * 3.9 - p.y * 2.2) * 0.35;
  return smoothstep(-0.3, 0.45, n - uGooWet);
}
`;

export function patchGoo(shader, uniforms) {
  Object.assign(shader.uniforms, uniforms);
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>
varying vec3 vGoo;
varying vec3 vGooJ0;
varying vec3 vGooJ1;
varying vec3 vGooJ2;
varying float vGooAmp;
varying float vGooAO;
varying float vGooDry;
uniform mat3 uGooView;
uniform vec2 uGooRough;
uniform vec2 uGooCoat;
uniform vec2 uGooCoatRough;
${SNOISE}

// simplex noise and its analytic gradient (same lattice as snoise)
float snoiseGrad(vec3 v, out vec3 grad) {
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
            i.z + vec4(0.0, i1.z, i2.z, 1.0))
          + i.y + vec4(0.0, i1.y, i2.y, 1.0))
          + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  vec4 m2 = m * m;
  vec4 m4 = m2 * m2;
  vec4 pdotx = vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3));
  vec4 t = m2 * m * pdotx;
  grad = 42.0 * (-8.0 * (t.x * x0 + t.y * x1 + t.z * x2 + t.w * x3)
                 + m4.x * p0 + m4.y * p1 + m4.z * p2 + m4.w * p3);
  return 42.0 * dot(m4, pdotx);
}

// gradient of the height field in goo space: ripples plus finer creases,
// each faded out before it gets small enough to sparkle
vec3 gooGrad(vec3 p, float fw) {
  vec3 g = vec3(0.0);
  vec3 gn;
  float w1 = 1.0 - smoothstep(0.12, 0.3, fw);
  float w2 = 1.0 - smoothstep(0.12, 0.3, fw * 2.7);
  if (w1 > 0.0) { snoiseGrad(p, gn); g += gn * 0.65 * w1; }
  if (w2 > 0.0) { snoiseGrad(p * 2.7 + 7.1, gn); g += gn * (0.35 * 2.7) * w2; }
  return g;
}

// bend a view-space normal by a view-space height gradient
vec3 gooBend(vec3 n, vec3 grad) {
  return normalize(n - (grad - n * dot(n, grad)));
}
`)
    .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
vec3 gooGView = vec3(0.0);
// hair-thin strands get no relief worth paying for
if (vGooAmp > 2e-4) {
  vec3 gooG = gooGrad(vGoo, length(fwidth(vGoo)));
  gooGView = uGooView * (vGooJ0 * gooG.x + vGooJ1 * gooG.y + vGooJ2 * gooG.z) * vGooAmp;
}
normal = gooBend(normal, gooGView);
`)
    .replace('#include <clearcoat_normal_fragment_maps>', `#include <clearcoat_normal_fragment_maps>
// the liquid coat fills in the finest relief, so it follows only half of it
clearcoatNormal = gooBend(clearcoatNormal, gooGView * 0.5);
`)
    .replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>
material.roughness = min(mix(uGooRough.x, uGooRough.y, vGooDry) + geometryRoughness, 1.0);
#ifdef USE_CLEARCOAT
material.clearcoat *= mix(uGooCoat.x, uGooCoat.y, vGooDry);
material.clearcoatRoughness = min(mix(uGooCoatRough.x, uGooCoatRough.y, vGooDry) + geometryRoughness, 1.0);
#endif
`)
    .replace('#include <aomap_fragment>', `#include <aomap_fragment>
// buried goo neither catches the environment nor shows its sheen
float gooOcc = clamp(vGooAO, 0.0, 1.0);
reflectedLight.indirectDiffuse *= gooOcc;
reflectedLight.indirectSpecular *= gooOcc * gooOcc;
#ifdef USE_CLEARCOAT
clearcoatSpecularIndirect *= gooOcc * gooOcc;
#endif
`);
}

// creature space -> view space rotation for the bump gradients
const tmpM4 = new THREE.Matrix4();
export function updateGooView(uniformSets, camera, creature) {
  tmpM4.multiplyMatrices(camera.matrixWorldInverse, creature.matrixWorld);
  for (const u of uniformSets) u.uGooView.value.getNormalMatrix(tmpM4);
}
