/// <reference types="node" />
import { EventEmitter } from 'events';
import { IDevice } from '../mib';
/**
 * @fires add
 * @fires remove
 * @fires connected
 * @fires disconnected
 * @fires start
 * @fires stop
 * @fires found
 */
declare class NibusService extends EventEmitter {
    private connections;
    private isStarted;
    private addHandler;
    private removeHandler;
    private find;
    start(): void;
    stop(): void;
    pingDevice(device: IDevice): Promise<number>;
}
declare const service: NibusService;
export default service;
//# sourceMappingURL=service.d.ts.map