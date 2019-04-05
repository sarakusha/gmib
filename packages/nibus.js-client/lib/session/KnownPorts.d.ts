import * as t from 'io-ts';
export declare type HexOrNumber = string | number;
export declare const CategoryV: t.UnionC<[t.KeyofC<{
    siolynx: null;
    minihost: null;
    fancontrol: null;
    c22: null;
    relay: null;
    undefined: null;
}>, t.UndefinedC]>;
export declare type Category = t.TypeOf<typeof CategoryV>;
export declare const KnownPortV: t.IntersectionC<[t.TypeC<{
    comName: t.StringC;
    productId: t.NumberC;
    vendorId: t.NumberC;
}>, t.PartialC<{
    manufacturer: t.StringC;
    serialNumber: t.StringC;
    pnpId: t.StringC;
    locationId: t.StringC;
    deviceAddress: t.NumberC;
    device: t.StringC;
    category: t.UnionC<[t.KeyofC<{
        siolynx: null;
        minihost: null;
        fancontrol: null;
        c22: null;
        relay: null;
        undefined: null;
    }>, t.UndefinedC]>;
}>]>;
export interface IKnownPort extends t.TypeOf<typeof KnownPortV> {
}
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
//# sourceMappingURL=KnownPorts.d.ts.map