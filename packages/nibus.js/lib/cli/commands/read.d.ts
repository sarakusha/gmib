import { Arguments, CommandModule, Defined } from 'yargs';
import { IDevice } from '@nata/nibus.js-client/lib/mib';
import { CommonOpts } from '../options';
declare type ReadOpts = Defined<CommonOpts, 'id' | 'name' | 'm' | 'mac'>;
export declare function action(device: IDevice, args: Arguments<ReadOpts>): Promise<void>;
declare const readCommand: CommandModule<CommonOpts, ReadOpts>;
export default readCommand;
//# sourceMappingURL=read.d.ts.map