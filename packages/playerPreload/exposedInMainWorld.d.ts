interface Window {
    readonly nodeCrypto: { readonly createHash: (algorithm: string, options?: import("crypto").HashOptions | undefined) => { update: { (data: import("crypto").BinaryLike): import("crypto").Hash; (data: string, inputEncoding: import("crypto").Encoding): import("crypto").Hash; }; digest: { (): Buffer; (encoding: import("crypto").BinaryToTextEncoding): string; }; }; };
    readonly log: (...params: any[]) => void;
    readonly server: { port: number; };
}
