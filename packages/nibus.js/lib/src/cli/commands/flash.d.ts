import { CommandModule, Defined } from 'yargs';
import { CommonOpts } from '../options';
declare type FlashOpts = Defined<CommonOpts, 'm' | 'mac'> & {
    kind: string;
    source: string;
    src?: string;
    execute?: string;
};
declare const flashCommand: CommandModule<CommonOpts, FlashOpts>;
export default flashCommand;
//# sourceMappingURL=flash.d.ts.map