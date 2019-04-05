/// <reference types="node" />
import { EventEmitter } from 'events';
import { AddressParam } from '../Address';
import { NmsDatagram } from '../nms';
import { SarpDatagram } from '../sarp';
import { IMibDescription } from '../MibDescription';
import NibusDatagram from './NibusDatagram';
export declare const MINIHOST_TYPE = 43974;
export declare const setNibusTimeout: (timeout: number) => void;
export declare const getNibusTimeout: () => number;
declare type SarpListner = (datagram: SarpDatagram) => void;
declare type NmsListener = (datagram: NmsDatagram) => void;
declare interface NibusConnection {
    on(event: 'sarp', listener: SarpListner): this;
    on(event: 'nms', listener: NmsListener): this;
    once(event: 'sarp', listener: SarpListner): this;
    once(event: 'nms', listener: NmsListener): this;
    addListener(event: 'sarp', listener: SarpListner): this;
    addListener(event: 'nms', listener: NmsListener): this;
}
declare class NibusConnection extends EventEmitter {
    readonly path: string;
    private readonly socket;
    private readonly encoder;
    private readonly decoder;
    private ready;
    private closed;
    private readonly waited;
    readonly description: IMibDescription;
    private stopWaiting;
    private onDatagram;
    constructor(path: string, description: IMibDescription);
    sendDatagram(datagram: NibusDatagram): Promise<NmsDatagram | NmsDatagram[] | undefined>;
    ping(address: AddressParam): Promise<number>;
    findByType(type?: number): Promise<NmsDatagram | NmsDatagram[] | undefined>;
    getVersion(address: AddressParam): Promise<number[]>;
    close: () => void;
}
export default NibusConnection;
//# sourceMappingURL=NibusConnection.d.ts.map