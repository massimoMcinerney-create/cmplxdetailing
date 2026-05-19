/**
 * carLoader.js — CMPLX Detailing
 *
 * Loads a GLTF sports car into the scene with:
 *   - Automatic centering + scaling
 *   - Metallic paint / glass material assignment
 *   - Shadow casting / receiving
 *   - Nested floatPivot for sine-wave float (separate from GSAP-controlled carGroup)
 *
 * Returns { carGroup, floatPivot, paintMaterial } synchronously.
 * carGroup and floatPivot are empty until onLoaded fires.
 */

import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/DRACOLoader.js";

// Ferrari 458 from Three.js public examples — reliable CORS-open endpoint
const MODEL_URL = "https://threejs.org/examples/models/gltf/ferrari.glb";
const DRACO_PATH  = "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/libs/draco/";

export function initCarLoader(scene, { onProgress = () => {}, onLoaded = () => {} } = {}) {

  /* ── Group hierarchy ─────────────────────────────────────────────
     scene
       └─ carGroup      ← GSAP: position, rotation, scale
            └─ floatPivot  ← render loop: position.y sine wave
                 └─ model (loaded or fallback)
  ──────────────────────────────────────────────────────────────── */
  const carGroup   = new THREE.Group();
  const floatPivot = new THREE.Group();
  carGroup.add(floatPivot);
  scene.add(carGroup);

  // Shared materials — exposed so caller can drive transitions later
  const paintMaterial = new THREE.MeshStandardMaterial({
    color:           0xb3001b,   // cherry red
    metalness:       0.95,
    roughness:       0.12,
    envMapIntensity: 2.0,
  });

  const glassMaterial = new THREE.MeshStandardMaterial({
    color:           0x0a1a2a,
    metalness:       0.05,
    roughness:       0.0,
    transparent:     true,
    opacity:         0.32,
    envMapIntensity: 2.5,
    side:            THREE.FrontSide,
  });

  /* ── GLTF + DRACO loader ─────────────────────────────────────── */
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath(DRACO_PATH);

  const gltfLoader = new GLTFLoader();
  gltfLoader.setDRACOLoader(dracoLoader);

  gltfLoader.load(
    MODEL_URL,
    (gltf) => {
      const model = gltf.scene;
      _centerAndScale(model);
      _applyMaterials(model, paintMaterial, glassMaterial);
      _enableShadows(model);
      floatPivot.add(model);
      onLoaded({ carGroup, floatPivot, paintMaterial });
    },
    (evt) => {
      if (evt.total > 0) onProgress(evt.loaded / evt.total);
    },
    (err) => {
      console.warn("[CarLoader] GLTF load failed — using fallback geometry.", err?.message ?? err);
      const fallback = _buildFallback(paintMaterial, glassMaterial);
      floatPivot.add(fallback);
      onLoaded({ carGroup, floatPivot, paintMaterial });
    }
  );

  return { carGroup, floatPivot, paintMaterial };
}

/* ═══════════════════════════════════════════════════════════════════
   MODEL PROCESSING
═══════════════════════════════════════════════════════════════════ */

function _centerAndScale(model) {
  // Center at origin
  const box1   = new THREE.Box3().setFromObject(model);
  const center = box1.getCenter(new THREE.Vector3());
  const size   = box1.getSize(new THREE.Vector3());
  model.position.sub(center);

  // Scale so longest horizontal axis ≈ 4 units
  const scale = 4.0 / Math.max(size.x, size.z);
  model.scale.setScalar(scale);

  // Lift bottom edge to y = 0
  const box2 = new THREE.Box3().setFromObject(model);
  model.position.y -= box2.min.y;
}

function _applyMaterials(model, paintMat, glassMat) {
  model.traverse((node) => {
    if (!node.isMesh) return;

    const id = (node.name + " " + (node.material?.name ?? "")).toLowerCase();

    if (/glass|window|windshield|vitre|pare/.test(id)) {
      node.material = glassMat;
    } else if (/body|paint|exterior|hood|door|fender|capot|carrosserie/.test(id)) {
      node.material = paintMat;
    } else if (node.material) {
      // Boost reflections on everything else (rims, trim, interior)
      node.material = node.material.clone();
      node.material.envMapIntensity = Math.max(node.material.envMapIntensity ?? 0, 0.9);
    }
  });
}

function _enableShadows(model) {
  model.traverse((n) => {
    if (n.isMesh) {
      n.castShadow    = true;
      n.receiveShadow = true;
    }
  });
}

/* ═══════════════════════════════════════════════════════════════════
   FALLBACK — detailed procedural sports car
   Activates automatically if GLTF load fails.
═══════════════════════════════════════════════════════════════════ */

function _buildFallback(paintMat, glassMat) {
  const g = new THREE.Group();

  const dark = new THREE.MeshStandardMaterial({
    color: 0x0d0d0d, metalness: 0.65, roughness: 0.4,
  });
  const chrome = new THREE.MeshStandardMaterial({
    color: 0xc2c2c2, metalness: 1.0, roughness: 0.04,
  });
  const tailMat = new THREE.MeshStandardMaterial({
    color: 0xff1111, emissive: 0xff0000, emissiveIntensity: 1.1,
  });
  const headMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, emissive: 0xbbddff, emissiveIntensity: 0.7,
  });
  const calMat = new THREE.MeshStandardMaterial({
    color: 0xcc1100, metalness: 0.5, roughness: 0.4,
  });

  const add = (geo, mat, [px, py, pz], rotX = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(px, py, pz);
    if (rotX) m.rotation.x = rotX;
    m.castShadow    = true;
    m.receiveShadow = true;
    g.add(m);
    return m;
  };

  // ── Body shell ──────────────────────────────────────────────────
  add(new THREE.BoxGeometry(2.02, 0.44, 4.45), paintMat, [0, 0.44, 0]);
  // Lower sill strip
  add(new THREE.BoxGeometry(2.18, 0.2,  4.05), dark,     [0, 0.2,  0]);
  // Cabin / greenhouse
  add(new THREE.BoxGeometry(1.60, 0.48, 1.88), paintMat, [0, 0.86, 0.1]);
  // Hood (slight forward pitch)
  add(new THREE.BoxGeometry(1.90, 0.07, 1.55), paintMat, [0, 0.67, 1.62], 0.05);
  // Trunk lid (slight rearward pitch)
  add(new THREE.BoxGeometry(1.90, 0.07, 0.90), paintMat, [0, 0.67, -1.52], -0.04);
  // Front bumper
  add(new THREE.BoxGeometry(2.02, 0.30, 0.22), dark,     [0, 0.28, 2.25]);
  // Rear bumper
  add(new THREE.BoxGeometry(2.02, 0.30, 0.22), dark,     [0, 0.28, -2.25]);
  // Front splitter
  add(new THREE.BoxGeometry(1.82, 0.04, 0.28), dark,     [0, 0.07, 2.35]);
  // Rear diffuser
  add(new THREE.BoxGeometry(1.82, 0.13, 0.40), dark,     [0, 0.17, -2.34]);
  // Rear spoiler blade + end plates
  add(new THREE.BoxGeometry(1.70, 0.06, 0.28), dark,     [0, 0.74, -2.08]);
  add(new THREE.BoxGeometry(0.06, 0.22, 0.08), dark,     [-0.76, 0.64, -2.08]);
  add(new THREE.BoxGeometry(0.06, 0.22, 0.08), dark,     [ 0.76, 0.64, -2.08]);

  // ── Glazing (planar meshes) ──────────────────────────────────────
  const ws = new THREE.Mesh(new THREE.PlaneGeometry(1.44, 0.56), glassMat);
  ws.position.set(0, 0.9, 1.06); ws.rotation.x = -Math.PI / 2.2;
  g.add(ws);

  const rw = new THREE.Mesh(new THREE.PlaneGeometry(1.40, 0.44), glassMat);
  rw.position.set(0, 0.86, -0.84); rw.rotation.x = Math.PI / 2.3;
  g.add(rw);

  [-0.82, 0.82].forEach(x => {
    const sw = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.34), glassMat);
    sw.position.set(x, 0.94, 0.28);
    sw.rotation.y = x > 0 ? Math.PI / 2 : -Math.PI / 2;
    g.add(sw);
  });

  // ── Wheels — 4 corners ──────────────────────────────────────────
  [
    [ 1.06, 0.30,  1.38],
    [-1.06, 0.30,  1.38],
    [ 1.06, 0.30, -1.38],
    [-1.06, 0.30, -1.38],
  ].forEach(([x, y, z]) => {
    // Tyre (torus)
    const tire = new THREE.Mesh(new THREE.TorusGeometry(0.30, 0.10, 10, 30), dark);
    tire.rotation.y = Math.PI / 2;
    tire.position.set(x, y, z);
    tire.castShadow = true;
    g.add(tire);

    // Rim (cylinder)
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.20, 0.20, 22), chrome);
    rim.rotation.z = Math.PI / 2;
    rim.position.set(x, y, z);
    rim.castShadow = true;
    g.add(rim);

    // Brake caliper hint
    const cal = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.13, 0.12), calMat);
    cal.position.set(x > 0 ? x - 0.16 : x + 0.16, y + 0.08, z);
    g.add(cal);
  });

  // ── Lights ──────────────────────────────────────────────────────
  [-0.64, 0.64].forEach(x => add(new THREE.BoxGeometry(0.40, 0.10, 0.06), headMat, [x,  0.44,  2.26]));
  [-0.66, 0.66].forEach(x => add(new THREE.BoxGeometry(0.44, 0.09, 0.06), tailMat, [x,  0.44, -2.26]));

  // ── Mirrors ─────────────────────────────────────────────────────
  [-1.10, 1.10].forEach(x => add(new THREE.BoxGeometry(0.08, 0.10, 0.22), dark, [x, 0.84, 0.88]));

  return g;
}
