import { SerialTee } from '../ipc';
declare class NibusService {
    private readonly server;
    private isStarted;
    private connections;
    constructor();
    updateLogger(connection?: SerialTee): void;
    private logLevelHandler;
    private connectionHandler;
    private addHandler;
    private removeHandler;
    start(): void;
    stop(): void;
    readonly path: string;
}
declare const service: NibusService;
export default service;
//# sourceMappingURL=index.d.ts.map