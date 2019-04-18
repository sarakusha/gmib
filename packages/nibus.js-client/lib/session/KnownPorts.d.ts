import * as t from 'io-ts';
export declare type HexOrNumber = string | number;
export declare const CategoryV: t.UnionC<[t.KeyofC<{
    siolynx: null;
    minihost: null;
    fancontrol: null;
    c22: null;
    relay: null;
    ftdi: null;
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
        ftdi: null;
        undefined: null;
    }>, t.UndefinedC]>;
}>]>;
export interface IKnownPort extends t.TypeOf<typeof KnownPortV> {
}
//# sourceMappingURL=KnownPorts.d.ts.map