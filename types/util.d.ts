type Callback<T> = (err: Error | null, reply: T) => void;

export type PromisifyOne<T extends any[]> = T extends [Callback<infer U>?]
  ? () => Promise<U>
  : T extends [infer T1, Callback<infer P>?]
  ? (arg1: T1) => Promise<P>
  : T extends [infer T1, infer T2, Callback<infer U>?]
  ? (arg1: T1, arg2: T2) => Promise<U>
  : never;

type GetOverloadArgs<T> = T extends {
  (...o: infer U): void;
  (...o: infer U2): void;
  (...o: infer U3): void;
}
  ? U | U2 | U3
  : T extends {
      (...o: infer U): void;
      (...o: infer U2): void;
    }
  ? U | U2
  : T extends {
      (...o: infer U): void;
    }
  ? U
  : never;

type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (k: infer I) => void
  ? I
  : never;

type Promisify<T> = UnionToIntersection<PromisifyOne<GetOverloadArgs<T>>>;

declare module 'util' {
  function promisify<T>(fn: T): Promisify<T>;
}
