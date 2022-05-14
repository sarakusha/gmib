// http://blog.mackerron.com/2011/01/01/javascript-cubic-splines/

export type Point = [x: number, y: number];

export default class MonotonicCubicSpline {
  private readonly x: ReadonlyArray<number>;

  private readonly y: ReadonlyArray<number>;

  private readonly m: ReadonlyArray<number>;

  constructor(points: Point[]) {
    const n = points.length;
    const x = points.map(([a]) => a);
    const y = points.map(([, b]) => b);
    const delta: number[] = [];
    const m: number[] = [];
    const alpha: number[] = [];
    const beta: number[] = [];
    const dist: number[] = [];
    const tau: number[] = [];
    // for (let i = 0, j = 0, ref = n - 1; ref >= 0 ? j < ref : j > ref; i = ref >= 0 ? ++j : --j) {
    for (let i = 0; i < n - 1; i += 1) {
      delta[i] = (y[i + 1] - y[i]) / (x[i + 1] - x[i]);
      if (i > 0) {
        m[i] = (delta[i - 1] + delta[i]) / 2;
      }
    }
    [m[0]] = delta;
    m[n - 1] = delta[n - 2];
    let toFix: number[] = [];
    // for (
    //   let i = 0, k = 0, ref1 = n - 1;
    //   ref1 >= 0 ? k < ref1 : k > ref1;
    //   i = ref1 >= 0 ? ++k : --k
    // ) {
    for (let i = 0; i < n - 1; i += 1) {
      if (delta[i] === 0) {
        toFix.push(i);
      }
    }
    for (let l = 0, len = toFix.length; l < len; l += 1) {
      const i = toFix[l];
      m[i] = 0;
      m[i + 1] = 0;
    }
    // for (
    //   let i = 0, o = 0, ref2 = n - 1;
    //   ref2 >= 0 ? o < ref2 : o > ref2;
    //   i = ref2 >= 0 ? ++o : --o
    // ) {
    for (let i = 0; i < n - 1; i += 1) {
      alpha[i] = m[i] / delta[i];
      beta[i] = m[i + 1] / delta[i];
      dist[i] = alpha[i] ** 2 + beta[i] ** 2;
      tau[i] = 3 / Math.sqrt(dist[i]);
    }
    toFix = [];
    for (let i = 0; i < n - 1; i += 1) {
      if (dist[i] > 9) {
        toFix.push(i);
      }
    }
    for (let q = 0, len1 = toFix.length; q < len1; q += 1) {
      const i = toFix[q];
      m[i] = tau[i] * alpha[i] * delta[i];
      m[i + 1] = tau[i] * beta[i] * delta[i];
    }
    this.x = x.slice(0, n);
    this.y = y.slice(0, n);
    this.m = m;
  }

  interpolate(x: number): number {
    let i;
    // for (i = j = ref = this.x.length - 2; ref <= 0 ? j <= 0 : j >= 0; i = ref <= 0 ? ++j : --j) {
    for (i = this.x.length - 2; i >= 0; i = -1) {
      if (this.x[i] <= x) {
        break;
      }
    }
    const h = this.x[i + 1] - this.x[i];
    const t = (x - this.x[i]) / h;
    const t2 = t ** 2;
    const t3 = t ** 3;
    const h00 = 2 * t3 - 3 * t2 + 1;
    const h10 = t3 - 2 * t2 + t;
    const h01 = -2 * t3 + 3 * t2;
    const h11 = t3 - t2;
    return h00 * this.y[i] + h10 * h * this.m[i] + h01 * this.y[i + 1] + h11 * h * this.m[i + 1];
  }
}
