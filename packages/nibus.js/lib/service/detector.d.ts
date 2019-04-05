/// <reference types="node" />
import { EventEmitter } from 'events';
import { Category, HexOrNumber, IKnownPort, IMibDescription } from '@nata/nibus.js-client/lib/session/KnownPorts';
interface IDetectorItem {
    device: string;
    vid: HexOrNumber;
    pid: HexOrNumber;
    manufacturer?: string;
    serialNumber?: string;
    category: Category;
}
interface IDetection {
    mibCategories: {
        [category: string]: IMibDescription;
    };
    knownDevices: IDetectorItem[];
}
declare class Detector extends EventEmitter {
    start(): void;
    stop(): void;
    restart(): void;
    getPorts(): Promise<IKnownPort[]>;
    readonly detection: IDetection | undefined;
}
declare const detector: Detector;
export default detector;
//# sourceMappingURL=detector.d.ts.map