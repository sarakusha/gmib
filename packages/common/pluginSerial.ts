export type PluginSerialDevice = {
  path: string;
  vendorId?: string;
  productId?: string;
  serialNumber?: string;
  manufacturer?: string;
};
export type PluginSerialConnection = {
  request: (command: string, responsePrefix: string) => Promise<string>;
  close: () => Promise<void>;
};
export type PluginSerialApi = {
  list: () => Promise<PluginSerialDevice[]>;
  open: (options: {
    path: string;
    baudRate: number;
    vendorId: string;
    productId: string;
  }) => Promise<PluginSerialConnection>;
};
