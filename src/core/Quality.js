/* Graphics presets. Medium is the default and is tuned for 60-144 FPS on mid-range
   PCs; Low drops everything optional; High adds soft shadows and a light bloom. */
export const QUALITY_PRESETS = {
  low: { label: 'Low', pixelRatio: 1, shadows: false, bloom: false, effects: false },
  medium: { label: 'Medium', pixelRatio: 1.5, shadows: false, bloom: false, effects: true },
  high: { label: 'High', pixelRatio: 2, shadows: true, bloom: true, effects: true }
};

export function getQuality(name) {
  return QUALITY_PRESETS[name] || QUALITY_PRESETS.medium;
}
