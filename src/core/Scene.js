import * as THREE from '../three-shim.js';

/* Minimalist shooting-range environment: a dark room built from flat planes,
   a soft top light and a few neon accent strips so targets pop. */
export class GameScene {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x10151d);
    this.scene.fog = new THREE.Fog(0x10151d, 18, 45);

    this.buildLights();
    this.buildRoom();
    this.buildAccents();
  }

  buildLights() {
    /* Hemisphere gives soft base shading, the directional adds definition and shadows */
    const hemi = new THREE.HemisphereLight(0x9fb6cc, 0x1a2030, 0.55);
    this.scene.add(hemi);

    const key = new THREE.DirectionalLight(0xffffff, 0.9);
    key.position.set(4, 10, 2);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 30;
    key.shadow.camera.left = -12;
    key.shadow.camera.right = 12;
    key.shadow.camera.top = 12;
    key.shadow.camera.bottom = -2;
    this.scene.add(key);
  }

  buildRoom() {
    const { roomWidth, roomLength, wallHeight } = { roomWidth: 24, roomLength: 30, wallHeight: 9 };
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x1c222c, roughness: 0.95, metalness: 0.0 });
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x232a36, roughness: 0.9, metalness: 0.0 });

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(roomWidth, roomLength), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.z = roomLength / 2 - 8;
    floor.receiveShadow = true;
    this.scene.add(floor);

    /* Back wall sits just behind the furthest target spawn (z = 13) */
    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(roomWidth, wallHeight), wallMat);
    backWall.position.set(0, wallHeight / 2, 14.5);
    backWall.receiveShadow = true;
    this.scene.add(backWall);

    for (const side of [-1, 1]) {
      const wall = new THREE.Mesh(new THREE.PlaneGeometry(roomLength, wallHeight), wallMat.clone());
      wall.rotation.y = side * Math.PI / 2;
      wall.position.set(side * roomWidth / 2, wallHeight / 2, roomLength / 2 - 8);
      wall.receiveShadow = true;
      this.scene.add(wall);
    }

    /* Player sits in a small alcove behind x=0 so the grid reads as a booth floor */
    const grid = new THREE.GridHelper(24, 48, 0x2f4658, 0x26394a);
    grid.position.set(0, 0.01, -3);
    grid.scale.set(1, 1, 1.9);
    this.scene.add(grid);

    this.buildCeiling(roomWidth, roomLength, wallHeight);
  }

  /* Encloses the room on top so the upper view reads as indoor lighting,
     not like the surface of water stretching away */
  buildCeiling(roomWidth, roomLength, wallHeight) {
    const ceilingMat = new THREE.MeshStandardMaterial({
      color: 0x202836,
      emissive: 0x1b222d,
      emissiveIntensity: 1.0,
      roughness: 0.95,
      metalness: 0.0,
      side: THREE.DoubleSide
    });

    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(roomWidth, roomLength), ceilingMat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(0, wallHeight, roomLength / 2 - 8);
    this.scene.add(ceiling);

    /* Soft warm light panels strip the ceiling, mirroring the neon accents below */
    const panelMat = new THREE.MeshStandardMaterial({
      color: 0x1a1f28,
      emissive: 0xfff0d8,
      emissiveIntensity: 1.2
    });

    const panelGeometry = new THREE.BoxGeometry(6, 0.04, 0.5);
    for (let i = 0; i < 4; i++) {
      const panel = new THREE.Mesh(panelGeometry, panelMat);
      panel.position.set(0, wallHeight - 0.05, -4 + i * 5);
      this.scene.add(panel);

      // faint warm glow so the panels don't look like dead strips
      const glow = new THREE.PointLight(0xffe9c8, 0.15, 12);
      glow.position.set(0, wallHeight - 0.6, -4 + i * 5);
      this.scene.add(glow);
    }
  }

  buildAccents() {
    /* Thin neon strips frame the back wall and give the room depth */
    const stripMat = new THREE.MeshStandardMaterial({
      color: 0x0a0f14,
      emissive: 0x00e5ff,
      emissiveIntensity: 1.0
    });

    this.addBackWallStrip(stripMat, 5.4, 0.06, 22);
    this.addBackWallStrip(stripMat, 1.8, 0.04, 16);

    const glow = new THREE.PointLight(0x00e5ff, 0.35, 22);
    glow.position.set(0, 3, 13.5);
    this.scene.add(glow);
  }

  addBackWallStrip(material, height, thickness, width) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(width, thickness, 0.02), material);
    strip.position.set(0, height, 14.42);
    this.scene.add(strip);
  }
}
