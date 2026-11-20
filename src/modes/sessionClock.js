/* Shared drill timer: counts the session down and flags the mode finished at zero,
   which tells Game.animate() to end the run and open the results screen. */
export function tickSessionClock(mode, deltaMs) {
  if (mode.finished) return true;
  mode.timeLeft = Math.max(0, mode.timeLeft - deltaMs / 1000);
  if (mode.timeLeft === 0) mode.finished = true;
  return mode.finished;
}
