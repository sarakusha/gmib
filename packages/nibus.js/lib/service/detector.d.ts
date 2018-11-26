/// <reference types="node" />
import SerialPort from 'serialport';
import { EventEmitter } from 'events';
import { NibusBaudRate } from '../nibus';
/**
 * @fires add
 * @fires remove
 * @fires plug
 * @fires unplug
 */
declare class Detector extends EventEmitter {
    start(): void;
    stop(): void;
    restart(): void;
    readonly ports: IKnownPort[];
    readonly detection: IDetection | undefined;
}
declare const detector: Detector;
declare type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;
export interface IKnownPort extends Omit<SerialPort.PortInfo, 'productId' | 'vendorId'> {
    device?: string;
    productId: number;
    vendorId: number;
    category?: string;
}
declare type HexOrNumber = string | number;
declare type Category = 'siolynx' | 'minihost' | 'fancontrol' | 'c22' | 'relay';
interface IDetectorItem {
    device: string;
    vid: HexOrNumber;
    pid: HexOrNumber;
    manufacturer?: string;
    serialNumber?: string;
    category: Category;
}
export interface IMibDescription {
    mib?: string;
    link?: boolean;
    baudRate?: NibusBaudRate;
    category: string;
    find?: string;
    disableBatchReading?: boolean;
}
interface IDetection {
    mibCategories: {
        [category: string]: IMibDescription;
    };
    knownDevices: IDetectorItem[];
}
export default detector;
//# sourceMappingURL=detector.d.ts.map