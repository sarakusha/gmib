import { CommandModule, Defined } from 'yargs';
import { CommonOpts } from '../options';
declare type WriteOpts = Defined<CommonOpts, 'mac' | 'm'>;
declare const writeCommand: CommandModule<CommonOpts, WriteOpts>;
export default writeCommand;
//# sourceMappingURL=write.d.ts.map