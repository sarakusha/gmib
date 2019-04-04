/// <reference types="node" />
import { Transform, TransformCallback, TransformOptions } from 'stream';
export default class NibusDecoder extends Transform {
    private buf;
    constructor(options?: TransformOptions);
    _transform(chunk: any, encoding: string, callback: TransformCallback): void;
    _flush(callback: TransformCallback): void;
    private analyze;
}
//# sourceMappingURL=NibusDecoder.d.ts.map