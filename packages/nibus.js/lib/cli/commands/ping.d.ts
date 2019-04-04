import { CommandModule, Defined } from 'yargs';
import { CommonOpts } from '../options';
declare type PingOpts = Defined<CommonOpts, 'm' | 'mac'> & {
    c?: number;
    count?: number;
    t: number;
    timeout?: number;
};
declare const pingCommand: CommandModule<CommonOpts, PingOpts>;
export default pingCommand;
//# sourceMappingURL=ping.d.ts.map