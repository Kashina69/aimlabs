import * as THREE from '../three-shim.js';
import { range } from '../utils/rng.js';

/**
 * What: Angular target zones shared by the Sensitivity Finder and the Cone 45 drill.
 * Why:  Cone 45 is the real-world case (short flicks in front) and the wide zone is
 *       the mouse-control case. Keeping both geometries in one place means the test
 *       and the warm-up drill cannot drift apart, and makes the fairness rule visible.
 * How:  Zones describe an angular window around the range anchor (world +Z at eye
 *       height). Spawn points are built from yaw/pitch offsets, clamped into the room,
 *       and scored in units of the target's angular radius so the zones stay comparable.
 *
 * The camera clamp is deliberately WIDER than the spawn window so a miss that
 * overshoots past the outermost target is still measurable, while the player can
 * never wander out of the tested zone.
 */

export const ANCHOR = new THREE.Vector3(0, 1.6, 0);

const ROOM = { minX: -10.5, maxX: 10.5, minY: 0.5, maxY: 6, minZ: 2, maxZ: 14 };
const MICRO_MAX_YAW = 8;
const MICRO_MIN_YAW = 3;
const MICRO_PITCH = 4;
const TRACK_SAMPLES = 181;

export const ZONES = {
  cone: {
    id: 'cone',
    label: '45°',
    title: 'Cone 45 — short, real-world flicks',
    minYaw: 1.2,
    maxYaw: 22.5,
    /* Torso/head height, not the floor: real-world flicks happen near eye level */
    minPitch: -5,
    maxPitch: 7,
    minDistance: 9,
    maxDistance: 12,
    targetSize: 0.2,
    lifeMs: 2000,
    clamp: { yaw: 30, pitch: 18 },
    track: { baseYaw: 0, ampYaw: 11, ampPitch: 5, distance: 10, cycles: 1.5 }
  },
  wide: {
    id: 'wide',
    label: 'Wide',
    title: 'Wide — full turns and mouse control',
    minYaw: 22,
    /* 48° keeps the target just inside the 103° horizontal FOV (±51.5°) so the
       test measures a full turn, never a blind search for an off-screen dot */
    maxYaw: 48,
    minPitch: -7,
    maxPitch: 10,
    minDistance: 6,
    maxDistance: 12,
    targetSize: 0.32,
    lifeMs: 2000,
    clamp: { yaw: 75, pitch: 25 },
    track: { baseYaw: 0, ampYaw: 30, ampPitch: 12, distance: 9, cycles: 1.2 }
  }
};

/**
 * What: Converts a zone's clamp in degrees into the camera's radians.
 * Why:  The mode must save/restore these exact limits around every run.
 * How:  Simple degree-to-radian conversion of `zone.clamp`.
 */
export function zoneCameraLimits(zone) {
  return {
    yaw: THREE.MathUtils.degToRad(zone.clamp.yaw),
    pitch: THREE.MathUtils.degToRad(zone.clamp.pitch)
  };
}

/**
 * What: A unit direction for a yaw/pitch offset from the anchor.
 * Why:  Spawn geometry is easier to reason about in angles than in world space.
 * How:  Standard spherical-to-Cartesian conversion with +Z as forward.
 */
export function directionFor(yawDeg, pitchDeg) {
  const yaw = THREE.MathUtils.degToRad(yawDeg);
  const pitch = THREE.MathUtils.degToRad(pitchDeg);
  return new THREE.Vector3(
    Math.sin(yaw) * Math.cos(pitch),
    Math.sin(pitch),
    Math.cos(yaw) * Math.cos(pitch)
  );
}

/**
 * What: World position for one angular spawn spec, clamped into the range room.
 * Why:  Keeps targets reachable and visible; the measurement always re-derives the
 *       real direction from the spawned position, so a clamp cannot corrupt it.
 * How:  Builds the direction, scales it by the spec distance, and clamps x/y/z.
 */
export function positionFor(zone, spec) {
  const distance = spec.distance ?? (zone.minDistance + zone.maxDistance) / 2;
  const direction = directionFor(spec.yawDeg, spec.pitchDeg);
  const position = ANCHOR.clone().addScaledVector(direction, distance);
  position.x = Math.max(ROOM.minX, Math.min(ROOM.maxX, position.x));
  position.y = Math.max(ROOM.minY, Math.min(ROOM.maxY, position.y));
  position.z = Math.max(ROOM.minZ, Math.min(ROOM.maxZ, position.z));
  return position;
}

/**
 * What: One spawn specification inside a zone (or inside the micro-adjust window).
 * Why:  Sequences must be generated once and replayed identically by every candidate.
 * How:  Picks a side, a yaw magnitude inside the zone (or a tighter micro band),
 *       a pitch, and a distance.
 */
export function randomSpawnSpec(zone, rand, { micro = false, side = null } = {}) {
  const sign = side === 1 || side === -1 ? side : rand() < 0.5 ? -1 : 1;
  const maxYaw = micro ? Math.min(MICRO_MAX_YAW, zone.maxYaw) : zone.maxYaw;
  const minYaw = micro ? Math.min(MICRO_MIN_YAW, maxYaw) : zone.minYaw;
  const pitchMax = micro ? MICRO_PITCH : zone.maxPitch;
  const pitchMin = micro ? -MICRO_PITCH : zone.minPitch;
  return {
    kind: 'flick',
    micro,
    side: sign,
    yawDeg: sign * range(rand, minYaw, maxYaw),
    pitchDeg: range(rand, pitchMin, pitchMax),
    distance: range(rand, zone.minDistance, zone.maxDistance)
  };
}

/**
 * What: A re-playable flick sequence for one zone.
 * Why:  Paired comparisons cancel target-to-target difficulty only if every
 *       candidate sees exactly the same targets in the same order.
 * How:  Alternates sides and schedules micro shots on a fixed 40% pattern.
 */
export function makeFlickSequence(zone, count, rand) {
  const sequence = [];
  let side = null;
  for (let i = 0; i < count; i += 1) {
    const micro = i % 5 === 2 || i % 5 === 4;
    const spec = randomSpawnSpec(zone, rand, { micro, side });
    side = -spec.side;
    sequence.push(spec);
  }
  return sequence;
}

/**
 * What: The zone's smooth tracking arc, sampled by progress (0..1) into `out`.
 * Why:  Tracking is measured every frame, so it must not allocate a Vector3 per
 *       frame, and every candidate must follow the identical path.
 * How:  Lazily precomputes a small lookup table of positions once per zone, then
 *       linearly interpolates between the two nearest samples.
 */
export function trackingPositionAt(zone, progress, out) {
  let path = trackPaths.get(zone.id);
  if (!path) {
    path = buildTrackPath(zone);
    trackPaths.set(zone.id, path);
  }
  const t = Math.max(0, Math.min(1, progress)) * (TRACK_SAMPLES - 1);
  const index = Math.floor(t);
  const next = Math.min(index + 1, TRACK_SAMPLES - 1);
  out.copy(path[index]).lerp(path[next], t - index);
  return out;
}

const trackPaths = new Map();

/**
 * What: Builds the fixed sinusoidal tracking path for a zone.
 * Why:  The path eases through every direction change (no snaps) and is shared by
 *       all candidates, so tracking differences are the player's aim, not the path.
 * How:  Samples the sinusoid at a fixed resolution and stores the positions.
 */
function buildTrackPath(zone) {
  const track = zone.track;
  const path = [];
  for (let i = 0; i < TRACK_SAMPLES; i += 1) {
    const phase = i / (TRACK_SAMPLES - 1);
    const yawDeg = track.baseYaw + track.ampYaw * Math.sin(phase * Math.PI * 2 * track.cycles);
    const pitchDeg = track.ampPitch * Math.sin(phase * Math.PI * 2 * track.cycles * 0.6 + 0.8);
    path.push(positionFor(zone, { yawDeg, pitchDeg, distance: track.distance }));
  }
  return path;
}
