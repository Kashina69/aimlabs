import { Storage } from './Storage.js';

const KEY = 'aimlabs.sessions';

export class StatsManager {
  static list() {
    const value = Storage.get(KEY, []);
    /* localStorage can hold anything (manual edits other tools); never trust shape */
    return Array.isArray(value) ? value.filter(s => s && typeof s === 'object' && !Array.isArray(s)) : [];
  }

  static push(session) {
    const arr = StatsManager.list();
    arr.push(session);
    // keep last 500
    if (arr.length > 500) arr.splice(0, arr.length - 500);
    Storage.set(KEY, arr);
  }

  static clear() {
    Storage.set(KEY, []);
  }
}
