import * as THREE from 'three';

// A black studio built only from a few long, thin light strips. Glossy black
// material shows nothing but reflections, so the shape of these emitters IS
// the look: long strips become the thin bright streaks that run along every
// tendril edge in the references, instead of round "light bulb" dots.
export function createStudioEnvironment(renderer) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x010102);

  const strip = (w, h, color, intensity, position) => {
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(color).multiplyScalar(intensity),
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    mesh.position.copy(position);
    mesh.lookAt(0, 0, 0);
    scene.add(mesh);
  };

  // overhead softbox, slightly in front: the main sheen on top surfaces
  strip(7, 1.1, 0xffffff, 9, new THREE.Vector3(0, 6, 2.5));
  // tall cool strip on the left: blue-white edge lines
  strip(0.3, 7, 0xb8c8ff, 4, new THREE.Vector3(-5.5, 0.8, 2));
  // narrow warm-white rim from behind right
  strip(0.25, 6, 0xfff2e6, 9, new THREE.Vector3(5, 1.5, -3));
  // faint long bounce line low in front, so undersides aren't dead
  strip(9, 0.12, 0x8090b0, 3, new THREE.Vector3(0, -4, 4));
  // a fan of thin strips around the front: lots of separate glints on the
  // tangle instead of one big sheen
  for (let i = 0; i < 7; i++) {
    const ang = -1.1 + (i / 6) * 2.2;
    strip(0.12, 3.5, 0xffffff, 6, new THREE.Vector3(Math.sin(ang) * 6, 2 + (i % 2) * 1.5, Math.cos(ang) * 6));
  }
  // a couple of small hard kicks for sparkle on thin strands
  strip(0.5, 0.5, 0xffffff, 14, new THREE.Vector3(3, 4, 4));
  strip(0.4, 0.4, 0xdfe6ff, 10, new THREE.Vector3(-3.5, 3, -4));

  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(scene, 0).texture;
  pmrem.dispose();
  scene.traverse((o) => {
    if (o.isMesh) {
      o.geometry.dispose();
      o.material.dispose();
    }
  });
  return env;
}
