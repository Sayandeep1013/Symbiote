import * as THREE from 'three';
import { BODY_R } from './rig.js';

// simplex noise (Ashima Arts / Ian McEwan, MIT)
export const SNOISE = `
vec3 mod289(vec3 x){ return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x){ return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x){ return mod289(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v){
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
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}`;

export function createBody(material) {
  const geo = new THREE.IcosahedronGeometry(BODY_R, 48);
  const uniforms = { uTime: { value: 0 } };

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
uniform float uTime;
${SNOISE}
// big slow glossy lobes; fine detail comes from the strands, not the surface
float bodyField(vec3 d){
  float big = snoise(d * 1.4 + vec3(0.0, uTime * 0.12, 0.0));
  float mid = snoise(d * 3.0 - vec3(uTime * 0.2, 0.0, uTime * 0.1));
  return big * 0.16 + mid * 0.05;
}
vec3 bodyPos(vec3 d){ return d * (${BODY_R.toFixed(3)} * (1.0 + bodyField(d))); }
`)
      .replace('#include <beginnormal_vertex>', `
vec3 bDir = normalize(position);
vec3 bT = normalize(cross(bDir, abs(bDir.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
vec3 bB = cross(bDir, bT);
float bE = 0.01;
vec3 bP = bodyPos(bDir);
vec3 bPT = bodyPos(normalize(bDir + bT * bE));
vec3 bPB = bodyPos(normalize(bDir + bB * bE));
vec3 objectNormal = normalize(cross(bPT - bP, bPB - bP));
`)
      .replace('#include <begin_vertex>', 'vec3 transformed = bP;');
  };
  material.customProgramCacheKey = () => 'symbiote-body';

  const mesh = new THREE.Mesh(geo, material);
  return {
    mesh,
    update(time) {
      uniforms.uTime.value = time;
    },
  };
}
