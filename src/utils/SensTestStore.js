import { Storage } from './Storage.js';

/**
 * What: Completed sensitivity tests, kept separate from drill sessions.
 * Why:  The finder's history refines its recommendation, but must never appear in
 *       the drill tabs or the Aim Report. Raw per-frame arrays would also blow up
 *       localStorage, so only aggregates are stored.
 * How:  A small capped array under `aimlabs.sensTests`, with read helpers.
 */

const KEY = 'aimlabs.sensTests';
const LIMIT = 50;

/**
 * What: Strips the heavy raw error arrays from a record before persistence.
 * Why:  A tracking trial alone can hold hundreds of floats.
 * How:  Copies each zone without its `raw` field.
 */
function compact(record) {
  const zones = {};
  for (const [id, zone] of Object.entries(record.zones || {})) {
    const { raw, ...rest } = zone || {};
    zones[id] = rest;
  }
  return { ...record, zones };
}

export class SensTestStore {
  /** What: All saved tests. Why: History and summaries. How: Parsed array, shape-filtered. */
  static list() {
    const value = Storage.get(KEY, []);
    return Array.isArray(value) ? value.filter((item) => item && typeof item === 'object') : [];
  }

  /** What: Saves one completed test. Why: Repeat tests refine the recommendation. How: append + cap. */
  static push(record) {
    const list = SensTestStore.list();
    list.push(compact(record));
    if (list.length > LIMIT) list.splice(0, list.length - LIMIT);
    Storage.set(KEY, list);
  }

  /** What: The newest test for a profile. Why: Comparison and "test again". How: filter + last. */
  static latest(profileId) {
    const list = SensTestStore.list().filter((item) => !profileId || item.profileId === profileId);
    return list.length ? list[list.length - 1] : null;
  }

  /** What: Previous value and median across tests. Why: The report shows a stable trend. How: sorted median. */
  static summary(profileId) {
    const list = SensTestStore.list().filter(
      (item) => (!profileId || item.profileId === profileId) && Number(item.bestCm360) > 0
    );
    if (!list.length) return null;
    const values = list.map((item) => Number(item.bestCm360)).sort((a, b) => a - b);
    const middle = Math.floor(values.length / 2);
    const medianValue = values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
    return {
      count: list.length,
      last: Number(list[list.length - 1].bestCm360),
      previous: list.length > 1 ? Number(list[list.length - 2].bestCm360) : null,
      median: medianValue,
      min: values[0],
      max: values[values.length - 1]
    };
  }
}
