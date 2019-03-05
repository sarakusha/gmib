import { CommandModule, Defined } from 'yargs';
import { CommonOpts } from '../options';
declare type UploadOpts = Defined<CommonOpts, 'mac' | 'm'> & {
    domain: string;
    offset: number;
    size?: number;
    o?: string;
    out?: string;
    hex?: boolean;
    f?: boolean;
    force?: boolean;
};
declare const uploadCommand: CommandModule<CommonOpts, UploadOpts>;
export default uploadCommand;
//# sourceMappingURL=upload.d.ts.map