import * as t from 'io-ts';
export declare const PATH = "/tmp/nibus.service.sock";
declare const LogLevelV: t.KeyofC<{
    none: null;
    hex: null;
    nibus: null;
}>;
export declare const ConfigV: t.PartialC<{
    logLevel: t.KeyofC<{
        none: null;
        hex: null;
        nibus: null;
    }>;
    omit: t.UnionC<[t.ArrayC<t.StringC>, t.NullC]>;
    pick: t.UnionC<[t.ArrayC<t.StringC>, t.NullC]>;
    mibs: t.ArrayC<t.StringC>;
    mibTypes: t.RecordC<t.StringC, t.ArrayC<t.IntersectionC<[t.TypeC<{
        mib: t.StringC;
    }>, t.PartialC<{
        minVersion: t.NumberC;
    }>]>>>;
}>;
export declare type Config = t.TypeOf<typeof ConfigV>;
export declare type LogLevel = t.TypeOf<typeof LogLevelV>;
export {};
//# sourceMappingURL=common.d.ts.map