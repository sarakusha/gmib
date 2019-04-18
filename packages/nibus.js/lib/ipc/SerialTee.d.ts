/// <reference types="node" />
import { EventEmitter } from 'events';
import { Direction } from './Server';
import { IKnownPort } from '@nata/nibus.js-client/lib/session';
import { IMibDescription } from '@nata/nibus.js-client/lib/MibDescription';
export interface SerialLogger {
    (data: Buffer, dir: Direction): void;
}
export default class SerialTee extends EventEmitter {
    readonly portInfo: IKnownPort;
    readonly description: IMibDescription;
    private readonly serial;
    private closed;
    private readonly server;
    private logger;
    constructor(portInfo: IKnownPort, description: IMibDescription);
    readonly path: string;
    close: () => void;
    setLogger(logger: SerialLogger | null): void;
    toJSON(): {
        portInfo: IKnownPort;
        description: IMibDescription;
    };
}
//# sourceMappingURL=SerialTee.d.ts.map