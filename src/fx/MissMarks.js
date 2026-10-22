import * as THREE from '../three-shim.js';
import { PALETTE } from '../core/palette.js';

/* Miss feedback in the world: a small ring where a missed shot hit the room,
   held briefly then faded. It tells the player *where* they missed (over, under,
   left, right), which is the information a miss is useful for. Pooled, max 24. */
const MARK_COUNT = 24;
const HOLD = 0.3;
const FADE = 0.6;

export class MissMarks {
  constructor(scene) {
    this.enabled = true;
    const geometry = new THREE.RingGeometry(0.55, 1, 24);
    this.marks = Array.from({ length: MARK_COUNT }, () => {
      const mark = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
        color: PALETTE.marker, transparent: true, opacity: 0, depthWrite: false,
        polygonOffset: true, polygonOffsetFactor: -2
      }));
      mark.visible = false;
      mark.userData.life = 0;
      scene.add(mark);
      return mark;
    });
    this.next = 0;
    this.lookTarget = new THREE.Vector3();
  }

  /* hit: a THREE.Intersection against a room surface */
  place(hit) {
    if (!this.enabled || !hit?.face) return;
    const mark = this.marks[this.next];
    this.next = (this.next + 1) % MARK_COUNT;
    const normal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
    mark.position.copy(hit.point).addScaledVector(normal, 0.01);
    this.lookTarget.copy(mark.position).add(normal);
    mark.lookAt(this.lookTarget);
    /* Constant on-screen size regardless of distance */
    mark.scale.setScalar(Math.max(0.03, hit.distance * 0.006));
    mark.userData.life = HOLD + FADE;
    mark.material.opacity = 0.85;
    mark.visible = true;
  }

  update(dt) {
    for (const mark of this.marks) {
      if (!mark.visible) continue;
      mark.userData.life -= dt;
      if (mark.userData.life <= 0) {
        mark.visible = false;
        continue;
      }
      mark.material.opacity = 0.85 * Math.min(1, mark.userData.life / FADE);
    }
  }

  clear() {
    for (const mark of this.marks) mark.visible = false;
  }
}
