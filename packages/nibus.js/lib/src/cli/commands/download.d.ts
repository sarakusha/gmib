/// <reference types="node" />
import { Arguments, CommandModule, Defined } from 'yargs';
import { IDevice } from '../../mib';
import { CommonOpts } from '../options';
declare type DownloadOpts = Defined<CommonOpts, 'm' | 'mac'> & {
    domain: string;
    offset: number;
    source?: string;
    src?: string;
    hex?: boolean;
};
export declare const convert: (buffer: Buffer) => [Buffer, number];
export declare function action(device: IDevice, args: Arguments<DownloadOpts>): Promise<void>;
declare const downloadCommand: CommandModule<CommonOpts, DownloadOpts>;
export default downloadCommand;
//# sourceMappingURL=download.d.ts.map