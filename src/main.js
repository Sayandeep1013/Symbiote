import * as THREE from 'three';
import { createStudioEnvironment } from './creature/env.js';
import { createTubes, SEGS } from './creature/tubes.js';
import { createRig } from './creature/rig.js';
import { createMass } from './creature/mass.js';
import { createWebbing } from './creature/webbing.js';
import { createStage } from './creature/stage.js';
import { createShell } from './creature/shell.js';
import { gooUniforms, updateGooView } from './creature/goo.js';

const canvas = document.getElementById('canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.setClearColor(0x000000, 0);

const scene = new THREE.Scene();
scene.environment = createStudioEnvironment(renderer);

const camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.1, 50);
camera.position.set(0, 0.55, 7.6);
camera.lookAt(0, -0.1, 0);

// Goo black: almost no diffuse, a base reflection under a liquid clearcoat.
// The goo patch (goo.js) varies both per pixel - wet patches with a sharp
// coat, satin ones with a dull one - and bumps the surface, so highlights
// break up instead of reading as black chrome
function wetBlack() {
  return new THREE.MeshPhysicalMaterial({
    color: 0x040405,
    roughness: 0.4,
    metalness: 0.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.1,
    envMapIntensity: 0.8,
    iridescence: 0.12,
    iridescenceIOR: 1.25,
  });
}
const goo = gooUniforms({ rough: [0.3, 0.68], coat: [1.0, 0.18], coatRough: [0.05, 0.34], wet: 0.1 });
// the films are thinner and drier
const gooFilm = gooUniforms({ rough: [0.4, 0.75], coat: [0.7, 0.1], coatRough: [0.12, 0.4], wet: 0.15 });

const stage = createStage();
scene.add(stage.mesh);

const creature = new THREE.Group();
scene.add(creature);

const rig = createRig();
// tendrils first, then the pool of goo strings, one tube instance each
const strands = rig.tendrils.concat(rig.strings.items);
const tubes = createTubes(strands.length, wetBlack(), goo);
creature.add(tubes.mesh);

// the fused mass: body, roots, forks and merges as one implicit surface. Its
// big smooth lobes catch every strip at once, so it's kept a little darker
const massMaterial = wetBlack();
massMaterial.envMapIntensity = 1.0;
const mass = createMass(rig, massMaterial, goo);
creature.add(mass.mesh);

// thin films are nearly flat, so a mirror coat reflects whole light strips as
// white blocks; a slightly softer coat keeps them as streaks
function wetFilm() {
  const m = wetBlack();
  m.envMapIntensity = 0.55;
  m.clearcoatRoughness = 0.14;
  m.roughness = 0.3;
  return m;
}

// the webbing is the flattest surface of all: grazing reflections of the big
// overhead strip turned whole sheets white, so it gets a much quieter coat
const webMaterial = wetFilm();
webMaterial.envMapIntensity = 0.28;
webMaterial.clearcoat = 0.6;
webMaterial.clearcoatRoughness = 0.22;
const webbing = createWebbing(rig.pairs, tubes.posTex, webMaterial, gooFilm);
creature.add(webbing.mesh);

const shell = createShell(wetFilm(), gooFilm);
creature.add(shell.mesh);

// the mass hides most of everything else: draw it first so the GPU can skip
// shading what's behind it (all of these sit at the same origin, so the
// default distance sort can't tell them apart)
mass.mesh.renderOrder = 0;
tubes.mesh.renderOrder = 1;
shell.mesh.renderOrder = 2;
webbing.mesh.renderOrder = 3;

rig.tendrils.forEach((t, i) => {
  tubes.shape.set([t.r0, t.r1, t.taper, t.flat], i * 4);
  tubes.extra.set([t.seed, t.bulge, t.len, 0], i * 4);
  tubes.goo.set([t.pulse, 0, 0, 0], i * 4);
});
tubes.commit();

// strings change shape every frame: radii from their stretch, beads
function uploadStrings() {
  const base = rig.tendrils.length;
  rig.strings.items.forEach((it, j) => {
    const i = (base + j) * 4;
    if (!it.active) {
      tubes.shape.fill(0, i, i + 4);
      tubes.goo.fill(0, i, i + 4);
      return;
    }
    tubes.shape.set([it.rA, it.rB, 1, 1], i);
    tubes.extra.set([it.seed, 0, it.len, 1], i);
    tubes.goo.set([0, it.rMid, it.bead, it.nBeads], i);
  });
  tubes.commit();
}

// spines -> textures, with a rotation-minimising frame so the flattened
// cross-sections twist smoothly instead of flipping
const tan = new THREE.Vector3();
const nrm = new THREE.Vector3();
function uploadSpines() {
  const P = tubes.posData;
  const N = tubes.nrmData;
  strands.forEach((t, row) => {
    const pts = t.pts;
    for (let k = 0; k < SEGS; k++) {
      const a = pts[Math.max(0, k - 1)];
      const b = pts[Math.min(SEGS - 1, k + 1)];
      tan.subVectors(b, a).normalize();
      if (k === 0) nrm.copy(t.ref);
      nrm.addScaledVector(tan, -nrm.dot(tan)).normalize();
      const o = (row * SEGS + k) * 4;
      P[o] = pts[k].x;
      P[o + 1] = pts[k].y;
      P[o + 2] = pts[k].z;
      N[o] = nrm.x;
      N[o + 1] = nrm.y;
      N[o + 2] = nrm.z;
    }
  });
}

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// ---------- cursor as a 3D stimulus ----------
const pointerNDC = new THREE.Vector2();
let pointerSeen = false;
let pointerInside = false;
window.addEventListener('pointermove', (e) => {
  pointerNDC.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  pointerSeen = true;
  pointerInside = true;
});
document.addEventListener('pointerout', (e) => {
  if (!e.relatedTarget) pointerInside = false;
});

const raycaster = new THREE.Raycaster();
const cursorPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
const cursorWorld = new THREE.Vector3();
const prevCursorWorld = new THREE.Vector3();
const cursor = { pos: new THREE.Vector3(), speed: 0, active: false };

function updateCursor(dt) {
  cursor.active = pointerSeen && pointerInside;
  if (!pointerSeen) return;
  raycaster.setFromCamera(pointerNDC, camera);
  // plane through the creature's centre, facing the camera
  cursorPlane.constant = -creature.position.z;
  if (!raycaster.ray.intersectPlane(cursorPlane, cursorWorld)) return;
  const inst = cursorWorld.distanceTo(prevCursorWorld) / Math.max(dt, 1e-3);
  cursor.speed += (inst - cursor.speed) * 0.2;
  prevCursorWorld.copy(cursorWorld);
  creature.updateMatrixWorld();
  cursor.pos.copy(cursorWorld);
  creature.worldToLocal(cursor.pos);
}

const clock = new THREE.Clock();

function animate() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const time = clock.elapsedTime;

  // slow sway (not a spin: the crown would turn edge-on) so the studio
  // reflections crawl over the surface
  creature.rotation.y = Math.sin(time * 0.11) * 0.35;
  creature.rotation.x = Math.sin(time * 0.17) * 0.12;
  creature.position.y = 0.25 + Math.sin(time * 0.6) * 0.06;

  updateCursor(dt);
  rig.update(dt, time, cursor);
  uploadSpines();
  uploadStrings();
  tubes.upload(time);
  mass.update(time);
  webbing.update();
  shell.update(time);
  goo.uGooTime.value = time;
  gooFilm.uGooTime.value = time;
  creature.updateMatrixWorld();
  camera.updateMatrixWorld();
  updateGooView([goo, gooFilm], camera, creature);
  stage.update(time);

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);

// dev-only handle for tuning from the console; stripped from production builds
if (import.meta.env.DEV) window.__sym = { renderer, scene, camera, rig, goo, gooFilm, tubes, mass, webbing, shell, creature };
