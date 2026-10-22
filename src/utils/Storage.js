/* localStorage can hold anything: manual edits, corrupt JSON, or tampering.
   Reads never throw and never return objects we did not expect a scalar of. */
export class Storage {
  static set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      /* storage full or blocked: settings simply stop persisting */
    }
  }

  static get(key, fallback = null) {
    try {
      const item = localStorage.getItem(key);
      if (item === null) return fallback;
      return JSON.parse(item);
    } catch (error) {
      // unreadable or corrupt value: drop it and use the fallback
      try { localStorage.removeItem(key); } catch (e) {}
      return fallback;
    }
  }
}
