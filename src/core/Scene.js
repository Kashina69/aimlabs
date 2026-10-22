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

    /* Back wall sits just behind the furthest target spawn (z = 13).
       It is LIGHTER than the floor/side walls so it clearly reads as the
       wall the range ends at, instead of blending into the gray room. */
    const backWallMat = new THREE.MeshStandardMaterial({
      color: 0x323c4c,
      roughness: 0.85,
      metalness: 0.0,
      /* Base emissive lift: the hemisphere light alone is not enough brightness
         for the wall to read at this distance */
      emissive: 0x121a26,
      emissiveIntensity: 1.0
    });
    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(roomWidth, wallHeight), backWallMat);
    /* PlaneGeometry faces +Z by default; flip it so the lit face points at the
       player (this is why the wall used to render as an unlit black plane) */
    backWall.rotation.y = Math.PI;
    backWall.position.set(0, wallHeight / 2, 14.5);
    backWall.receiveShadow = true;
    this.scene.add(backWall);

    /* Skirting board pins the wall to the floor line */
    const skirtMat = new THREE.MeshStandardMaterial({ color: 0x4a5668, roughness: 0.8 });
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(roomWidth, 0.45, 0.12), skirtMat);
    skirt.position.set(0, 0.22, 14.43);
    this.scene.add(skirt);

    /* Faint vertical panel seams give the wall surface real texture */
    const seamMat = new THREE.MeshStandardMaterial({ color: 0x3a4556, roughness: 0.9 });
    const halfSpan = roomWidth / 2 - 1.5;
    for (let x = -halfSpan; x <= halfSpan; x += 3) {
      const seam = new THREE.Mesh(new THREE.BoxGeometry(0.04, wallHeight - 0.4, 0.03), seamMat);
      seam.position.set(x, (wallHeight - 0.4) / 2 + 0.4, 14.47);
      this.scene.add(seam);
    }

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
    /* Soft cyan wash over the back wall — placed well in front of the wall so
       the falloff covers the whole surface, not a hot spot. Renderer uses
       physical light units since r155, so point/spot intensities are candela. */
    const glow = new THREE.PointLight(0x00e5ff, 55, 26, 2);
    glow.position.set(0, 3.5, 11);
    this.scene.add(glow);

    /* A warm spotlight aimed at the wall so the surface reads as an actual
       lit wall instead of a flat black plane */
    const wallSpot = new THREE.SpotLight(0xfff4e0, 130, 40, 0.85, 0.8, 2);
    wallSpot.position.set(0, 8.4, 9.5);
    wallSpot.target.position.set(0, 3, 14.5);
    this.scene.add(wallSpot);
    this.scene.add(wallSpot.target);
  }
}
