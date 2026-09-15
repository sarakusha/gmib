interface Window {
    /**
     * Expose Environment versions.
     * @example
     * console.log( window.versions )
     */
    readonly versions: any;
    readonly server: { port: number; };
    readonly setDispatch: (newDispatch: Dispatch) => void;
    readonly nibus: { createDevice: { (parent: DeviceId, address: string, mib: string): void; (parent: DeviceId, address: string, type: number, version?: number | undefined): void; }; findMibByType: any; readonly reloadDevices: any; readonly setLogLevel: any; readonly ping: (address: string) => Promise<[-1, undefined] | [number, Version]>; readonly setDeviceValue: (deviceId: DeviceId) => (name: string, value: import("/Users/sarakusha/src/gmib/packages/common/helpers").ValueType) => Promise<void>; readonly sendConfig: _.DebouncedFunc<(state: Record<string, unknown>) => void>; readonly reloadDevice: (deviceId: DeviceId) => Promise<void>; readonly releaseDevice: (deviceId: DeviceId) => void; readonly writeToStorage: (deviceId: DeviceId) => Promise<boolean>; readonly findDevices: (options: import("/Users/sarakusha/src/gmib/packages/common/helpers").FinderOptions) => Promise<void>; readonly cancelSearch: () => Promise<void>; readonly telemetry: ((id: DeviceId) => import("/Users/sarakusha/src/gmib/packages/common/helpers").NibusTelemetry) & _.MemoizedFunction; readonly getBrightnessHistory: any; readonly mibTypes: { value: string | number | symbol; name: any; }[]; readonly flash: (id: DeviceId, kind: any, filename: string | undefined, moduleSelect?: number | undefined) => Promise<void>; readonly addPlayerListener: (path: string) => void; readonly removePlayerListener: (path: string) => void; readonly hasPlayerListener: (path: string) => boolean; };
    readonly config: { readonly get: <Key extends keyof import("/Users/sarakusha/src/gmib/packages/common/helpers").LocalConfig>(key: Key) => Promise<import("/Users/sarakusha/src/gmib/packages/common/helpers").LocalConfig[Key]>; readonly set: <Key extends keyof import("/Users/sarakusha/src/gmib/packages/common/helpers").LocalConfig>(key: Key, value: import("/Users/sarakusha/src/gmib/packages/common/helpers").LocalConfig[Key]) => Promise<void>; };
    readonly dialogs: { readonly showOpenDialogSync: any; readonly showErrorBox: any; readonly showSaveDialogSync: (options: SaveDialogSyncOptions) => string | undefined; readonly saveJSON: (options: SaveOpts) => boolean; readonly loadJSON: (title?: string) => Record<string, unknown> | null; };
    readonly log: any;
    readonly setLogLevel: (logLevel: LogLevel) => void;
    readonly identify: { readonly getSecret: () => any; readonly setSecret: (apiSecret: bigint | null, identifier?: string | undefined) => void; readonly getIdentifier: () => string | undefined; readonly generateSignature: (method: string, uri: string, timestamp: number, body?: unknown) => Promise<string | undefined>; readonly initialized: Promise<boolean>; };
    readonly initializeNovastar: () => Promise<boolean>;
    readonly getLicenseState: () => Promise<import('../common/license').LicenseRuntimeState | undefined>;
    readonly mediaSource: { readonly close: (screenId: number) => void; readonly play: (screenId: number) => void; };
    readonly plugins: { readonly list: () => Promise<import("/Users/sarakusha/src/gmib/packages/common/plugins").PluginStatus[]>; readonly catalog: () => Promise<import("/Users/sarakusha/src/gmib/packages/common/plugins").PluginCatalogEntry[]>; readonly install: () => Promise<import("/Users/sarakusha/src/gmib/packages/common/plugins").PluginInstallResult>; readonly installOfficial: (id: string) => Promise<import("/Users/sarakusha/src/gmib/packages/common/plugins").PluginInstallResult>; readonly setEnabled: (id: string, enabled: boolean) => Promise<import("/Users/sarakusha/src/gmib/packages/common/plugins").PluginStatus>; readonly uninstall: (id: string) => Promise<boolean>; readonly openControl: (id: string) => Promise<void>; readonly restart: () => Promise<void>; };
}
