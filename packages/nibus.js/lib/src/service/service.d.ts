/// <reference types="node" />
import { EventEmitter } from 'events';
import { IDevice } from '../mib';
declare class NibusService extends EventEmitter {
    private connections;
    private isStarted;
    private addHandler;
    private removeHandler;
    private find;
    start(watch?: boolean): Promise<void>;
    stop(): void;
    pingDevice(device: IDevice): Promise<number>;
}
declare const service: NibusService;
export default service;
//# sourceMappingURL=service.d.ts.map