import { Storage } from './Storage.js';

const KEY = 'aimlabs.sessions';

export class StatsManager {
  static list() {
    return Storage.get(KEY, []);
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
