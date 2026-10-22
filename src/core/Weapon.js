import * as THREE from '../three-shim.js';

/* Pistol viewmodel with a two-handed stance, built from small boxes/cylinders
   so it reads like a proper gun instead of a single grey rectangle. Attached
   to the camera so it always moves with the player's view. */
export class Weapon {
  constructor(camera) {
    this.camera = camera;

    this.group = new THREE.Group();
    this.basePosition = new THREE.Vector3(0.27, -0.23, -0.52);
    this.baseRotation = new THREE.Euler(-0.02, 0.05, 0.02);

    this.kick = 0;       // recoil amount 0..1
    this.flashLife = 0;  // muzzle flash lifetime 0..1
    this.swayX = 0;
    this.swayY = 0;
    this.time = 0;

    this.buildMaterials();
    this.buildGun();
    this.buildHands();
    this.buildMuzzleFlash();
    this.applyBaseTransform();

    /* Small fill light so the dark gunmetal keeps its shape in a dark room */
    const fill = new THREE.PointLight(0xcfe4ff, 0.35, 1.4);
    fill.position.set(0.12, 0.18, 0.4);
    this.group.add(fill);

    camera.add(this.group);
  }

  buildMaterials() {
    this.mats = {
      polymer: new THREE.MeshStandardMaterial({ color: 0x2c3138, roughness: 0.6, metalness: 0.3 }),
      steel: new THREE.MeshStandardMaterial({ color: 0x565e69, roughness: 0.32, metalness: 0.85 }),
      darkSteel: new THREE.MeshStandardMaterial({ color: 0x1e2329, roughness: 0.45, metalness: 0.65 }),
      sight: new THREE.MeshStandardMaterial({ color: 0x050a0c, emissive: 0x00e5ff, emissiveIntensity: 2.2 }),
      skin: new THREE.MeshStandardMaterial({ color: 0xb9835f, roughness: 0.8, metalness: 0.0 }),
      skinShade: new THREE.MeshStandardMaterial({ color: 0x96684a, roughness: 0.85, metalness: 0.0 }),
      sleeve: new THREE.MeshStandardMaterial({ color: 0x2a3240, roughness: 0.9, metalness: 0.0 })
    };
  }

  /* Small helper: add a box part at a local offset with optional rotation */
  addBox(size, material, position, rotation = null) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), material);
    mesh.position.set(position.x, position.y, position.z);
    if (rotation) mesh.rotation.set(rotation.x, rotation.y, rotation.z);
    this.group.add(mesh);
    return mesh;
  }

  buildGun() {
    /* Frame and slide carry the silhouette; everything else is small detail blocks */
    this.addBox({ x: 0.066, y: 0.072, z: 0.26 }, this.mats.polymer, { x: 0, y: 0.03, z: 0 });
    this.addBox({ x: 0.072, y: 0.05, z: 0.3 }, this.mats.steel, { x: 0, y: 0.092, z: 0.012 });
    this.addBox({ x: 0.076, y: 0.022, z: 0.09 }, this.mats.darkSteel, { x: 0, y: 0.096, z: 0.13 });

    /* Slide serrations for the "realistic, not low-poly" read */
    for (let i = 0; i < 4; i++) {
      this.addBox({ x: 0.078, y: 0.036, z: 0.004 }, this.mats.darkSteel, { x: 0, y: 0.092, z: 0.095 + i * 0.012 });
    }

    /* Barrel and muzzle */
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.045, 12), this.mats.darkSteel);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.096, -0.165);
    this.group.add(barrel);

    /* Sights: glowing front dot, two rear posts */
    this.addBox({ x: 0.014, y: 0.02, z: 0.01 }, this.mats.darkSteel, { x: 0, y: 0.125, z: -0.115 });
    this.addBox({ x: 0.007, y: 0.007, z: 0.007 }, this.mats.sight, { x: 0, y: 0.137, z: -0.115 });
    for (const side of [-1, 1]) {
      this.addBox({ x: 0.01, y: 0.018, z: 0.01 }, this.mats.darkSteel, { x: side * 0.014, y: 0.125, z: 0.135 });
    }

    /* Grip: slopes down and back from the frame */
    this.addBox({ x: 0.056, y: 0.2, z: 0.078 }, this.mats.polymer, { x: 0, y: -0.075, z: 0.105 }, { x: -0.28, y: 0, z: 0 });
    this.addBox({ x: 0.062, y: 0.012, z: 0.082 }, this.mats.darkSteel, { x: 0, y: -0.172, z: 0.131 }, { x: -0.28, y: 0, z: 0 });

    /* Trigger guard, trigger and ejection port */
    this.addBox({ x: 0.03, y: 0.01, z: 0.055 }, this.mats.polymer, { x: 0, y: -0.016, z: 0.028 });
    this.addBox({ x: 0.03, y: 0.05, z: 0.008 }, this.mats.polymer, { x: 0, y: -0.045, z: 0 });
    this.addBox({ x: 0.012, y: 0.03, z: 0.006 }, this.mats.darkSteel, { x: 0, y: -0.045, z: 0.02 }, { x: 0.15, y: 0, z: 0 });
    this.addBox({ x: 0.02, y: 0.028, z: 0.05 }, this.mats.darkSteel, { x: 0.04, y: 0.098, z: 0.02 });
  }

  buildHands() {
    /* Right hand: palm on the right of the grip, fingers wrap around the front,
       trigger finger forward, thumb high on the frame */
    this.addBox({ x: 0.05, y: 0.085, z: 0.085 }, this.mats.skin, { x: 0.045, y: -0.055, z: 0.125 }, { x: -0.2, y: 0, z: 0 });
    for (let i = 0; i < 4; i++) {
      this.addBox({ x: 0.03, y: 0.036, z: 0.018 }, this.mats.skinShade,
        { x: -0.012, y: -0.028 - i * 0.036, z: 0.062 }, { x: 0, y: Math.PI / 2, z: 0.25 });
    }
    this.addBox({ x: 0.014, y: 0.032, z: 0.014 }, this.mats.skin, { x: 0.03, y: -0.03, z: 0.026 }, { x: 0.35, y: 0, z: 0 });
    this.addBox({ x: 0.016, y: 0.05, z: 0.055 }, this.mats.skin, { x: -0.02, y: 0.015, z: 0.09 }, { x: 0.3, y: 0, z: -0.2 });

    /* Left support hand: palm backing the right hand, fingers laced over it */
    this.addBox({ x: 0.048, y: 0.08, z: 0.09 }, this.mats.skinShade, { x: -0.045, y: -0.06, z: 0.185 }, { x: -0.25, y: 0, z: 0.35 });
    for (let i = 0; i < 4; i++) {
      this.addBox({ x: 0.028, y: 0.034, z: 0.016 }, this.mats.skin,
        { x: 0.02, y: -0.03 - i * 0.034, z: 0.155 }, { x: 0, y: Math.PI / 2, z: -0.2 });
    }

    /* Forearms angled off toward the bottom corners of the screen */
    this.addBox({ x: 0.06, y: 0.06, z: 0.2 }, this.mats.skin, { x: 0.105, y: -0.24, z: 0.3 }, { x: 0.75, y: 0, z: -0.18 });
    this.addBox({ x: 0.07, y: 0.07, z: 0.2 }, this.mats.sleeve, { x: 0.16, y: -0.35, z: 0.46 }, { x: 0.75, y: 0, z: -0.18 });
    this.addBox({ x: 0.06, y: 0.06, z: 0.2 }, this.mats.skinShade, { x: -0.12, y: -0.26, z: 0.33 }, { x: 0.75, y: 0, z: 0.22 });
    this.addBox({ x: 0.07, y: 0.07, z: 0.2 }, this.mats.sleeve, { x: -0.18, y: -0.38, z: 0.5 }, { x: 0.75, y: 0, z: 0.22 });
  }

  buildMuzzleFlash() {
    this.flashLight = new THREE.PointLight(0xffc98a, 0, 5);
    this.flashLight.position.set(0, 0.096, -0.2);
    this.group.add(this.flashLight);

    this.flashMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.09, 0.09),
      new THREE.MeshBasicMaterial({
        color: 0xffd9a0,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
      })
    );
    this.flashMesh.position.set(0, 0.096, -0.21);
    this.group.add(this.flashMesh);
  }

  applyBaseTransform() {
    this.group.position.copy(this.basePosition);
    this.group.rotation.copy(this.baseRotation);
  }

  /* Called on each shot: drives recoil and the muzzle flash */
  shoot() {
    this.kick = 1;
    this.flashLife = 1;
  }

  /* Feeds raw mouse movement into a small sway offset so the gun feels held */
  sway(dx, dy) {
    this.swayX = THREE.MathUtils.clamp(this.swayX + dx * 0.0012, -0.02, 0.02);
    this.swayY = THREE.MathUtils.clamp(this.swayY + dy * 0.0012, -0.02, 0.02);
  }

  update(dt) {
    this.time += dt;

    const settle = Math.min(1, dt * 14);
    this.kick = Math.max(0, this.kick - settle * this.kick);
    this.flashLife = Math.max(0, this.flashLife - dt * 22);
    this.swayX *= Math.max(0, 1 - dt * 8);
    this.swayY *= Math.max(0, 1 - dt * 8);

    const idleBob = Math.sin(this.time * 1.3) * 0.0025;
    this.group.position.set(
      this.basePosition.x + this.swayX,
      this.basePosition.y + this.swayY + idleBob,
      this.basePosition.z + this.kick * 0.06
    );
    this.group.rotation.set(
      this.baseRotation.x + this.kick * 0.22 + this.swayY * 3,
      this.baseRotation.y - this.swayX * 2,
      this.baseRotation.z + this.kick * 0.05
    );

    const flash = this.flashLife * this.flashLife;
    this.flashLight.intensity = flash * 9;
    this.flashMesh.material.opacity = flash * 0.85;
    this.flashMesh.rotation.z = this.time * 30;
    const flashScale = 0.8 + this.kick * 0.5;
    this.flashMesh.scale.set(flashScale, flashScale, flashScale);
  }
}
