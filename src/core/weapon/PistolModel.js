import * as THREE from '../../three-shim.js';
import { RoundedBoxGeometry } from '../../vendor/addons/geometries/RoundedBoxGeometry.js';

/* A modern polymer striker pistol at real scale (metres), built from bevelled
   side-profile extrusions instead of boxes. Gun-local axes: -Z is the muzzle
   direction, +Y up, +X the shooter's right. Profiles are drawn in (u, v) where
   u runs toward the muzzle and v up; `extrudeProfile` turns them into 3D parts.

   Returns { root, slide, muzzle, port }:
   - slide: group that moves back on each shot (blowback)
   - muzzle: empty at the barrel crown (flash position)
   - port: empty at the ejection port (shell spawn position) */

const SLIDE_WIDTH = 0.0255;
const FRAME_WIDTH = 0.026;

export function buildPistol(materials) {
  const root = new THREE.Group();
  const slide = new THREE.Group();
  root.add(slide);

  buildFrame(root, materials);
  buildSlide(slide, materials);
  buildBarrel(root, materials);
  buildControls(root, materials);

  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.0165, -0.101);
  root.add(muzzle);

  const port = new THREE.Object3D();
  port.position.set(0.012, 0.03, -0.022);
  slide.add(port);

  root.traverse((o) => {
    if (o.isMesh) o.castShadow = false;
  });
  return { root, slide, muzzle, port };
}

/* ---------- Parts ---------- */

function buildSlide(slide, m) {
  /* Side profile: chamfered nose, flat top, slight rear cut */
  const profile = [
    [-0.09, 0], [0.097, 0], [0.097, 0.021], [0.087, 0.0305],
    [-0.086, 0.0305], [-0.09, 0.026]
  ];
  slide.add(extrudeProfile(profile, SLIDE_WIDTH, m.slide, 0.0016));

  /* Serrations: shallow grooves cut into both sides at the rear and front */
  const groove = new THREE.BoxGeometry(0.0007, 0.019, 0.0016);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 8; i++) addMesh(slide, groove, m.slideDark, side * (SLIDE_WIDTH / 2 + 0.0006), 0.0145, 0.084 - i * 0.0042);
    for (let i = 0; i < 4; i++) addMesh(slide, groove, m.slideDark, side * (SLIDE_WIDTH / 2 + 0.0006), 0.0145, -0.062 - i * 0.0042);
  }

  /* Ejection port on the right with the barrel hood showing through */
  addMesh(slide, new THREE.BoxGeometry(0.011, 0.0012, 0.04), m.bore, 0.0068, 0.0306, -0.022);
  addMesh(slide, new RoundedBoxGeometry(0.0105, 0.004, 0.038, 1, 0.001), m.barrel, 0.0068, 0.0288, -0.022);

  /* Rear notch sight: two posts with a gap */
  for (const side of [-1, 1]) {
    addMesh(slide, new RoundedBoxGeometry(0.0075, 0.0065, 0.008, 1, 0.0012), m.slideDark, side * 0.0068, 0.0335, 0.078);
  }
  /* Front post with a lime fibre dot facing the shooter */
  addMesh(slide, new RoundedBoxGeometry(0.0038, 0.0062, 0.006, 1, 0.0010), m.slideDark, 0, 0.0335, -0.08);
  const dot = new THREE.Mesh(new THREE.CylinderGeometry(0.0013, 0.0013, 0.0015, 16), m.fibre);
  dot.rotation.x = Math.PI / 2;
  dot.position.set(0, 0.0345, -0.0768);
  slide.add(dot);
}

function buildFrame(root, m) {
  /* Frame and grip as one profile; the grip rakes back about 15 degrees */
  const frame = [
    [0.088, 0], [0.088, -0.0145], [0.0, -0.016], [-0.029, -0.104],
    [-0.088, -0.106], [-0.066, -0.019], [-0.083, -0.011], [-0.086, 0]
  ];
  root.add(extrudeProfile(frame, FRAME_WIDTH, m.polymer, 0.003));

  /* Trigger guard: outer outline with the finger hole cut out */
  const outer = [[0.0, -0.016], [0.05, -0.016], [0.055, -0.024], [0.05, -0.038], [0.04, -0.043], [-0.009, -0.043], [-0.006, -0.03]];
  const hole = [[0.006, -0.0195], [0.046, -0.0195], [0.048, -0.025], [0.044, -0.0355], [0.036, -0.038], [0.001, -0.038], [0.003, -0.026]];
  root.add(extrudeProfile(outer, 0.0145, m.polymer, 0.0018, [hole]));

  /* Accessory rail slots under the dust cover */
  for (let i = 0; i < 3; i++) addMesh(root, new THREE.BoxGeometry(0.02, 0.003, 0.0035), m.polymerDark, 0, -0.0158, -0.062 - i * 0.008);

  /* Magazine baseplate, angled with the grip */
  const base = addMesh(root, new RoundedBoxGeometry(0.031, 0.009, 0.064, 2, 0.003), m.polymerDark, 0, -0.108, 0.058);
  base.rotation.x = -0.05;
}

function buildBarrel(root, m) {
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.0068, 0.0068, 0.006, 24), m.barrel);
  crown.rotation.x = Math.PI / 2;
  crown.position.set(0, 0.0165, -0.0985);
  root.add(crown);
  const bore = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.0064, 16), m.bore);
  bore.rotation.x = Math.PI / 2;
  bore.position.set(0, 0.0165, -0.0987);
  root.add(bore);
}

function buildControls(root, m) {
  /* Trigger with its safety blade */
  const trigger = addMesh(root, new RoundedBoxGeometry(0.0055, 0.019, 0.0055, 1, 0.0015), m.polymerDark, 0, -0.027, -0.019);
  trigger.rotation.x = -0.25;
  addMesh(root, new THREE.BoxGeometry(0.0018, 0.008, 0.002), m.slideDark, 0, -0.028, -0.0215);

  /* Slide stop and takedown lever on the left */
  addMesh(root, new RoundedBoxGeometry(0.0025, 0.004, 0.016, 1, 0.0008), m.slideDark, -FRAME_WIDTH / 2 - 0.0015, -0.003, -0.002);
  addMesh(root, new RoundedBoxGeometry(0.002, 0.003, 0.008, 1, 0.0007), m.slideDark, -FRAME_WIDTH / 2 - 0.0012, -0.006, -0.04);
}

/* ---------- Helpers ---------- */

/* Extrudes a (u, v) side profile across the gun's width with a soft bevel.
   holes: optional list of inner profiles cut through the part. */
function extrudeProfile(points, width, material, bevel, holes = []) {
  const toShape = (pts, ShapeType) => {
    const shape = new ShapeType();
    pts.forEach(([u, v], i) => (i ? shape.lineTo(u, v) : shape.moveTo(u, v)));
    shape.closePath?.();
    return shape;
  };
  const shape = toShape(points, THREE.Shape);
  for (const hole of holes) shape.holes.push(toShape(hole, THREE.Path));

  const depth = Math.max(0.001, width - bevel * 2);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel * 0.9,
    bevelSegments: 3,
    curveSegments: 4
  });
  /* Profile u -> gun forward (-Z), extrusion -> gun X, then centre across X */
  geometry.rotateY(Math.PI / 2);
  geometry.translate(-depth / 2, 0, 0);
  geometry.computeVertexNormals();
  return new THREE.Mesh(geometry, material);
}

function addMesh(parent, geometry, material, x, y, z) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}
