export class Fault extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}
