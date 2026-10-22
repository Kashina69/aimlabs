import * as THREE from '../three-shim.js';
import { createTargetMaterial } from '../core/Target.js';

/* Ghost run behind the home menu: replays the selected drill so players see what
   it is before they start (motion with an explanation purpose). It owns its own
   four target meshes and never touches the gameplay pool or scoring. */
const ZONE = { x: 4.2, yMin: 1.1, yMax: 4.1, zMin: 9.5, zMax: 12.5 };
const SPAWN_MS = 140;
const tmp = new THREE.Vector3();

export class MenuPreview {
  constructor(scene, shards) {
    this.shards = shards;
    this.group = new THREE.Group();
    this.geometry = new THREE.SphereGeometry(0.3, 32, 20);
    this.targets = Array.from({ length: 4 }, () => {
      const mesh = new THREE.Mesh(this.geometry, createTargetMaterial());
      mesh.visible = false;
      this.group.add(mesh);
      return { mesh, bornAt: 0, popAt: Infinity };
    });
    scene.add(this.group);
    this.mode = null;
    this.clock = 0;
    this.nextEvent = 0;
  }

  setVisible(visible) {
    this.group.visible = visible;
    if (!visible) this.mode = null;
  }

  setColor(color) {
    for (const t of this.targets) {
      t.mesh.material.color.set(color).multiplyScalar(0.28);
      t.mesh.material.emissive.set(color);
    }
  }

  /* Switch the ghost run to another drill; restarts its choreography */
  setMode(mode) {
    if (mode === this.mode) return;
    this.mode = mode;
    this.clock = 0;
    this.nextEvent = 0;
    for (const t of this.targets) t.mesh.visible = false;
    if (mode === 'Static') this.targets.forEach((t, i) => this.spawn(t, i * 90));
  }

  update(dt) {
    if (!this.group.visible || !this.mode) return;
    this.clock += dt * 1000;
    const now = this.clock;

    if (this.mode === 'Static') this.updateGridshot(now);
    else if (this.mode === 'Flick') this.updateFlick(now);
    else if (this.mode === 'Tracking') this.updateTracking(now);
    else if (this.mode === 'Reaction') this.updateReaction(now);

    for (const t of this.targets) {
      if (!t.mesh.visible) continue;
      const age = now - t.bornAt;
      if (age < 0) {
        t.mesh.scale.setScalar(0.001);
        continue;
      }
      const p = Math.min(1, age / SPAWN_MS);
      t.mesh.scale.setScalar(0.6 + 0.4 * (1 - Math.pow(1 - p, 3)));
      if (now >= t.popAt) this.pop(t);
    }
  }

  /* Gridshot: four up at once, one cleared roughly every 0.6s and replaced elsewhere */
  updateGridshot(now) {
    if (now < this.nextEvent) return;
    this.nextEvent = now + 520 + Math.random() * 220;
    const live = this.targets.filter((t) => t.mesh.visible && t.popAt === Infinity && now - t.bornAt > SPAWN_MS);
    const victim = live[Math.floor(Math.random() * live.length)];
    if (!victim) return;
    this.pop(victim);
    this.spawn(victim, 90, now);
  }

  /* Flick: one short-lived target, hit just before it would vanish */
  updateFlick(now) {
    const t = this.targets[0];
    if (now < this.nextEvent) return;
    this.spawn(t, 0, now);
    t.popAt = now + 520;
    this.nextEvent = now + 760;
  }

  /* Tracking: one target gliding on a smooth figure-eight */
  updateTracking(now) {
    const t = this.targets[0];
    if (!t.mesh.visible) {
      this.spawn(t, 0, now);
      t.popAt = Infinity;
    }
    const s = now / 1000;
    t.mesh.position.set(Math.sin(s * 0.9) * 3.4, 2.6 + Math.sin(s * 1.8) * 1.0, 11);
  }

  /* Reaction: unknown wait, then a target that is hit almost immediately */
  updateReaction(now) {
    const t = this.targets[0];
    if (t.mesh.visible || now < this.nextEvent) return;
    this.spawn(t, 0, now);
    t.popAt = now + 300 + Math.random() * 120;
    this.nextEvent = now + 1100 + Math.random() * 1200;
  }

  spawn(t, delay, now = this.clock) {
    t.mesh.position.set(
      THREE.MathUtils.randFloatSpread(ZONE.x * 2),
      THREE.MathUtils.randFloat(ZONE.yMin, ZONE.yMax),
      THREE.MathUtils.randFloat(ZONE.zMin, ZONE.zMax)
    );
    t.bornAt = now + delay;
    t.popAt = Infinity;
    t.mesh.visible = true;
  }

  pop(t) {
    t.mesh.visible = false;
    t.popAt = Infinity;
    this.shards.burst(tmp.copy(t.mesh.position), 0.3);
  }
}
