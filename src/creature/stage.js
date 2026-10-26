import * as THREE from 'three';

// The floor from the mockup: a dark wet ground lit by a soft pool from
// above, with drifting mist, fading into black toward the horizon. It's what
// makes the creature read as floating in a space rather than pasted on black.
export function createStage() {
  const uniforms = { uTime: { value: 0 } };
  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: `
varying vec3 vWorld;
void main(){
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`,
    fragmentShader: `
uniform float uTime;
varying vec3 vWorld;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++){ v += a * vnoise(p); p *= 2.03; a *= 0.5; }
  return v;
}

void main(){
  vec2 q = vWorld.xz;
  float r = length(q * vec2(0.45, 0.8));
  float pool = exp(-r * r * 0.5);
  // drifting mist and a faint wet-concrete grain
  float mist = fbm(q * 0.7 + vec2(uTime * 0.025, -uTime * 0.015));
  float grain = fbm(q * 6.0);
  float light = pool * (0.18 + 0.55 * mist) * (0.85 + 0.3 * grain);
  // darker directly under the creature, where it blocks the light
  light *= 1.0 - 0.35 * exp(-dot(q, q) * 1.6);
  // light as coverage over the transparent canvas, so the page haze shows
  // through wherever the floor is dark
  gl_FragColor = vec4(vec3(0.62, 0.66, 0.74), clamp(light * 1.1, 0.0, 1.0));
}`,
  });

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), material);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.9;

  return {
    mesh: floor,
    update(time) {
      uniforms.uTime.value = time;
    },
  };
}
