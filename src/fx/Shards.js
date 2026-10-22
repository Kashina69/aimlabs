import * as THREE from '../three-shim.js';

/* Kill feedback in the world: a burst of small shards plus one expanding ring.
   All shards live in a single InstancedMesh (one draw call) and are recycled
   round-robin, so bursts never allocate during play. */
const SHARD_COUNT = 96;
const SHARDS_PER_BURST = 12;
const SHARD_LIFE = 0.24;
const RING_COUNT = 4;
const RING_LIFE = 0.18;

const tmpMatrix = new THREE.Matrix4();
const tmpQuat = new THREE.Quaternion();
const tmpScale = new THREE.Vector3();
const tmpEuler = new THREE.Euler();

export class Shards {
  constructor(scene, camera) {
    this.camera = camera;
    this.enabled = true;

    this.material = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false });
    this.mesh = new THREE.InstancedMesh(new THREE.TetrahedronGeometry(0.06), this.material, SHARD_COUNT);
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.shards = Array.from({ length: SHARD_COUNT }, () => ({
      life: 0, size: 1, pos: new THREE.Vector3(), vel: new THREE.Vector3(), spin: new THREE.Vector3()
    }));
    this.next = 0;
    this.hideAll();
    scene.add(this.mesh);

    const ringGeometry = new THREE.RingGeometry(0.92, 1, 48);
    this.rings = Array.from({ length: RING_COUNT }, () => {
      const ring = new THREE.Mesh(ringGeometry, new THREE.MeshBasicMaterial({
        color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide
      }));
      ring.visible = false;
      ring.userData = { life: 0, radius: 1 };
      scene.add(ring);
      return ring;
    });
    this.nextRing = 0;
  }

  setColor(color) {
    this.material.color.set(color);
    for (const ring of this.rings) ring.material.color.set(color);
  }

  /* Fires a burst at a killed target's position, sized to the target */
  burst(position, radius) {
    if (!this.enabled) return;
    const scale = radius / 0.3;
    for (let i = 0; i < SHARDS_PER_BURST; i++) {
      const shard = this.shards[this.next];
      this.next = (this.next + 1) % SHARD_COUNT;
      shard.life = SHARD_LIFE * (0.75 + Math.random() * 0.5);
      shard.size = scale * (0.6 + Math.random() * 0.6);
      shard.pos.copy(position);
      shard.vel.set(Math.random() - 0.5, Math.random() - 0.35, Math.random() - 0.5)
        .normalize()
        .multiplyScalar((2.8 + Math.random() * 2.2) * scale);
      shard.spin.set(Math.random() * 12, Math.random() * 12, Math.random() * 12);
    }

    const ring = this.rings[this.nextRing];
    this.nextRing = (this.nextRing + 1) % RING_COUNT;
    ring.position.copy(position);
    ring.userData.life = RING_LIFE;
    ring.userData.radius = radius;
    ring.visible = true;
  }

  update(dt) {
    let dirty = false;
    for (let i = 0; i < SHARD_COUNT; i++) {
      const shard = this.shards[i];
      if (shard.life <= 0) continue;
      shard.life -= dt;
      dirty = true;
      if (shard.life <= 0) {
        this.mesh.setMatrixAt(i, tmpMatrix.makeScale(0, 0, 0));
        continue;
      }
      shard.vel.multiplyScalar(Math.max(0, 1 - dt * 6));
      shard.vel.y -= 4 * dt;
      shard.pos.addScaledVector(shard.vel, dt);
      const t = shard.life / SHARD_LIFE;
      tmpEuler.set(shard.spin.x * t, shard.spin.y * t, shard.spin.z * t);
      tmpQuat.setFromEuler(tmpEuler);
      tmpScale.setScalar(shard.size * t);
      this.mesh.setMatrixAt(i, tmpMatrix.compose(shard.pos, tmpQuat, tmpScale));
    }
    if (dirty) this.mesh.instanceMatrix.needsUpdate = true;

    for (const ring of this.rings) {
      if (!ring.visible) continue;
      ring.userData.life -= dt;
      if (ring.userData.life <= 0) {
        ring.visible = false;
        continue;
      }
      const progress = 1 - ring.userData.life / RING_LIFE;
      const eased = 1 - Math.pow(1 - progress, 3);
      ring.scale.setScalar(ring.userData.radius * (1.1 + eased * 1.3));
      ring.material.opacity = 0.75 * (1 - progress);
      ring.quaternion.copy(this.camera.quaternion);
    }
  }

  hideAll() {
    for (let i = 0; i < SHARD_COUNT; i++) {
      this.shards[i].life = 0;
      this.mesh.setMatrixAt(i, tmpMatrix.makeScale(0, 0, 0));
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    for (const ring of this.rings || []) ring.visible = false;
  }
}
