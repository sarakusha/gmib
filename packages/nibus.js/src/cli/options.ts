export interface CommonOpts {
  m: string | undefined;
  mac: string | undefined;
  raw: boolean;
  id: ReadonlyArray<string> | undefined;
  name: ReadonlyArray<string> | undefined;
  mib: string | undefined;
  compact: boolean;
  quiet: boolean;
  q: boolean;
  fw: boolean;
}

type Omit<T, K> = { [key in Exclude<keyof T, K>]: T[key] };

export type MakeRequired<T, K extends keyof T> = Omit<T, K> & {
  [P in K]-?: Exclude<T[P], undefined>
};
