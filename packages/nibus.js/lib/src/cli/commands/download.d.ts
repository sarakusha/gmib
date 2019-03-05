import { CommandModule, Defined } from 'yargs';
import { CommonOpts } from '../options';
declare type DownloadOpts = Defined<CommonOpts, 'm' | 'mac'> & {
    domain: string;
    offset: number;
    source?: string;
    src?: string;
    hex?: boolean;
};
declare const downloadCommand: CommandModule<CommonOpts, DownloadOpts>;
export default downloadCommand;
//# sourceMappingURL=download.d.ts.map