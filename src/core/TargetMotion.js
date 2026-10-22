/* Smooth strafing motion for tracking targets. Speed and heading both ease
   toward slowly re-rolled targets (no instant stops, no hard wall flips), and
   soft margins steer the target back inside the room smoothly. */
const BOUNDS = { minX: -4.6, maxX: 4.6, minY: 0.9, maxY: 4.2 };
const STEER_MARGIN = 0.9;
const ANGLE_EASE = 2.2;   // rad/s toward desired heading
const SPEED_EASE = 0.8;   // 1/s toward target speed

export class TargetMotion {
  constructor(baseSpeed = 1.4) {
    this.base = baseSpeed;
    this.speed = baseSpeed * 0.6;
    this.speedTarget = this.speed;
    this.speedTimer = 0;
    this.nextSpeedIn = 2 + Math.random() * 2;
    /* Mostly horizontal sweep, slight vertical component */
    this.heading = Math.random() < 0.5 ? 0 : Math.PI;
    this.headingTarget = this.heading;
    this.turnTimer = 1.5 + Math.random() * 2;
  }

  update(position, dtSeconds, difficulty = 1) {
    if (dtSeconds <= 0) return;

    /* Re-roll a target speed every few seconds; the change itself applies
       gradually through the easing below */
    this.speedTimer += dtSeconds;
    if (this.speedTimer >= this.nextSpeedIn) {
      this.speedTimer = 0;
      this.nextSpeedIn = 2 + Math.random() * 2.5;
      this.speedTarget = this.base * (0.55 + Math.random() * 0.75);
    }
    this.speed += (this.speedTarget - this.speed) * Math.min(1, dtSeconds * SPEED_EASE);

    /* Slow wander: nudge the desired heading a little at intervals */
    this.turnTimer -= dtSeconds;
    if (this.turnTimer <= 0) {
      this.turnTimer = 1.5 + Math.random() * 2;
      const wander = (Math.random() - 0.5) * 1.4;
      /* Bias re-rolls toward horizontal (angle near 0 or PI) */
      const horizontal = Math.random() < 0.8;
      const base = Math.abs(Math.cos(this.heading)) > 0.5 ? this.heading : (this.heading < Math.PI ? 0 : Math.PI);
      this.headingTarget = horizontal
        ? base + wander * 0.5
        : this.heading + wander;
      this.headingTarget = Math.max(-1.1, Math.min(1.1, this.headingTarget));
      if (base === Math.PI && this.headingTarget < -0.3) {
        /* keep pointing left-ish: map to PI-side mirror */
        this.headingTarget = Math.PI - Math.min(1.1, Math.abs(this.headingTarget) + 0.4);
      }
    }

    /* Boundary steering: build a desired direction vector that blends the
       current heading with inward bias near the room margins */
    let dirX = Math.cos(this.heading);
    let dirY = Math.sin(this.heading);
    let steerX = 0;
    let steerY = 0;
    if (position.x > BOUNDS.maxX - STEER_MARGIN) steerX -= (position.x - (BOUNDS.maxX - STEER_MARGIN)) / STEER_MARGIN;
    if (position.x < BOUNDS.minX + STEER_MARGIN) steerX += (BOUNDS.minX + STEER_MARGIN - position.x) / STEER_MARGIN;
    if (position.y > BOUNDS.maxY - STEER_MARGIN) steerY -= (position.y - (BOUNDS.maxY - STEER_MARGIN)) / STEER_MARGIN;
    if (position.y < BOUNDS.minY + STEER_MARGIN) steerY += (BOUNDS.minY + STEER_MARGIN - position.y) / STEER_MARGIN;

    const steerMag = Math.hypot(steerX, steerY);
    if (steerMag > 0.02) {
      const len = Math.max(0.001, Math.hypot(dirX, dirY));
      const desiredAngle = Math.atan2(dirY / len + steerY * 1.5, dirX / len + steerX * 1.5);
      this.heading = approachAngle(this.heading, desiredAngle, Math.min(1, dtSeconds * ANGLE_EASE));
    } else {
      this.heading = approachAngle(this.heading, this.headingTarget, Math.min(1, dtSeconds * ANGLE_EASE * 0.4));
    }

    const finalSpeed = this.speed * (difficulty || 1);
    position.x += Math.cos(this.heading) * finalSpeed * dtSeconds;
    position.y += Math.sin(this.heading) * finalSpeed * dtSeconds;
    position.x = Math.max(BOUNDS.minX, Math.min(BOUNDS.maxX, position.x));
    position.y = Math.max(BOUNDS.minY, Math.min(BOUNDS.maxY, position.y));
  }
}

/* Rotate `from` toward `to` by at most `t` of the angular difference */
function approachAngle(from, to, t) {
  let diff = to - from;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return from + diff * t;
}
