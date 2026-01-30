interface Window {
    readonly mediaStream: { updateSrcObject: (selector: string) => void; };
    readonly log: any;
    readonly setDispatch: (newDispatch: Dispatch) => void;
    readonly identify: { readonly getSecret: () => string | undefined; readonly setSecret: (apiSecret: bigint | null, identifier?: string | undefined) => void; readonly getIdentifier: () => string | undefined; readonly generateSignature: (method: string, uri: string, timestamp: number, body?: unknown) => Promise<string | undefined>; readonly initialized: Promise<boolean>; };
    readonly socket: { broadcast: (event: string, ...args: unknown[]) => any; };
    readonly onUpdatePlaylist: (callback: () => void) => any;
}
