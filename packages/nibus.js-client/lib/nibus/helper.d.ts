/// <reference types="node" />
declare type Arrayable = any[] | Buffer | string;
export declare function chunkArray<T extends Arrayable>(array: T, len: number): T[];
export declare function printBuffer(buffer: Buffer): string;
export {};
//# sourceMappingURL=helper.d.ts.map