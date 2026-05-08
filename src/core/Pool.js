export class Pool {
  constructor(createFunc, resetFunc, initialSize = 10) {
    this.objects = [];
    this.createFunc = createFunc;
    this.resetFunc = resetFunc;

    for (let i = 0; i < initialSize; i++) {
      this.objects.push(this.createFunc());
    }
  }

  acquire(...args) {
    let obj = this.objects.pop();
    if (!obj) obj = this.createFunc();
    obj.active = true;
    if (obj.init) obj.init(...args);
    return obj;
  }

  release(obj) {
    obj.active = false;
    this.resetFunc(obj);
    this.objects.push(obj);
  }
}