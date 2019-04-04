/// <reference types="node" />
import { Socket, SocketConstructorOpts } from 'net';
import { IPortArg } from './events';
export interface IClient {
    addListener(event: 'ports', listener: (ports: IPortArg[]) => void): this;
    addListener(event: 'add', listener: (port: IPortArg) => void): this;
    addListener(event: 'remove', listener: (port: IPortArg) => void): this;
    on(event: 'ports', listener: (ports: IPortArg[]) => void): this;
    on(event: 'add', listener: (port: IPortArg) => void): this;
    on(event: 'remove', listener: (port: IPortArg) => void): this;
    once(event: 'ports', listener: (ports: IPortArg[]) => void): this;
    once(event: 'add', listener: (port: IPortArg) => void): this;
    once(event: 'remove', listener: (port: IPortArg) => void): this;
}
export default class IPCClient extends Socket implements IClient {
    protected constructor(options?: SocketConstructorOpts);
    parseEvents: (data: Buffer) => void;
    send(event: string, ...args: any[]): Promise<void>;
    static connect(path: string, connectionListener?: () => void): IPCClient;
}
//# sourceMappingURL=Client.d.ts.map