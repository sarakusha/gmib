import { Arguments, Defined } from 'yargs';
import Address from '../Address';
import { NibusConnection } from '../nibus';
import { CommonOpts } from './options';
interface ActionFunc<O> {
    (args: Arguments<O>, address: Address, connection: NibusConnection, mib?: string): Promise<void>;
    (args: Arguments<O>, address: Address, connection: NibusConnection, type: number): Promise<void>;
}
declare const makeAddressHandler: <O extends Defined<CommonOpts, "mac" | "m">>(action: ActionFunc<O>, breakout?: boolean) => (args: Arguments<O>) => Promise<{}>;
export { makeAddressHandler };
//# sourceMappingURL=handlers.d.ts.map