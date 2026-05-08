export class Storage {
  static set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  static get(key, fallback = null) {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  }
}