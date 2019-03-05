/// <reference types="node" />
import { EventEmitter } from 'events';
import { IKnownPort } from '../service/KnownPorts';
import { IMibDescription } from '../service';
export default class SerialTee extends EventEmitter {
    readonly portInfo: IKnownPort;
    readonly description: IMibDescription;
    private readonly serial;
    private closed;
    private readonly server;
    static getSocketPath(path: string): string;
    constructor(portInfo: IKnownPort, description: IMibDescription);
    readonly path: string;
    close: () => void;
    toJSON(): {
        portInfo: IKnownPort;
        description: IMibDescription;
    };
}
//# sourceMappingURL=SerialTee.d.ts.map