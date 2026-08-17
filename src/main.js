import * as THREE from 'three';
import vertexShader from './shaders/blob.vert.glsl?raw';
import fragmentShader from './shaders/blob.frag.glsl?raw';

const NUM_TENT = 14;
const CORE_R = 0.85;

const canvas = document.getElementById('canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

const scene = new THREE.Scene();
const quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

const CAM_POS = new THREE.Vector3(0, 0, 7.5);

// Virtual camera used only for mouse raycasting math (matches the shader's
// hand-rolled ray construction: fov 45deg, looking at the origin).
const raycastCamera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
raycastCamera.position.copy(CAM_POS);
raycastCamera.lookAt(0, 0, 0);

const mousePlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
const raycaster = new THREE.Raycaster();
const mouseNDC = new THREE.Vector2(0, 0);
const mouseWorld = new THREE.Vector3(0, 3, 0);
const prevMouseWorld = mouseWorld.clone();
let mouseSpeed = 0;

// ---- per-tentacle static setup (fibonacci sphere directions) ----
function fibDir(i, n) {
  const golden = Math.PI * (3 - Math.sqrt(5));
  const y = 1 - (i / (n - 1)) * 2;
  const radius = Math.sqrt(Math.max(0, 1 - y * y));
  const theta = golden * i;
  return new THREE.Vector3(Math.cos(theta) * radius, y, Math.sin(theta) * radius).normalize();
}

// cheap smooth pseudo-noise (sum of a few sines) - stands in for the GLSL
// simplex noise but runs 14x/frame on the CPU instead of ~2M times/frame on
// the GPU across every raymarch step of every pixel
function pnoise(t, seed) {
  return (
    Math.sin(t * 1.0 + seed * 12.9898) * 0.5 +
    Math.sin(t * 2.13 + seed * 4.211) * 0.3 +
    Math.sin(t * 3.71 + seed * 7.777) * 0.2
  );
}

function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

const tentDirs = Array.from({ length: NUM_TENT }, (_, i) => fibDir(i, NUM_TENT));
const tentBaseVals = tentDirs.map((d) => d.clone().multiplyScalar(CORE_R * 0.72));
const tentTipVals = Array.from({ length: NUM_TENT }, () => new THREE.Vector3());

const uniforms = {
  uTime: { value: 0 },
  uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
  uCamPos: { value: CAM_POS },
  uTentBase: { value: tentBaseVals },
  uTentTip: { value: tentTipVals },
};

const material = new THREE.ShaderMaterial({ vertexShader, fragmentShader, uniforms });
const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
scene.add(quad);

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h);
  uniforms.uResolution.value.set(w, h);
  raycastCamera.aspect = w / h;
  raycastCamera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

window.addEventListener('pointermove', (e) => {
  mouseNDC.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouseNDC.y = -(e.clientY / window.innerHeight) * 2 + 1;
});

const clock = new THREE.Clock();
const hitPoint = new THREE.Vector3();
const toMouse = new THREE.Vector3();
const wobble = new THREE.Vector3();

function updateTentacles(time) {
  toMouse.copy(mouseWorld).normalize();
  const proximity = smoothstep(3.2, 0.0, mouseWorld.length());
  const flinchAmt = smoothstep(0.25, 1.6, mouseSpeed);

  for (let i = 0; i < NUM_TENT; i++) {
    const dir = tentDirs[i];

    const idle = pnoise(time * 0.4, i);
    let len = 0.4 + 0.32 * idle;

    const facing = Math.max(0, dir.dot(toMouse));
    const reach = facing * proximity;
    const flinch = flinchAmt * facing;
    len += reach * 0.55 - flinch * 0.4;
    len = Math.min(1.05, Math.max(0.1, len));

    wobble.set(
      pnoise(time * 0.55 + 11, i),
      pnoise(time * 0.55 + 31, i),
      pnoise(time * 0.55 + 51, i)
    ).multiplyScalar(0.28);

    tentTipVals[i].copy(dir).add(wobble).normalize().multiplyScalar(CORE_R + len);
  }
}

function animate() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const time = clock.elapsedTime;

  raycaster.setFromCamera(mouseNDC, raycastCamera);
  const hit = raycaster.ray.intersectPlane(mousePlane, hitPoint);
  if (hit) {
    mouseWorld.lerp(hit, 0.18);
  }

  const instSpeed = mouseWorld.distanceTo(prevMouseWorld) / Math.max(dt, 0.001);
  mouseSpeed += (instSpeed - mouseSpeed) * 0.15;
  prevMouseWorld.copy(mouseWorld);

  updateTentacles(time);

  uniforms.uTime.value = time;

  renderer.render(scene, quadCamera);
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
