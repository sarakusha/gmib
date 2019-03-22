import { CommandModule, Defined } from 'yargs';
import { CommonOpts } from '../options';
declare type ExecuteOpts = Defined<CommonOpts, 'm' | 'mac'> & {
    program: string;
};
declare const executeCommand: CommandModule<CommonOpts, ExecuteOpts>;
export default executeCommand;
//# sourceMappingURL=execute.d.ts.map