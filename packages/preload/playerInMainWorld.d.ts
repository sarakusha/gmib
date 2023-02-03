interface Window {
    readonly mediaStream: { updateSrcObject: (selector: string) => void; };
    readonly log: (...params: any[]) => void;
    readonly setDispatch: (newDispatch: Dispatch) => void;
    readonly server: { port: number; };
    readonly identify: { readonly getSecret: () => string | undefined; readonly setSecret: (apiSecret: bigint, identifier?: string | undefined) => void; readonly getIdentifier: () => string | undefined; readonly generateSignature: (method: string, uri: string, timestamp: number, body?: unknown) => string | undefined; };
}
