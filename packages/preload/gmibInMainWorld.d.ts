interface Window {
    /**
     * Expose Environment versions.
     * @example
     * console.log( window.versions )
     */
    readonly versions: NodeJS.ProcessVersions;
    readonly server: { port: number; };
    readonly setDispatch: (newDispatch: Dispatch) => void;
    readonly nibus: { createDevice: { (parent: import("/Users/sarakusha/src/gmib/node_modules/.pnpm/@nibus+core@5.0.1_@nibus+mibs@5.0.1_buffer@6.0.3_debug@4.4.0/node_modules/@nibus/core/build/NibusConnection-Ct52VW-r").a, address: string, mib: string): void; (parent: import("/Users/sarakusha/src/gmib/node_modules/.pnpm/@nibus+core@5.0.1_@nibus+mibs@5.0.1_buffer@6.0.3_debug@4.4.0/node_modules/@nibus/core/build/NibusConnection-Ct52VW-r").a, address: string, type: number, version?: number | undefined): void; }; findMibByType: (type: number, version?: number | undefined) => string | undefined; readonly reloadDevices: () => void; readonly setLogLevel: (logLevel: 'nibus' | 'none' | 'hex') => void; readonly ping: (address: string) => Promise<[-1, undefined] | [number, Version]>; readonly setDeviceValue: (deviceId: import("/Users/sarakusha/src/gmib/node_modules/.pnpm/@nibus+core@5.0.1_@nibus+mibs@5.0.1_buffer@6.0.3_debug@4.4.0/node_modules/@nibus/core/build/NibusConnection-Ct52VW-r").a) => (name: string, value: import("/Users/sarakusha/src/gmib/packages/common/helpers").ValueType) => Promise<void>; readonly sendConfig: _.DebouncedFunc<(state: Record<string, unknown>) => void>; readonly reloadDevice: (deviceId: import("/Users/sarakusha/src/gmib/node_modules/.pnpm/@nibus+core@5.0.1_@nibus+mibs@5.0.1_buffer@6.0.3_debug@4.4.0/node_modules/@nibus/core/build/NibusConnection-Ct52VW-r").a) => Promise<void>; readonly releaseDevice: (deviceId: import("/Users/sarakusha/src/gmib/node_modules/.pnpm/@nibus+core@5.0.1_@nibus+mibs@5.0.1_buffer@6.0.3_debug@4.4.0/node_modules/@nibus/core/build/NibusConnection-Ct52VW-r").a) => void; readonly writeToStorage: (deviceId: import("/Users/sarakusha/src/gmib/node_modules/.pnpm/@nibus+core@5.0.1_@nibus+mibs@5.0.1_buffer@6.0.3_debug@4.4.0/node_modules/@nibus/core/build/NibusConnection-Ct52VW-r").a) => Promise<boolean>; readonly findDevices: (options: import("/Users/sarakusha/src/gmib/packages/common/helpers").FinderOptions) => Promise<void>; readonly cancelSearch: () => Promise<void>; readonly telemetry: ((id: import("/Users/sarakusha/src/gmib/node_modules/.pnpm/@nibus+core@5.0.1_@nibus+mibs@5.0.1_buffer@6.0.3_debug@4.4.0/node_modules/@nibus/core/build/NibusConnection-Ct52VW-r").a) => import("/Users/sarakusha/src/gmib/packages/common/helpers").NibusTelemetry) & _.MemoizedFunction; readonly getBrightnessHistory: (dt?: number | undefined) => Promise<({ timestamp: number; brightness: number; } & { actual?: number | undefined; })[]>; readonly mibTypes: { value: string; name: string; }[]; readonly flash: (id: import("/Users/sarakusha/src/gmib/node_modules/.pnpm/@nibus+core@5.0.1_@nibus+mibs@5.0.1_buffer@6.0.3_debug@4.4.0/node_modules/@nibus/core/build/NibusConnection-Ct52VW-r").a, kind: false | 'fpga' | 'mcu' | 'rbf' | 'ttc' | 'ctrl' | 'tca' | 'tcc', filename: string | undefined, moduleSelect?: number | undefined) => Promise<void>; readonly addPlayerListener: (path: string) => void; readonly removePlayerListener: (path: string) => void; readonly hasPlayerListener: (path: string) => boolean; };
    readonly config: { readonly get: <Key extends keyof import("/Users/sarakusha/src/gmib/packages/common/helpers").LocalConfig>(key: Key) => Promise<import("/Users/sarakusha/src/gmib/packages/common/helpers").LocalConfig[Key]>; readonly set: <Key extends keyof import("/Users/sarakusha/src/gmib/packages/common/helpers").LocalConfig>(key: Key, value: import("/Users/sarakusha/src/gmib/packages/common/helpers").LocalConfig[Key]) => Promise<void>; };
    readonly dialogs: { readonly showOpenDialogSync: { (window: Electron.BaseWindow, options: Electron.OpenDialogSyncOptions): string[] | undefined; (options: Electron.OpenDialogSyncOptions): string[] | undefined; }; readonly showErrorBox: (title: string, content: string) => void; readonly saveJSON: (options: SaveOpts) => boolean; readonly loadJSON: (title?: string) => Record<string, unknown> | null; };
    readonly log: (...params: any[]) => void;
    readonly setLogLevel: (logLevel: 'nibus' | 'none' | 'hex') => void;
    readonly identify: { readonly getSecret: () => string | undefined; readonly setSecret: (apiSecret: bigint | null, identifier?: string | undefined) => void; readonly getIdentifier: () => string | undefined; readonly generateSignature: (method: string, uri: string, timestamp: number, body?: unknown) => Promise<string | undefined>; readonly initialized: Promise<boolean>; };
    readonly initializeNovastar: () => Promise<boolean>;
    readonly mediaSource: { readonly close: (screenId: number) => void; readonly play: _.DebouncedFunc<(screenId: number) => Promise<void>>; };
}
