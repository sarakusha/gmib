import * as t from 'io-ts';
import { Mixed } from 'io-ts/lib';
import { IMibDescription } from '../MibDescription';
import { IKnownPort } from '../session/KnownPorts';
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
    description: t.Type<IMibDescription, IMibDescription, unknown>;
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
        description: t.Type<IMibDescription, IMibDescription, unknown>;
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
        description: t.Type<IMibDescription, IMibDescription, unknown>;
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
        description: t.Type<IMibDescription, IMibDescription, unknown>;
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
        description: t.Type<IMibDescription, IMibDescription, unknown>;
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
        description: t.Type<IMibDescription, IMibDescription, unknown>;
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
        description: t.Type<IMibDescription, IMibDescription, unknown>;
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
        description: t.Type<IMibDescription, IMibDescription, unknown>;
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
        description: t.Type<IMibDescription, IMibDescription, unknown>;
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
        description: t.Type<IMibDescription, IMibDescription, unknown>;
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
        description: t.Type<IMibDescription, IMibDescription, unknown>;
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
        description: t.Type<IMibDescription, IMibDescription, unknown>;
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
        description: t.Type<IMibDescription, IMibDescription, unknown>;
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