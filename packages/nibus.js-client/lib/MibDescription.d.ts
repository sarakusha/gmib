import * as t from 'io-ts';
export declare const FindKindV: t.KeyofC<{
    sarp: null;
    version: null;
}>;
export declare type FindKind = t.TypeOf<typeof FindKindV>;
export declare const NibusBaudRateV: t.UnionC<[t.LiteralC<115200>, t.LiteralC<57600>, t.LiteralC<28800>]>;
export declare const NibusParityV: t.KeyofC<{
    none: null;
    even: null;
    mark: null;
}>;
export declare type NibusBaudRate = t.TypeOf<typeof NibusBaudRateV>;
export declare type NibusParity = t.TypeOf<typeof NibusParityV>;
export declare const MibDescriptionV: t.PartialC<{
    type: t.NumberC;
    mib: t.StringC;
    link: t.BooleanC;
    baudRate: t.UnionC<[t.LiteralC<115200>, t.LiteralC<57600>, t.LiteralC<28800>]>;
    parity: t.KeyofC<{
        none: null;
        even: null;
        mark: null;
    }>;
    category: t.StringC;
    find: t.KeyofC<{
        sarp: null;
        version: null;
    }>;
    disableBatchReading: t.BooleanC;
}>;
export interface IMibDescription extends t.TypeOf<typeof MibDescriptionV> {
}
//# sourceMappingURL=MibDescription.d.ts.map