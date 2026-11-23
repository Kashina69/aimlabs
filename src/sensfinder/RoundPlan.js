import { ZONES, makeFlickSequence } from '../modes/spawnZones.js';
import { sensitivityForCm360 } from '../utils/sensitivity.js';
import { mulberry32 } from '../utils/rng.js';
import { roundCandidates } from './Bracket.js';

/**
 * What: Builds one bracket round: three candidates, one shared target sequence per
 *       zone, and the ordered list of blocks the session will play.
 * Why:  Separates "what will be tested" from the mode's choreography, and makes the
 *       fairness rule explicit: every candidate replays the identical sequence.
 * How:  Picks the three cm/360 points for the round, converts them to the game's
 *       sensitivity scale, generates both zone sequences from one seeded RNG, then
 *       rotates the candidate order per round to balance practice and fatigue.
 */

export const ZONE_ORDER = ['cone', 'wide'];

/**
 * What: A fresh, empty store for one candidate's performance in one zone.
 * Why:  Shots, tracking samples and correction times are collected independently.
 * How:  Returns new arrays; callers own them for the life of the round.
 */
export function emptyZoneData() {
  return { shots: [], track: [], corrections: [] };
}

function rotate(list, amount) {
  const offset = ((amount % list.length) + list.length) % list.length;
  return list.slice(offset).concat(list.slice(0, offset));
}

/**
 * What: Creates the round object and the block queue that the mode executes.
 * Why:  The queue is the single source of truth for block order, so a pause/restart
 *       cannot desynchronise candidates from their sequences.
 * How:  For each zone, queue one block per candidate in the rotated order.
 */
export function buildRound({ index, centerCm, step, bounds, cpi, profile, shots, trackTrials }) {
  const order = rotate([0, 1, 2], index);
  const cms = roundCandidates(centerCm, step, bounds);

  const candidates = cms.map((cm, candidateIndex) => ({
    cm360: cm,
    sens: sensitivityForCm360(cm, cpi, profile.yaw),
    cpi,
    profileYaw: profile.yaw,
    index: candidateIndex,
    zones: { cone: emptyZoneData(), wide: emptyZoneData() }
  }));

  const rand = mulberry32(0x1a2b3c + index * 7919);
  const sequences = {
    cone: makeFlickSequence(ZONES.cone, shots, rand),
    wide: makeFlickSequence(ZONES.wide, shots, rand)
  };

  const queue = [];
  for (const zoneId of ZONE_ORDER) {
    for (const candidateIndex of order) {
      const candidate = candidates[candidateIndex];
      queue.push({
        zoneId,
        zone: ZONES[zoneId],
        sens: candidate.sens,
        data: candidate.zones[zoneId],
        sequence: sequences[zoneId],
        trackTrials,
        candidate
      });
    }
  }

  return {
    round: { index, centerCm360: centerCm, step, candidates, sequences },
    queue
  };
}
