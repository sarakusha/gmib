/// <reference types="node" />
import { Transform, TransformCallback, TransformOptions } from 'stream';
export default class NibusEncoder extends Transform {
    constructor(options?: TransformOptions);
    _transform(chunk: any, _encoding: string, callback: TransformCallback): void;
}
//# sourceMappingURL=NibusEncoder.d.ts.map