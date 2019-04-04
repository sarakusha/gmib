/// <reference types="node" />
import { Socket } from 'net';
import { Duplex } from 'stream';
export declare enum Direction {
    in = 0,
    out = 1
}
interface IPCServer {
    on(event: 'connection', listener: (socket: Socket) => void): this;
    on(event: 'client:error', listener: (err: Error) => void): this;
    on(event: 'raw', listener: (data: Buffer, dir: Direction) => void): this;
    on(event: string | symbol, listener: (...args: any[]) => void): this;
    once(event: 'connection', listener: (socket: Socket) => void): this;
    once(event: 'raw', listener: (data: Buffer, dir: Direction) => void): this;
    once(event: string | symbol, listener: (...args: any[]) => void): this;
    addListener(event: 'connection', listener: (socket: Socket) => void): this;
    addListener(event: 'client:error', listener: (err: Error) => void): this;
    addListener(event: 'raw', listener: (data: Buffer, dir: Direction) => void): this;
    addListener(event: string | symbol, listener: (...args: any[]) => void): this;
    emit(event: 'connection', socket: Socket): boolean;
    emit(event: 'client:error', err: Error): boolean;
    emit(event: 'raw', data: Buffer, dir: Direction): boolean;
    emit(event: string | symbol, ...args: any[]): boolean;
}
declare class IPCServer extends Duplex {
    private readonly raw;
    private readonly server;
    private readonly clients;
    private closed;
    private reading;
    constructor(path: string, raw?: boolean);
    private connectionHandler;
    private errorHandler;
    private clientErrorHandler;
    private clientDataHandler;
    private removeClient;
    _write(chunk: any, encoding: string, callback: (error?: (Error | null)) => void): void;
    _read(size: number): void;
    readonly path: string;
    send(client: Socket, event: string, ...args: any[]): Promise<void>;
    broadcast(event: string, ...args: any[]): Promise<void>;
    close: () => void;
}
export default IPCServer;
//# sourceMappingURL=Server.d.ts.map