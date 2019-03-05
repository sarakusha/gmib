import { CommandModule, Defined } from 'yargs';
import { CommonOpts } from '../options';
declare type ReadOpts = Defined<CommonOpts, 'id' | 'name' | 'm' | 'mac'>;
declare const readCommand: CommandModule<CommonOpts, ReadOpts>;
export default readCommand;
//# sourceMappingURL=read.d.ts.map