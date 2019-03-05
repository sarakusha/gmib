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
declare type Omit<T, K> = {
    [key in Exclude<keyof T, K>]: T[key];
};
export declare type MakeRequired<T, K extends keyof T> = Omit<T, K> & {
    [P in K]-?: Exclude<T[P], undefined>;
};
export {};
//# sourceMappingURL=options.d.ts.map