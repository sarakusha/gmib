import * as t from 'io-ts';
import { IMibDescription } from '../service';
import { Mixed } from 'io-ts/lib';
import { IKnownPort } from '../service/KnownPorts';
export declare const PortArgV: t.TypeC<{
    portInfo: t.IntersectionC<[t.TypeC<{
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
        category: t.UnionC<[t.LiteralC<"siolynx">, t.LiteralC<"minihost">, t.LiteralC<"fancontrol">, t.LiteralC<"c22">, t.LiteralC<"relay">, t.UndefinedC]>;
    }>]>;
    description: t.PartialC<{
        mib: t.StringC;
        link: t.BooleanC;
        baudRate: t.UnionC<[t.LiteralC<115200>, t.LiteralC<57600>, t.LiteralC<28800>]>;
        parity: t.UnionC<[t.LiteralC<"none">, t.LiteralC<"even">, t.LiteralC<"mark">]>;
        category: t.StringC;
        find: t.KeyofC<{
            sarp: null;
            version: null;
        }>;
        disableBatchReading: t.BooleanC;
    }>;
}>;
export interface IPortArg extends t.TypeOf<typeof PortArgV> {
    portInfo: IKnownPort;
    description: IMibDescription;
}
export declare const PortsEventV: t.TypeC<{
    event: t.LiteralC<string>;
    args: t.TupleC<[t.ArrayC<t.TypeC<{
        portInfo: t.IntersectionC<[t.TypeC<{
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
            category: t.UnionC<[t.LiteralC<"siolynx">, t.LiteralC<"minihost">, t.LiteralC<"fancontrol">, t.LiteralC<"c22">, t.LiteralC<"relay">, t.UndefinedC]>;
        }>]>;
        description: t.PartialC<{
            mib: t.StringC;
            link: t.BooleanC;
            baudRate: t.UnionC<[t.LiteralC<115200>, t.LiteralC<57600>, t.LiteralC<28800>]>;
            parity: t.UnionC<[t.LiteralC<"none">, t.LiteralC<"even">, t.LiteralC<"mark">]>;
            category: t.StringC;
            find: t.KeyofC<{
                sarp: null;
                version: null;
            }>;
            disableBatchReading: t.BooleanC;
        }>;
    }>>, t.Mixed]> | t.TupleC<[t.ArrayC<t.TypeC<{
        portInfo: t.IntersectionC<[t.TypeC<{
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
            category: t.UnionC<[t.LiteralC<"siolynx">, t.LiteralC<"minihost">, t.LiteralC<"fancontrol">, t.LiteralC<"c22">, t.LiteralC<"relay">, t.UndefinedC]>;
        }>]>;
        description: t.PartialC<{
            mib: t.StringC;
            link: t.BooleanC;
            baudRate: t.UnionC<[t.LiteralC<115200>, t.LiteralC<57600>, t.LiteralC<28800>]>;
            parity: t.UnionC<[t.LiteralC<"none">, t.LiteralC<"even">, t.LiteralC<"mark">]>;
            category: t.StringC;
            find: t.KeyofC<{
                sarp: null;
                version: null;
            }>;
            disableBatchReading: t.BooleanC;
        }>;
    }>>]>;
}>;
export interface IPortsEvent extends t.TypeOf<typeof PortsEventV> {
}
export declare const PortAddedEventV: t.TypeC<{
    event: t.LiteralC<string>;
    args: t.TupleC<[t.TypeC<{
        portInfo: t.IntersectionC<[t.TypeC<{
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
            category: t.UnionC<[t.LiteralC<"siolynx">, t.LiteralC<"minihost">, t.LiteralC<"fancontrol">, t.LiteralC<"c22">, t.LiteralC<"relay">, t.UndefinedC]>;
        }>]>;
        description: t.PartialC<{
            mib: t.StringC;
            link: t.BooleanC;
            baudRate: t.UnionC<[t.LiteralC<115200>, t.LiteralC<57600>, t.LiteralC<28800>]>;
            parity: t.UnionC<[t.LiteralC<"none">, t.LiteralC<"even">, t.LiteralC<"mark">]>;
            category: t.StringC;
            find: t.KeyofC<{
                sarp: null;
                version: null;
            }>;
            disableBatchReading: t.BooleanC;
        }>;
    }>, t.Mixed]> | t.TupleC<[t.TypeC<{
        portInfo: t.IntersectionC<[t.TypeC<{
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
            category: t.UnionC<[t.LiteralC<"siolynx">, t.LiteralC<"minihost">, t.LiteralC<"fancontrol">, t.LiteralC<"c22">, t.LiteralC<"relay">, t.UndefinedC]>;
        }>]>;
        description: t.PartialC<{
            mib: t.StringC;
            link: t.BooleanC;
            baudRate: t.UnionC<[t.LiteralC<115200>, t.LiteralC<57600>, t.LiteralC<28800>]>;
            parity: t.UnionC<[t.LiteralC<"none">, t.LiteralC<"even">, t.LiteralC<"mark">]>;
            category: t.StringC;
            find: t.KeyofC<{
                sarp: null;
                version: null;
            }>;
            disableBatchReading: t.BooleanC;
        }>;
    }>]>;
}>;
export interface IPortAddedEvent extends t.TypeOf<typeof PortAddedEventV> {
}
export declare const PortRemovedEventV: t.TypeC<{
    event: t.LiteralC<string>;
    args: t.TupleC<[t.TypeC<{
        portInfo: t.IntersectionC<[t.TypeC<{
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
            category: t.UnionC<[t.LiteralC<"siolynx">, t.LiteralC<"minihost">, t.LiteralC<"fancontrol">, t.LiteralC<"c22">, t.LiteralC<"relay">, t.UndefinedC]>;
        }>]>;
        description: t.PartialC<{
            mib: t.StringC;
            link: t.BooleanC;
            baudRate: t.UnionC<[t.LiteralC<115200>, t.LiteralC<57600>, t.LiteralC<28800>]>;
            parity: t.UnionC<[t.LiteralC<"none">, t.LiteralC<"even">, t.LiteralC<"mark">]>;
            category: t.StringC;
            find: t.KeyofC<{
                sarp: null;
                version: null;
            }>;
            disableBatchReading: t.BooleanC;
        }>;
    }>, t.Mixed]> | t.TupleC<[t.TypeC<{
        portInfo: t.IntersectionC<[t.TypeC<{
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
            category: t.UnionC<[t.LiteralC<"siolynx">, t.LiteralC<"minihost">, t.LiteralC<"fancontrol">, t.LiteralC<"c22">, t.LiteralC<"relay">, t.UndefinedC]>;
        }>]>;
        description: t.PartialC<{
            mib: t.StringC;
            link: t.BooleanC;
            baudRate: t.UnionC<[t.LiteralC<115200>, t.LiteralC<57600>, t.LiteralC<28800>]>;
            parity: t.UnionC<[t.LiteralC<"none">, t.LiteralC<"even">, t.LiteralC<"mark">]>;
            category: t.StringC;
            find: t.KeyofC<{
                sarp: null;
                version: null;
            }>;
            disableBatchReading: t.BooleanC;
        }>;
    }>]>;
}>;
export interface IPortRemovedEvent extends t.TypeOf<typeof PortRemovedEventV> {
}
export declare const EventV: t.TaggedUnionC<"event", [t.TypeC<{
    event: t.LiteralC<string>;
    args: t.TupleC<[t.ArrayC<t.TypeC<{
        portInfo: t.IntersectionC<[t.TypeC<{
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
            category: t.UnionC<[t.LiteralC<"siolynx">, t.LiteralC<"minihost">, t.LiteralC<"fancontrol">, t.LiteralC<"c22">, t.LiteralC<"relay">, t.UndefinedC]>;
        }>]>;
        description: t.PartialC<{
            mib: t.StringC;
            link: t.BooleanC;
            baudRate: t.UnionC<[t.LiteralC<115200>, t.LiteralC<57600>, t.LiteralC<28800>]>;
            parity: t.UnionC<[t.LiteralC<"none">, t.LiteralC<"even">, t.LiteralC<"mark">]>;
            category: t.StringC;
            find: t.KeyofC<{
                sarp: null;
                version: null;
            }>;
            disableBatchReading: t.BooleanC;
        }>;
    }>>, t.Mixed]> | t.TupleC<[t.ArrayC<t.TypeC<{
        portInfo: t.IntersectionC<[t.TypeC<{
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
            category: t.UnionC<[t.LiteralC<"siolynx">, t.LiteralC<"minihost">, t.LiteralC<"fancontrol">, t.LiteralC<"c22">, t.LiteralC<"relay">, t.UndefinedC]>;
        }>]>;
        description: t.PartialC<{
            mib: t.StringC;
            link: t.BooleanC;
            baudRate: t.UnionC<[t.LiteralC<115200>, t.LiteralC<57600>, t.LiteralC<28800>]>;
            parity: t.UnionC<[t.LiteralC<"none">, t.LiteralC<"even">, t.LiteralC<"mark">]>;
            category: t.StringC;
            find: t.KeyofC<{
                sarp: null;
                version: null;
            }>;
            disableBatchReading: t.BooleanC;
        }>;
    }>>]>;
}>, t.TypeC<{
    event: t.LiteralC<string>;
    args: t.TupleC<[t.TypeC<{
        portInfo: t.IntersectionC<[t.TypeC<{
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
            category: t.UnionC<[t.LiteralC<"siolynx">, t.LiteralC<"minihost">, t.LiteralC<"fancontrol">, t.LiteralC<"c22">, t.LiteralC<"relay">, t.UndefinedC]>;
        }>]>;
        description: t.PartialC<{
            mib: t.StringC;
            link: t.BooleanC;
            baudRate: t.UnionC<[t.LiteralC<115200>, t.LiteralC<57600>, t.LiteralC<28800>]>;
            parity: t.UnionC<[t.LiteralC<"none">, t.LiteralC<"even">, t.LiteralC<"mark">]>;
            category: t.StringC;
            find: t.KeyofC<{
                sarp: null;
                version: null;
            }>;
            disableBatchReading: t.BooleanC;
        }>;
    }>, t.Mixed]> | t.TupleC<[t.TypeC<{
        portInfo: t.IntersectionC<[t.TypeC<{
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
            category: t.UnionC<[t.LiteralC<"siolynx">, t.LiteralC<"minihost">, t.LiteralC<"fancontrol">, t.LiteralC<"c22">, t.LiteralC<"relay">, t.UndefinedC]>;
        }>]>;
        description: t.PartialC<{
            mib: t.StringC;
            link: t.BooleanC;
            baudRate: t.UnionC<[t.LiteralC<115200>, t.LiteralC<57600>, t.LiteralC<28800>]>;
            parity: t.UnionC<[t.LiteralC<"none">, t.LiteralC<"even">, t.LiteralC<"mark">]>;
            category: t.StringC;
            find: t.KeyofC<{
                sarp: null;
                version: null;
            }>;
            disableBatchReading: t.BooleanC;
        }>;
    }>]>;
}>, t.TypeC<{
    event: t.LiteralC<string>;
    args: t.TupleC<[t.TypeC<{
        portInfo: t.IntersectionC<[t.TypeC<{
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
            category: t.UnionC<[t.LiteralC<"siolynx">, t.LiteralC<"minihost">, t.LiteralC<"fancontrol">, t.LiteralC<"c22">, t.LiteralC<"relay">, t.UndefinedC]>;
        }>]>;
        description: t.PartialC<{
            mib: t.StringC;
            link: t.BooleanC;
            baudRate: t.UnionC<[t.LiteralC<115200>, t.LiteralC<57600>, t.LiteralC<28800>]>;
            parity: t.UnionC<[t.LiteralC<"none">, t.LiteralC<"even">, t.LiteralC<"mark">]>;
            category: t.StringC;
            find: t.KeyofC<{
                sarp: null;
                version: null;
            }>;
            disableBatchReading: t.BooleanC;
        }>;
    }>, t.Mixed]> | t.TupleC<[t.TypeC<{
        portInfo: t.IntersectionC<[t.TypeC<{
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
            category: t.UnionC<[t.LiteralC<"siolynx">, t.LiteralC<"minihost">, t.LiteralC<"fancontrol">, t.LiteralC<"c22">, t.LiteralC<"relay">, t.UndefinedC]>;
        }>]>;
        description: t.PartialC<{
            mib: t.StringC;
            link: t.BooleanC;
            baudRate: t.UnionC<[t.LiteralC<115200>, t.LiteralC<57600>, t.LiteralC<28800>]>;
            parity: t.UnionC<[t.LiteralC<"none">, t.LiteralC<"even">, t.LiteralC<"mark">]>;
            category: t.StringC;
            find: t.KeyofC<{
                sarp: null;
                version: null;
            }>;
            disableBatchReading: t.BooleanC;
        }>;
    }>]>;
}>]>;
export declare type Event = IPortsEvent | IPortAddedEvent | IPortRemovedEvent;
export declare class FromStringType<A> extends t.Type<A, string, unknown> {
    constructor(name: string, type: Mixed);
}
export declare class EventFromStringType extends FromStringType<Event> {
    constructor();
}
export declare const EventFromString: EventFromStringType;
//# sourceMappingURL=events.d.ts.map