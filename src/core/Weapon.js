import * as THREE from '../three-shim.js';
import { RoomEnvironment } from '../vendor/addons/environments/RoomEnvironment.js';
import { buildPistol } from './weapon/PistolModel.js';

const VIEW_FOV = 54;           // fixed vertical FOV for the gun, independent of the player's FOV
/* Pistol sits bottom-right, about 60% on screen; the grip and rear run off the edge */
const REST = { x: 0.115, y: -0.094, z: -0.29 };
const REST_ROT = { x: 0.045, y: 0.17, z: 0.08 };
const SHELL_COUNT = 6;
const EQUIP_MS = 380;

/* First-person pistol viewmodel. The gun lives in its own scene and camera and
   is drawn after the range with depth cleared (Renderer.setOverlay), so it never
   clips into walls and never stretches with a wide player FOV.
   Public API used by Game: shoot(), sway(dx, dy), equip(), update(dt),
   setVisible(), attachRoomLight(camera), resize(). */
export class Weapon {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(VIEW_FOV, window.innerWidth / window.innerHeight, 0.01, 5);

    this.kick = 0;
    this.slideBack = 0;
    this.flashLife = 0;
    this.swayX = 0;
    this.swayY = 0;
    this.lagX = 0;
    this.lagY = 0;
    this.time = 0;
    this.equipStart = -Infinity;

    this.buildMaterials();
    this.rig = new THREE.Group();
    const pistol = buildPistol(this.mats);
    this.slide = pistol.slide;
    this.muzzle = pistol.muzzle;
    this.port = pistol.port;
    this.rig.add(pistol.root);
    this.scene.add(this.rig);

    this.buildLights();
    this.buildMuzzleFlash();
    this.buildShells();
    this.applyRest(0, 0, 0, 0, 0);
  }

  buildMaterials() {
    const grip = makeStippleTexture();
    this.mats = {
      slide: new THREE.MeshStandardMaterial({ color: 0x454b53, metalness: 0.55, roughness: 0.42 }),
      slideDark: new THREE.MeshStandardMaterial({ color: 0x15181c, metalness: 0.6, roughness: 0.5 }),
      barrel: new THREE.MeshStandardMaterial({ color: 0x8b929b, metalness: 0.95, roughness: 0.28 }),
      bore: new THREE.MeshBasicMaterial({ color: 0x050607 }),
      polymer: new THREE.MeshStandardMaterial({ color: 0x24282d, metalness: 0.05, roughness: 0.72, bumpMap: grip, bumpScale: 0.6 }),
      polymerDark: new THREE.MeshStandardMaterial({ color: 0x181b1f, metalness: 0.1, roughness: 0.6 }),
      fibre: new THREE.MeshBasicMaterial({ color: 0xc8f23c, toneMapped: false }),
      brass: new THREE.MeshStandardMaterial({ color: 0xc8a25e, metalness: 1, roughness: 0.3 })
    };
  }

  /* Lighting roughly matches the range: cool sky fill, soft key from above-left, a rim from behind */
  buildLights() {
    this.scene.add(new THREE.HemisphereLight(0xc4cfdc, 0x1a1f25, 1.2));
    const key = new THREE.DirectionalLight(0xffffff, 1.8);
    key.position.set(-0.6, 1.2, 0.4);
    const rim = new THREE.DirectionalLight(0xdfe7f0, 1.4);
    rim.position.set(0.8, 0.4, -1.2);
    this.scene.add(key, rim);
  }

  /* Reflections for metal parts: a neutral studio environment, gun scene only */
  initEnvironment(renderer) {
    const pmrem = new THREE.PMREMGenerator(renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    for (const mat of Object.values(this.mats)) {
      if (mat.isMeshStandardMaterial) mat.envMapIntensity = mat.metalness > 0.5 ? 0.9 : 0.3;
    }
  }

  /* Star flash: two crossed planes with a 4-spike canvas texture, additive */
  buildMuzzleFlash() {
    const material = new THREE.MeshBasicMaterial({
      map: makeFlashTexture(), color: 0xffd9a8, transparent: true, opacity: 0,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false
    });
    this.flash = new THREE.Group();
    const front = new THREE.Mesh(new THREE.PlaneGeometry(0.075, 0.075), material);
    const side = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.05), material);
    side.rotation.y = Math.PI / 2;
    side.position.z = -0.03;
    this.flash.add(front, side);
    this.flash.visible = false;
    this.muzzle.add(this.flash);
    this.flashMaterial = material;
  }

  /* Pooled brass casings thrown out of the ejection port */
  buildShells() {
    const geometry = new THREE.CylinderGeometry(0.0045, 0.0045, 0.019, 12);
    geometry.rotateZ(Math.PI / 2);
    this.shells = Array.from({ length: SHELL_COUNT }, () => {
      const mesh = new THREE.Mesh(geometry, this.mats.brass);
      mesh.visible = false;
      this.scene.add(mesh);
      return { mesh, life: 0, vel: new THREE.Vector3(), spin: new THREE.Vector3() };
    });
    this.nextShell = 0;
    this.tmp = new THREE.Vector3();
  }

  /* A brief warm light in the RANGE scene, so each shot lights the room for a frame or two */
  attachRoomLight(worldCamera) {
    this.roomLight = new THREE.PointLight(0xffc98a, 0, 6, 2);
    this.roomLight.position.set(0.25, -0.1, -0.6);
    worldCamera.add(this.roomLight);
  }

  setVisible(visible) {
    this.rig.visible = visible;
    for (const shell of this.shells) if (!visible) shell.mesh.visible = false;
  }

  resize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  }

  /* Raise the gun into view when a drill starts */
  equip() {
    this.equipStart = performance.now();
  }

  shoot() {
    this.kick = 1;
    this.slideBack = 1;
    this.flashLife = 1;
    this.flash.rotation.z = Math.random() * Math.PI;
    const s = 0.85 + Math.random() * 0.3;
    this.flash.scale.set(s, s, s);
    this.ejectShell();
  }

  ejectShell() {
    if (!this.rig.visible) return;
    const shell = this.shells[this.nextShell];
    this.nextShell = (this.nextShell + 1) % SHELL_COUNT;
    this.rig.updateMatrixWorld(true);
    this.port.getWorldPosition(shell.mesh.position);
    shell.vel.set(0.9 + Math.random() * 0.4, 0.75 + Math.random() * 0.3, 0.15 + Math.random() * 0.2);
    shell.spin.set(Math.random() * 30, Math.random() * 30, 20 + Math.random() * 20);
    shell.life = 0.6;
    shell.mesh.visible = true;
  }

  /* Mouse movement feeds a small lag so the gun trails the view slightly */
  sway(dx, dy) {
    this.swayX = THREE.MathUtils.clamp(this.swayX + dx * 0.9, -0.03, 0.03);
    this.swayY = THREE.MathUtils.clamp(this.swayY + dy * 0.9, -0.03, 0.03);
  }

  update(dt) {
    this.time += dt;

    /* Recoil springs back fast, slide returns faster than the kick */
    this.kick = Math.max(0, this.kick - dt * 9 * (0.4 + this.kick));
    this.slideBack = Math.max(0, this.slideBack - dt * 16);
    this.flashLife = Math.max(0, this.flashLife - dt * 30);
    this.swayX *= Math.max(0, 1 - dt * 10);
    this.swayY *= Math.max(0, 1 - dt * 10);
    this.lagX += (this.swayX - this.lagX) * Math.min(1, dt * 12);
    this.lagY += (this.swayY - this.lagY) * Math.min(1, dt * 12);

    const equip = Math.min(1, (performance.now() - this.equipStart) / EQUIP_MS);
    const lower = 1 - (1 - Math.pow(1 - equip, 3));
    const breathe = Math.sin(this.time * 1.4) * 0.0012;
    this.applyRest(this.kick, this.lagX, this.lagY, breathe, lower);

    /* Slide blowback travels about 2.4cm on the frame */
    this.slide.position.z = Math.sin(Math.min(1, this.slideBack) * Math.PI * 0.5) * 0.024;

    const flash = this.flashLife > 0 ? this.flashLife * this.flashLife : 0;
    this.flash.visible = flash > 0.01;
    this.flashMaterial.opacity = flash;
    if (this.roomLight) this.roomLight.intensity = flash * 18;

    for (const shell of this.shells) {
      if (shell.life <= 0) continue;
      shell.life -= dt;
      if (shell.life <= 0) {
        shell.mesh.visible = false;
        continue;
      }
      shell.vel.y -= 4.5 * dt;
      shell.mesh.position.addScaledVector(shell.vel, dt);
      shell.mesh.rotation.x += shell.spin.x * dt;
      shell.mesh.rotation.y += shell.spin.y * dt;
      shell.mesh.rotation.z += shell.spin.z * dt;
    }
  }

  /* Places the rig at rest plus recoil, sway lag, breathing and equip lowering */
  applyRest(kick, lagX, lagY, breathe, lower) {
    this.rig.position.set(
      REST.x - lagX * 0.6,
      REST.y + lagY * 0.6 + breathe - lower * 0.16 - kick * 0.004,
      REST.z + kick * 0.03
    );
    this.rig.rotation.set(
      REST_ROT.x + kick * 0.16 + lagY * 1.2 - lower * 0.7,
      REST_ROT.y + lagX * 1.4,
      REST_ROT.z - lagX * 0.6 + lower * 0.2
    );
  }
}

/* Fine noise used as a bump map: reads as grip stippling up close */
function makeStippleTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(size, size);
  for (let i = 0; i < image.data.length; i += 4) {
    const v = 110 + Math.random() * 120;
    image.data[i] = image.data[i + 1] = image.data[i + 2] = v;
    image.data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(30, 30);
  return texture;
}

/* Soft core plus four tapered spikes */
function makeFlashTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const c = size / 2;
  const core = ctx.createRadialGradient(c, c, 0, c, c, c * 0.55);
  core.addColorStop(0, 'rgba(255,255,255,1)');
  core.addColorStop(0.35, 'rgba(255,220,160,0.85)');
  core.addColorStop(1, 'rgba(255,160,60,0)');
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, size, size);
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 4; i++) {
    ctx.save();
    ctx.translate(c, c);
    ctx.rotate((i * Math.PI) / 2 + 0.2);
    const spike = ctx.createLinearGradient(0, 0, c, 0);
    spike.addColorStop(0, 'rgba(255,230,180,0.9)');
    spike.addColorStop(1, 'rgba(255,170,80,0)');
    ctx.fillStyle = spike;
    ctx.beginPath();
    ctx.moveTo(0, -5);
    ctx.lineTo(c, 0);
    ctx.lineTo(0, 5);
    ctx.fill();
    ctx.restore();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
