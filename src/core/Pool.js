export class Pool {
  constructor(createFunc, resetFunc, initialSize = 10) {
    this.objects = [];
    this.createFunc = createFunc;
    this.resetFunc = resetFunc;
    this.active = new Set();

    for (let i = 0; i < initialSize; i++) {
      this.objects.push(this.createFunc());
    }
  }

  acquire(...args) {
    let obj = this.objects.pop();
    if (!obj) obj = this.createFunc();
    obj.active = true;
    if (obj.init) obj.init(...args);
    this.active.add(obj);
    // attach reference to pool for easy release
    obj._pool = this;
    return obj;
  }

  release(obj) {
    if (!obj) return;
    obj.active = false;
    try { this.resetFunc(obj); } catch (e) {}
    this.active.delete(obj);
    this.objects.push(obj);
  }
}