/// <reference types="node" />
import { Socket } from 'net';
import { Duplex } from 'stream';
export default class IPCServer extends Duplex {
    private readonly raw;
    private readonly server;
    private readonly clients;
    private closed;
    private reading;
    constructor(path: string, raw?: boolean);
    private connectionHandler;
    private errorHandler;
    private closeHandler;
    private clientErrorHandler;
    private clientDataHandler;
    private removeClient;
    _write(chunk: any, encoding: string, callback: (error?: (Error | null)) => void): void;
    _read(size: number): void;
    readonly path: string;
    send(client: Socket, event: string, ...args: any[]): Promise<void>;
    broadcast(event: string, ...args: any[]): Promise<void>;
    close(): void;
}
//# sourceMappingURL=Server.d.ts.map