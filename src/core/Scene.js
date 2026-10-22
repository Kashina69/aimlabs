import * as THREE from '../three-shim.js';
import { PALETTE } from './palette.js';

/* The training range: a matte graphite room with panel seams for depth cues,
   fake ambient occlusion in the corners, floor distance markers, wall signage,
   a bracketed target zone on the back wall and soft neutral ceiling light.
   Textures are drawn on a canvas at startup, so the range needs no image downloads.
   The ghost run behind the home menu lives in src/fx/MenuPreview.js. */
const ROOM = { width: 24, length: 30, height: 9, backZ: 14.5, centerZ: 7 };

export class GameScene {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(PALETTE.bg);
    this.scene.fog = new THREE.Fog(PALETTE.bg, 20, 48);

    /* Surfaces a missed shot can land on (used for miss marks) */
    this.surfaces = [];

    this.buildLights();
    this.buildRoom();
    this.buildAmbientOcclusion();
    this.buildFloorMarkers();
    this.buildSignage();
    this.buildTargetZone();
  }

  buildLights() {
    this.scene.add(new THREE.HemisphereLight(0xc4cfdc, 0x1a1f25, 2.4));

    /* Key light only casts shadows when the High quality preset turns them on */
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(3, 10, 1);
    key.target.position.set(0, 0, 10);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 30;
    key.shadow.camera.left = -10;
    key.shadow.camera.right = 10;
    key.shadow.camera.top = 12;
    key.shadow.camera.bottom = -4;
    key.shadow.bias = -0.0005;
    this.scene.add(key, key.target);

    /* Soft wash on the back wall so the target zone is the brightest area */
    const wash = new THREE.PointLight(0xe8eef5, 40, 22, 2);
    wash.position.set(0, 4, 9);
    this.scene.add(wash);
  }

  buildRoom() {
    const { width, length, height, backZ, centerZ } = ROOM;

    const wallTexture = makePanelTexture(PALETTE.wall, PALETTE.wallSeam, 2);
    const wallMat = new THREE.MeshStandardMaterial({ map: wallTexture, roughness: 0.92, metalness: 0 });
    const floorTexture = makePanelTexture(PALETTE.floor, PALETTE.floorSeam, 4);
    const floorMat = new THREE.MeshStandardMaterial({ map: floorTexture, roughness: 0.85, metalness: 0 });

    const floor = this.addSurface(new THREE.PlaneGeometry(width, length), floorMat, (m) => {
      m.rotation.x = -Math.PI / 2;
      m.position.z = centerZ;
    }, { x: width / 3, y: length / 3 });

    const back = this.addSurface(new THREE.PlaneGeometry(width, height), wallMat, (m) => {
      m.rotation.y = Math.PI;
      m.position.set(0, height / 2, backZ);
    }, { x: width / 3, y: height / 3 });

    for (const side of [-1, 1]) {
      this.addSurface(new THREE.PlaneGeometry(length, height), wallMat, (m) => {
        m.rotation.y = -side * Math.PI / 2;
        m.position.set(side * width / 2, height / 2, centerZ);
      }, { x: length / 3, y: height / 3 });
    }

    /* Wall behind the player closes the box so idle camera drift never sees the void */
    this.addSurface(new THREE.PlaneGeometry(width, height), wallMat, (m) => {
      m.position.set(0, height / 2, centerZ - length / 2);
    }, { x: width / 3, y: height / 3 });

    floor.receiveShadow = true;
    back.receiveShadow = true;

    this.buildCeiling();
    this.buildBaseboards();
  }

  /* Adds a room plane with its own texture repeat so panels stay 3m square on every wall */
  addSurface(geometry, material, place, repeat) {
    const mat = material.clone();
    mat.map = material.map.clone();
    mat.map.needsUpdate = true;
    mat.map.repeat.set(repeat.x, repeat.y);
    const mesh = new THREE.Mesh(geometry, mat);
    place(mesh);
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    this.surfaces.push(mesh);
    return mesh;
  }

  buildCeiling() {
    const { width, length, height, centerZ } = ROOM;
    const ceiling = new THREE.Mesh(
      new THREE.PlaneGeometry(width, length),
      new THREE.MeshStandardMaterial({ color: PALETTE.ceiling, emissive: 0x161a1f, roughness: 1, metalness: 0 })
    );
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(0, height, centerZ);
    this.scene.add(ceiling);
    this.surfaces.push(ceiling);

    /* Two light strips along the side edges of the ceiling: they light the room
       without putting a bright shape behind the HUD at the top-center of the view */
    const stripMat = new THREE.MeshBasicMaterial({ color: 0xc9ced4 });
    const stripGeo = new THREE.BoxGeometry(0.22, 0.04, 16);
    const housingMat = new THREE.MeshStandardMaterial({ color: 0x101316, roughness: 0.7, metalness: 0.2 });
    const housingGeo = new THREE.BoxGeometry(0.46, 0.08, 16.3);
    for (const x of [-7.5, 7.5]) {
      const housing = new THREE.Mesh(housingGeo, housingMat);
      housing.position.set(x, height - 0.04, 6);
      const strip = new THREE.Mesh(stripGeo, stripMat);
      strip.position.set(x, height - 0.085, 6);
      this.scene.add(housing, strip);
    }
  }

  /* Thin dark baseboard where walls meet the floor, so corners read crisply */
  buildBaseboards() {
    const { width, length, backZ, centerZ } = ROOM;
    const mat = new THREE.MeshStandardMaterial({ color: 0x0e1215, roughness: 0.8 });
    const back = new THREE.Mesh(new THREE.BoxGeometry(width, 0.12, 0.04), mat);
    back.position.set(0, 0.06, backZ - 0.02);
    this.scene.add(back);
    for (const side of [-1, 1]) {
      const board = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.12, length), mat);
      board.position.set(side * (width / 2 - 0.02), 0.06, centerZ);
      this.scene.add(board);
    }
  }

  /* Fake ambient occlusion: soft dark gradients wherever two room surfaces meet.
     Corners stop looking razor-flat, which is most of what makes a room read as solid. */
  buildAmbientOcclusion() {
    const { width, length, height, backZ, centerZ } = ROOM;
    const fade = makeFadeTexture();
    const material = new THREE.MeshBasicMaterial({ map: fade, transparent: true, depthWrite: false });
    const band = (w, h, place) => {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
      place(mesh);
      mesh.renderOrder = 1;
      this.scene.add(mesh);
    };
    const reach = 1.9;
    const frontZ = centerZ - length / 2;
    /* Floor bands: dark at the wall, fading toward the room (texture top = dark edge) */
    band(width, reach, (m) => { m.rotation.set(-Math.PI / 2, 0, Math.PI); m.position.set(0, 0.005, backZ - reach / 2); });
    band(width, reach, (m) => { m.rotation.x = -Math.PI / 2; m.position.set(0, 0.005, frontZ + reach / 2); });
    for (const side of [-1, 1]) {
      band(length, reach, (m) => {
        m.rotation.set(-Math.PI / 2, 0, -side * Math.PI / 2);
        m.position.set(side * (width / 2 - reach / 2), 0.005, centerZ);
      });
    }
    /* Wall bands: dark at the floor and at the ceiling */
    for (const [y, flip] of [[reach / 2, Math.PI], [height - reach / 2, 0]]) {
      band(width, reach, (m) => { m.rotation.set(0, Math.PI, flip); m.position.set(0, y, backZ - 0.005); });
      for (const side of [-1, 1]) {
        band(length, reach, (m) => {
          m.rotation.set(0, -side * Math.PI / 2, flip);
          m.position.set(side * (width / 2 - 0.005), y, centerZ);
        });
      }
    }
    /* Vertical bands in the two back corners */
    for (const side of [-1, 1]) {
      band(height, reach, (m) => {
        m.rotation.set(0, Math.PI, side * Math.PI / 2);
        m.position.set(side * (width / 2 - reach / 2), height / 2, backZ - 0.006);
      });
    }
  }

  /* Painted distance lines on the floor at 5 m and 10 m from the player */
  buildFloorMarkers() {
    const lineMat = new THREE.MeshBasicMaterial({ color: PALETTE.marker, transparent: true, opacity: 0.28, depthWrite: false });
    for (const distance of [5, 10]) {
      const line = new THREE.Mesh(new THREE.PlaneGeometry(14, 0.035), lineMat);
      line.rotation.x = -Math.PI / 2;
      line.position.set(0, 0.008, distance);
      this.scene.add(line);

      const label = new THREE.Mesh(
        new THREE.PlaneGeometry(1.8, 0.6),
        new THREE.MeshBasicMaterial({ map: makeTextTexture(`${distance} m`, 256, 84, 60), transparent: true, opacity: 0.55, depthWrite: false })
      );
      /* Flat on the floor, readable from the player's position, left of center */
      label.rotation.set(-Math.PI / 2, 0, Math.PI);
      label.position.set(5.6, 0.009, distance + 0.5);
      this.scene.add(label);
    }
  }

  /* Low-contrast range name painted on the left wall: gives the place an identity */
  buildSignage() {
    const { width } = ROOM;
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(9, 2.2),
      new THREE.MeshBasicMaterial({ map: makeTextTexture('AIMLABS', 1024, 250, 210, 0.07), transparent: true, depthWrite: false })
    );
    sign.rotation.y = -Math.PI / 2;
    sign.position.set(width / 2 - 0.01, 5.6, 6);
    const sub = new THREE.Mesh(
      new THREE.PlaneGeometry(3.2, 0.5),
      new THREE.MeshBasicMaterial({ map: makeTextTexture('RANGE 01', 512, 80, 56, 0.16), transparent: true, depthWrite: false })
    );
    sub.rotation.y = -Math.PI / 2;
    sub.position.set(width / 2 - 0.01, 4.15, 3.1);
    this.scene.add(sign, sub);
  }

  /* Corner brackets on the back wall frame where targets spawn (x ±5, y 0.7-4.5) */
  buildTargetZone() {
    const mat = new THREE.MeshBasicMaterial({ color: PALETTE.marker, transparent: true, opacity: 0.55 });
    const z = ROOM.backZ - 0.01;
    const left = -6.2, right = 6.2, bottom = 0.35, top = 5.1, arm = 0.7, t = 0.035;
    const corners = [[left, bottom, 1, 1], [right, bottom, -1, 1], [left, top, 1, -1], [right, top, -1, -1]];
    for (const [x, y, dx, dy] of corners) {
      const horizontal = new THREE.Mesh(new THREE.PlaneGeometry(arm, t), mat);
      horizontal.position.set(x + dx * arm / 2, y, z);
      horizontal.rotation.y = Math.PI;
      const vertical = new THREE.Mesh(new THREE.PlaneGeometry(t, arm), mat);
      vertical.position.set(x, y + dy * arm / 2, z);
      vertical.rotation.y = Math.PI;
      this.scene.add(horizontal, vertical);
    }

    /* Small center tick at eye height: a resting point for the eyes between drills */
    const tick = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.12), mat);
    tick.position.set(0, 1.6, z);
    tick.rotation.set(0, Math.PI, Math.PI / 4);
    this.scene.add(tick);
  }
}

/* Draws one 3m wall panel: flat base colour, a faint vertical light falloff, and
   seams on two edges so tiled panels form a clean grid. Returned as a repeatable texture. */
function makePanelTexture(base, seam, seamWidth) {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;

  ctx.fillStyle = hex(base);
  ctx.fillRect(0, 0, size, size);

  const shade = ctx.createLinearGradient(0, 0, 0, size);
  shade.addColorStop(0, 'rgba(255,255,255,0.025)');
  shade.addColorStop(1, 'rgba(0,0,0,0.04)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, size, size);

  ctx.fillStyle = hex(seam);
  ctx.fillRect(0, 0, size, seamWidth);
  ctx.fillRect(0, 0, seamWidth, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}

/* Vertical alpha gradient: opaque black at the top edge fading to clear (fake AO) */
function makeFadeTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, 128);
  gradient.addColorStop(0, 'rgba(2,3,4,0.95)');
  gradient.addColorStop(0.3, 'rgba(2,3,4,0.5)');
  gradient.addColorStop(0.65, 'rgba(2,3,4,0.15)');
  gradient.addColorStop(1, 'rgba(4,6,8,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 4, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/* Text painted onto a transparent canvas in Geist (falls back to the system sans) */
function makeTextTexture(text, width, height, size, alpha = 1) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = `rgba(232,236,240,${alpha})`;
  ctx.font = `600 ${size}px Geist, 'Segoe UI', sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${Math.round(size * 0.06)}px`;
  ctx.fillText(text, width / 2, height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}
