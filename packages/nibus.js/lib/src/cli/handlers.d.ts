import { Arguments, Defined } from 'yargs';
import { IDevice } from '../mib';
import { CommonOpts } from './options';
interface ActionFunc<O> {
    (device: IDevice, args: Arguments<O>): Promise<void>;
}
declare const makeAddressHandler: <O extends Defined<CommonOpts, "m" | "mac">>(action: ActionFunc<O>, breakout?: boolean) => (args: Arguments<O>) => Promise<{}>;
export { makeAddressHandler };
//# sourceMappingURL=handlers.d.ts.map