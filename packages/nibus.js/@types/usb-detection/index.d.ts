import Promise from 'bluebird';

declare namespace detector {
  export type Callback = ((err?: any, result?: IDevice[]) => void) | null;
  export type FindPromise = Promise<IDevice[]>;
  export type DeviceCallback = (device: IDevice) => void;
  export interface IDevice {
    vendorId: number;
    productId: number;
    deviceName: string;
    manufacturer: string;
    serialNumber: string;
    deviceAddress: number;
  }
}

declare const detector: {
  version: string;
  find(vid: number, pid: number, callback: detector.Callback): detector.FindPromise;
  find(vid: number, callback: detector.Callback): detector.FindPromise;
  find(callback: detector.Callback): detector.FindPromise;
  startMonitoring(): void;
  stopMonitoring(): void;
  on(event: string, callback: detector.DeviceCallback): void;
};

export = detector;
