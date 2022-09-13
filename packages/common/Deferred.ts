export default class Deferred<T = void> {
  #promise: Promise<T> | undefined;

  #resolve: undefined | ((result: T) => void);

  #reject: undefined | ((error: Error) => void);

  get promise(): Promise<T> {
    if (!this.#promise) {
      this.#promise = new Promise<T>((resolve, reject) => {
        this.#resolve = resolve;
        this.#reject = reject;
      });
    }
    return this.#promise;
  }

  resolve = (result: T): void => {
    const resolve = this.#resolve;
    this.#resolve = undefined;
    this.#reject = undefined;
    if (resolve) {
      resolve(result);
    } else if (!this.#promise) {
      this.#promise = Promise.resolve(result);
    }
  };

  reject = (err: Error): void => {
    const reject = this.#reject;
    this.#resolve = undefined;
    this.#reject = undefined;
    if (reject) {
      reject(err);
    } else if (!this.#promise) {
      this.#promise = Promise.reject(err);
    }
  };
}
