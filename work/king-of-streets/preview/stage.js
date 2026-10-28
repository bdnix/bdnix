// The preview stage: the one place the draw settings live (renderer, tone mapping, daylight, shadows).
// The game will load the same settings, so what is reviewed is what ships. The host page maps 'three' and 'three/addons/'.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

export const SETTINGS = {
  toneMapping: THREE.ACESFilmicToneMapping,
  exposure: 0.95,
  maxPixelRatio: 3,           // an iPhone 15 Pro is 3
  sunColor: 0xfff1dc,
  sunIntensity: 2.4,
  sunPosition: [4, 9, 5],
  groundColor: 0x45484d,
  hazeColor: 0xaab9c8,       // ground fades into the sky's horizon colour
  shadowMapSize: 2048
};

// Camera presets for a bike (front is +Z, the bike's length ~2 m)
export const VIEWS = {
  side:      { pos: [3.9, 0.85, 0],    look: [0, 0.55, 0],    fov: 24 },
  front34:   { pos: [2.6, 1.35, 3.1],  look: [0, 0.55, 0.05], fov: 26 },
  rear34:    { pos: [-2.6, 1.35, -3.2], look: [0, 0.55, 0],   fov: 26 },
  rear:      { pos: [0, 1.0, -4.8],    look: [0, 0.6, 0],     fov: 24 },
  close:     { pos: [2.1, 1.05, 0.25], look: [0, 0.72, 0.1],  fov: 22 },
  race:      { pos: [0, 1.9, -4.6],    look: [0, 0.6, 2],     fov: 50 }   // chase-camera distance
};

export async function createStage(canvas, { width, height, dpr = 1, hdrUrl }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(dpr, SETTINGS.maxPixelRatio));
  renderer.setSize(width, height, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = SETTINGS.toneMapping;
  renderer.toneMappingExposure = SETTINGS.exposure;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const hdr = await new RGBELoader().loadAsync(hdrUrl);
  hdr.mapping = THREE.EquirectangularReflectionMapping;
  scene.environment = pmrem.fromEquirectangular(hdr).texture;
  scene.background = hdr;
  scene.backgroundBlurriness = 0.0;

  const sun = new THREE.DirectionalLight(SETTINGS.sunColor, SETTINGS.sunIntensity);
  sun.position.set(...SETTINGS.sunPosition);
  sun.castShadow = true;
  sun.shadow.mapSize.set(SETTINGS.shadowMapSize, SETTINGS.shadowMapSize);
  Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 0.5, far: 30 });
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
  scene.add(sun);
  scene.fog = new THREE.Fog(SETTINGS.hazeColor, 25, 220);

  const ground = new THREE.Mesh(new THREE.CircleGeometry(400, 64), new THREE.MeshStandardMaterial({ color: SETTINGS.groundColor, roughness: 0.92 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
  scene.add(ground);

  const camera = new THREE.PerspectiveCamera(30, width / height, 0.05, 200);
  const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
  let model = null, wheels = [];

  async function load(url) {
    if (model) scene.remove(model);
    const gltf = await loader.loadAsync(url);
    model = gltf.scene;
    model.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    wheels = [];
    model.traverse(o => { if (o.name === 'wheel_f' || o.name === 'wheel_r') wheels.push(o); });
    scene.add(model);
    return model;
  }
  function stats() {
    let tris = 0, prims = 0; const mats = new Set();
    model.traverse(o => { if (o.isMesh) { prims++; mats.add(o.material); const i = o.geometry.index; tris += (i ? i.count : o.geometry.attributes.position.count) / 3; } });
    return { tris: Math.round(tris), prims, materials: mats.size };
  }
  function view(name, extra = {}) {
    const v = VIEWS[name] || name;
    camera.fov = v.fov; camera.aspect = renderer.domElement.width / renderer.domElement.height; camera.updateProjectionMatrix();
    camera.position.set(...v.pos); camera.lookAt(...v.look);
    if (extra.yaw != null) { const p = camera.position, c = Math.cos(extra.yaw), s = Math.sin(extra.yaw); const x = p.x * c - p.z * s, z = p.x * s + p.z * c; camera.position.set(x, p.y, z); camera.lookAt(...v.look); }
  }
  function spin(a) { wheels.forEach(w => { w.rotation.x = a; }); }
  function render() { renderer.render(scene, camera); }
  function resize(w, h, dpr2) { renderer.setPixelRatio(Math.min(dpr2 || dpr, SETTINGS.maxPixelRatio)); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  function dispose() { renderer.dispose(); }
  return { THREE, renderer, scene, camera, load, stats, view, spin, render, resize, dispose, get model() { return model; } };
}
