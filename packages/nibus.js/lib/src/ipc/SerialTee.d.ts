/// <reference types="node" />
import { EventEmitter } from 'events';
import { IKnownPort } from '../service/KnownPorts';
import { Direction } from './Server';
import { IMibDescription } from '../service';
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
    static getSocketPath(path: string): string;
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