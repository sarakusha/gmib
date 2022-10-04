interface Window {
    readonly mediaStream: { updateSrcObject: (selector: string) => void; };
    readonly log: (...params: any[]) => void;
    readonly setDispatch: (newDispatch: Dispatch) => void;
    readonly server: { port: number; };
}
