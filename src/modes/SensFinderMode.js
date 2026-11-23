import { getProfileOrDefault } from '../ui/GameProfiles.js';
import { cmPer360, effectiveCpiFromDistance } from '../utils/sensitivity.js';
import { mulberry32, range } from '../utils/rng.js';
import {
  DEFAULT_STEP,
  clampCm,
  cmBounds,
  nextStep,
  resolveOptimum,
  scoreCandidates
} from '../sensfinder/Bracket.js';
import { buildSensResult } from '../sensfinder/BuildResult.js';
import { CalibrationProbe } from '../sensfinder/CalibrationProbe.js';
import { buildRound, emptyZoneData, ZONE_ORDER } from '../sensfinder/RoundPlan.js';
import { TrialRunner } from '../sensfinder/TrialRunner.js';
import { ZONES, makeFlickSequence, zoneCameraLimits } from './spawnZones.js';
import { SensProgress } from '../ui/SensProgress.js';

/**
 * What: The Sensitivity Finder session: warm-up, bracket rounds, result.
 * Why:  Finds the sensitivity the player actually aims best at by measurement, not
 *       by asking. Candidates stay blind and every candidate replays the same targets.
 * How:  A clock-driven state machine. Two zones (45° cone, wide) are each tested with
 *       flicks, micro-adjustments and tracking; a parabola through three candidates
 *       moves the bracket; the last round doubles as the final A/B. Planning lives in
 *       RoundPlan, scoring in Bracket/Aggregate, the record in BuildResult and the
 *       in-session DOM in SensProgress.
 *
 * Timing uses `this.clock`, advanced only inside update(). update() does not run while
 * paused or unlocked, so pausing freezes the test instead of manufacturing timeouts.
 */

const LENGTHS = {
  quick: { shots: 8, trackTrials: 1, trackMs: 4000, rounds: 2 },
  thorough: { shots: 14, trackTrials: 2, trackMs: 5000, rounds: 4 }
};

const WARMUP_SHOTS = 4;
const READY_MIN_MS = 220;
const READY_MAX_MS = 450;
const RESOLVE_MS = 240;
const BANNER_MS = 1200;

export class SensFinderMode {
  constructor(game) {
    this.game = game;
    this.resultKind = 'sens-finder';
    this.flushInputBeforeShot = true;
    this.hideWeapon = true;

    const cfg = game.sensFinderConfig || {};
    this.cfg = {
      length: cfg.length === 'thorough' ? 'thorough' : 'quick',
      game: cfg.game || game.settings.game,
      dpi: cfg.dpi || game.settings.dpi,
      measuredCm360: Number(cfg.measuredCm360) > 0 ? Number(cfg.measuredCm360) : null,
      probe: cfg.probe !== false
    };
    this.length = LENGTHS[this.cfg.length];

    this.profile = getProfileOrDefault(this.cfg.game);
    const measured = this.cfg.measuredCm360
      ? effectiveCpiFromDistance(this.cfg.measuredCm360, game.settings.sensitivity, this.profile.yaw)
      : null;
    this.calibrated = !!(measured && Number.isFinite(measured));
    this.cpi = this.calibrated ? measured : this.cfg.dpi || 800;
    this.bounds = cmBounds(this.profile, this.cpi);

    const currentCm = cmPer360(game.settings.sensitivity, this.cpi, this.profile.yaw);
    this.centerCm = clampCm(currentCm > 0 ? currentCm : 30, this.bounds);
    this.step = DEFAULT_STEP;

    this.saved = {
      sensitivity: game.settings.sensitivity,
      game: game.settings.game,
      maxYawOffset: game.camera.maxYawOffset,
      maxPitch: game.camera.maxPitch,
      meta: game.settings.showMeta
    };

    this.clock = 0;
    this.timeLeft = null;
    this.score = 0;
    this.hits = 0;
    this.shots = 0;
    this.combo = 0;

    this.mode = 'idle';
    this.flow = 'warmup';
    this.roundIndex = 0;
    this.queue = [];
    this.block = null;
    this.lastZoneId = null;
    this.pendingBlock = null;
    this.until = 0;
    this.trialKind = null;
    this.doneTrials = 0;
    this.totalTrials = 0;
    this.rounds = [];
    this.result = null;
    this.finished = false;

    this.checks = {
      dpr: window.devicePixelRatio || 1,
      acceleration: 'unchecked'
    };
    this.probe = new CalibrationProbe(game.input);
    this.progress = null;

    this.rand = mulberry32((Date.now() ^ 0x51ed270b) >>> 0);
    this.runner = new TrialRunner(game);
  }

  /* ---------------- lifecycle ---------------- */

  /**
   * What: Begins the session: hides the blind-sensitive UI and starts the probe/warm-up.
   * Why:  Candidates must stay blind and the warm-up must establish a flick origin.
   * How:  Hides HUD meta and the weapon, resets the camera, creates the progress UI.
   */
  start() {
    this.game.hud?.setMetaVisible(false);
    this.game.weapon.setVisible(false);
    this.game.camera.reset();
    this.progress = new SensProgress(this.game.promptLayer);
    this.totalTrials = this.estimateTrials();
    this.updateProgress();

    if (this.cfg.probe) this.beginProbe();
    else this.beginWarmup();
  }

  estimateTrials() {
    const perBlock = this.length.shots + this.length.trackTrials;
    return WARMUP_SHOTS * 2 + this.length.rounds * 3 * 2 * perBlock;
  }

  /**
   * What: Runs the pointer-acceleration check before any data is collected.
   * Why:  Absolute cm/360 is meaningless if counts do not scale with distance.
   * How:  Freezes look, counts travel for two clicks, then hands back to the warm-up.
   */
  beginProbe() {
    this.mode = 'probe';
    this.probe.begin();
    this.progress.showBanner('Input check — slowly move the mouse across your whole pad, then click.', true);
  }

  /**
   * What: Handles a click during the input probe.
   * Why:  The player marks each sweep; no timers or extra keys are involved.
   * How:  Advances slow → fast → done, then starts the warm-up.
   */
  onProbeClick() {
    const outcome = this.probe.click();
    if (outcome === 'retry') {
      this.progress.showBanner('Move the mouse across the pad first, then click.', true);
      return;
    }
    if (outcome === 'fast') {
      this.progress.showBanner('Now the same distance, fast. Click when you stop.', true);
      return;
    }
    this.checks = this.probe.result;
    this.progress.hideBanner();
    this.beginWarmup();
  }

  /**
   * What: Plays a short unscored pass through both zones.
   * Why:  Discards first-flick noise and teaches the two zone widths before scoring.
   * How:  Queues one four-shot block per zone.
   */
  beginWarmup() {
    this.flow = 'warmup';
    this.roundIndex = 0;
    const rand = mulberry32(0x0ac0ffee);
    this.queue = ZONE_ORDER.map((zoneId) => ({
      zoneId,
      zone: ZONES[zoneId],
      sens: this.game.settings.sensitivity,
      data: emptyZoneData(),
      sequence: makeFlickSequence(ZONES[zoneId], WARMUP_SHOTS, rand),
      trackTrials: 0,
      scoring: false,
      candidate: null
    }));
    this.startNextBlock();
  }

  /**
   * What: Starts the next block, inserting a zone-change banner and recenter when needed.
   * Why:  Changing the camera clamp mid-turn would snap the view and pollute the first shot.
   * How:  Applies the zone clamp, resets the camera, waits one banner, then enters the block.
   */
  startNextBlock() {
    if (!this.queue.length) return this.finishRound();
    const desc = this.queue[0];

    if (desc.zoneId !== this.lastZoneId) {
      const limits = zoneCameraLimits(desc.zone);
      this.game.camera.maxYawOffset = limits.yaw;
      this.game.camera.maxPitch = limits.pitch;
      this.game.camera.reset();
      this.lastZoneId = desc.zoneId;
      this.mode = 'banner';
      this.until = this.clock + BANNER_MS;
      this.pendingBlock = desc;
      this.progress.showBanner(desc.zone.title);
      this.updateProgress();
      return;
    }
    this.enterBlock(desc);
  }

  /**
   * What: Applies a candidate's sensitivity and begins its trial sequence.
   * Why:  Every block runs at exactly one candidate sensitivity.
   * How:  Writes the in-memory setting (persisted only via Apply), then waits one gap.
   */
  enterBlock(desc) {
    this.block = desc;
    this.game.settings.sensitivity = desc.sens;
    desc.trialIndex = 0;
    this.trialKind = 'flick';
    this.mode = 'gap';
    this.until = this.clock + 380;
    this.updateProgress();
  }

  /**
   * What: Advances to the next flick or tracking trial, or ends the block.
   * Why:  The block length is fixed per length mode, so scoring stays comparable.
   * How:  Resets the ready gap; tracking trials run after all flick shots.
   */
  nextTrial() {
    const block = this.block;
    if (!block) return;
    const flickCount = block.sequence.length;
    const total = flickCount + block.trackTrials;
    if (block.trialIndex >= total) return this.finishBlock();
    this.trialKind = block.trialIndex < flickCount ? 'flick' : 'track';
    this.mode = 'gap';
    this.until = this.clock + range(this.rand, READY_MIN_MS, READY_MAX_MS);
    this.updateProgress();
  }

  finishBlock() {
    this.runner.release();
    this.block = null;
    this.queue.shift();
    this.startNextBlock();
  }

  /**
   * What: Closes a round, scores it, and decides where the bracket goes next.
   * Why:  The bracket only uses values measured on one normalised scale (one round).
   * How:  Scores the three candidates, stores the round, then either finishes or
   *       recentres on the fitted optimum with a smaller step.
   */
  finishRound() {
    if (this.flow === 'warmup') {
      this.roundIndex = 0;
      this.beginRound();
      return;
    }

    const round = this.currentRound;
    const { zoneMeans } = scoreCandidates(round.candidates);
    round.zoneMeans = zoneMeans;
    this.rounds.push(round);

    if (this.roundIndex + 1 >= this.length.rounds) {
      this.finishTest();
      return;
    }

    const optimum = resolveOptimum(round.candidates, this.bounds);
    this.centerCm = optimum.cm360;
    this.step = nextStep(this.step);
    this.roundIndex += 1;
    this.beginRound();
  }

  /**
   * What: Builds and queues the next three-candidate round.
   * Why:  The round planner owns the fairness rule (shared sequences, rotated order).
   * How:  Delegates to buildRound, then starts the first block.
   */
  beginRound() {
    const { round, queue } = buildRound({
      index: this.roundIndex,
      centerCm: this.centerCm,
      step: this.step,
      bounds: this.bounds,
      cpi: this.cpi,
      profile: this.profile,
      shots: this.length.shots,
      trackTrials: this.length.trackTrials
    });
    this.currentRound = round;
    this.queue = queue;
    this.flow = 'round';
    this.startNextBlock();
  }

  /**
   * What: Closes the session with the report record.
   * Why:  `Game.animate` ends the session when `finished` flips, then restores state.
   * How:  Delegates record assembly to buildSensResult and marks the mode finished.
   */
  finishTest() {
    this.result = buildSensResult({
      rounds: this.rounds,
      bounds: this.bounds,
      cpi: this.cpi,
      profile: this.profile,
      cfg: this.cfg,
      checks: this.checks,
      saved: this.saved,
      calibrated: this.calibrated,
      attemptCap: this.currentRound.candidates.length * ZONE_ORDER.length * this.length.shots,
      attemptTotal: this.countAttemptedShots()
    });

    this.finished = true;
    this.mode = 'done';
    this.doneTrials = this.totalTrials;
    this.updateProgress();
  }

  countAttemptedShots() {
    return this.currentRound.candidates.reduce(
      (sum, candidate) => sum + ZONE_ORDER.reduce((n, id) => n + candidate.zones[id].shots.length, 0),
      0
    );
  }

  /* ---------------- frame loop ---------------- */

  update(deltaMs = 16) {
    if (this.finished) return;
    this.clock += deltaMs;
    const now = this.clock;

    if (this.mode === 'banner') {
      if (now < this.until) return;
      this.progress.hideBanner();
      const desc = this.pendingBlock;
      this.pendingBlock = null;
      if (desc) this.enterBlock(desc);
      return;
    }

    if (this.mode === 'probe') return;

    if (this.mode === 'gap') {
      if (now < this.until) return;
      this.spawnTrial();
      return;
    }

    if (this.mode === 'resolve') {
      if (now < this.until) return;
      this.nextTrial();
      return;
    }

    if (this.mode === 'live') this.updateLive(now);
  }

  /**
   * What: Advances the current live trial and folds a resolution into the block.
   * Why:  Trial lifetimes and tracking sampling belong to the TrialRunner.
   * How:  Delegates to runner.update; a non-null summary means the trial ended.
   */
  updateLive(now) {
    const resolution = this.runner.update(now);
    if (resolution) this.applyResolution(resolution);
  }

  /**
   * What: Spawns the next flick target or the tracking target.
   * Why:  Flick origin and tracking start must be recorded at spawn time.
   * How:  Delegates acquisition and trial setup to the TrialRunner.
   */
  spawnTrial() {
    const block = this.block;
    if (!block) return;
    const spec = block.sequence[block.trialIndex];
    if (this.trialKind === 'flick' && spec) {
      this.runner.beginFlick(block.zone, spec, this.clock);
    } else {
      this.runner.beginTracking(block.zone, this.length.trackMs, this.clock);
    }
    this.mode = 'live';
  }

  /* ---------------- clicks ---------------- */

  /**
   * What: Routes a click to the probe or measures it against the live flick target.
   * Why:  A hit ends the trial instantly; a miss opens a bounded correction window.
   * How:  The runner records the shot; the mode owns scoring and feedback.
   */
  onClick() {
    if (this.mode === 'probe') {
      this.onProbeClick();
      return;
    }
    if (this.mode !== 'live' || this.runner.kind !== 'flick') return;

    const shot = this.runner.click(this.clock);
    if (!shot) return;

    this.shots += 1;
    if (shot.hit) {
      this.hits += 1;
      this.combo += 1;
      this.score += 100 * this.combo;
      this.game.audio.play('hit');
      this.applyResolution(this.runner.resolve());
      return;
    }

    this.combo = 0;
    this.game.audio.play('miss');
    if (shot.forceResolve) this.applyResolution(this.runner.resolve());
  }

  /**
   * What: Folds one finished trial into the current block's candidate data.
   * Why:  Shot data, correction time and tracking means must land exactly once.
   * How:  Pushes the summary, advances the trial index, then waits a resolve beat.
   */
  applyResolution(resolution) {
    if (resolution.kind === 'flick') {
      if (resolution.correction != null) this.block.data.corrections.push(resolution.correction);
      for (const shot of resolution.shots) this.block.data.shots.push(shot);
    } else if (resolution.mean != null) {
      this.block.data.track.push(resolution.mean);
    }

    if (this.block) this.block.trialIndex += 1;
    this.doneTrials += 1;
    this.mode = 'resolve';
    this.until = this.clock + RESOLVE_MS;
    this.updateProgress();
  }

  updateProgress() {
    this.progress?.update({
      finished: this.finished,
      flow: this.flow,
      roundIndex: this.roundIndex,
      rounds: this.length.rounds,
      block: this.block,
      done: this.doneTrials,
      total: this.totalTrials
    });
  }

  /* Pause sheet sits in the overlay layer, below the prompt layer. */
  onPause() {
    this.progress?.setHidden(true);
  }

  onResume() {
    this.progress?.setHidden(false);
  }

  /* ---------------- teardown ---------------- */

  /**
   * What: Restores every value the session changed and removes its UI.
   * Why:  Must hold on normal finish, Esc→quit, restart and quit during arming.
   * How:  Restores sensitivity, camera clamps, HUD meta, freeze/travel, weapon and
   *       cursor state; releases targets and destroys the progress UI.
   */
  end() {
    this.runner.release();
    this.probe.finish();
    this.game.settings.sensitivity = this.saved.sensitivity;
    this.game.camera.maxYawOffset = this.saved.maxYawOffset;
    this.game.camera.maxPitch = this.saved.maxPitch;
    this.game.input.freezeLook = false;
    this.game.input.resetTravel();
    this.game.hud?.setMetaVisible(this.saved.meta);
    this.game.weapon.setVisible(this.game.settings.showWeapon && this.game.phase === 'live');
    this.game.clearFreeCursor();
    this.progress?.destroy();
    this.progress = null;

    return this.result || {
      kind: 'sens-finder',
      aborted: true,
      profileId: this.profile.id,
      originalSensitivity: this.saved.sensitivity,
      originalGame: this.saved.game
    };
  }
}
