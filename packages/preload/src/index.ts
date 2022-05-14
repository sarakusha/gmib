/**
 * @module preload
 */

import { contextBridge } from 'electron';

import log from '/@main/initlog';

import * as config from './config';
import * as db from './db';
import * as dialogs from './dialogs';
import { setDispatch } from './ipcDispatch';
import * as nibus from './nibus';
import * as novastar from './novastar';

type Id<T> = T extends Record<PropertyKey, unknown>
  ? // eslint-disable-next-line @typescript-eslint/ban-types
    {} & { [P in keyof T]: Id<T[P]> }
  : T extends PromiseLike<infer M>
  ? Promise<Id<M>>
  : T extends (infer U)[]
  ? Id<U>[]
  : // : T extends (...args: infer A) => PromiseLike<infer R>
    // ? (...args: Id<A>) => Promise<Id<R>>
    // : T extends (...args: infer A) => infer R
    // ? (...args: Id<A>) => R
    T;

const expandTypes = <T>(value: T): Id<T> => value as Id<T>;
/*
type N = Id<typeof nibus>;
type P = N['ping'];

type Test = {
  a: number;
  b: string;
};

type F = (a: Pick<Test, 'a'>, b: Pick<Test, 'b'>) => Test;

type IsFunc<T> = T extends (...args: infer A) => infer R ? [Id<A>, R] : never;

type IsArray<T> = T extends any[] ? T[number][] : false;

type a = IsArray<F[]>;

type T1 = {
  t1: Pick<Test, 'a'>;
  t2: Pick<Test, 'b'>;
  f: F;
  i: number[];
  ta: Pick<Test, 'a'>[];
  p: () => Promise<Pick<Test, 'a'>>;
};

type X<T> = T extends () => PromiseLike<infer U> ? U : T;
type x = X<T1['p']>;

type TA = Pick<Test, 'a'>[];

type TT = Id<T1>;
*/

/**
 * The "Main World" is the JavaScript context that your main renderer code runs in.
 * By default, the page you load in your renderer executes code in this world.
 *
 * @see https://www.electronjs.org/docs/api/context-bridge
 */

/**
 * After analyzing the `exposeInMainWorld` calls,
 * `packages/preload/exposedInMainWorld.d.ts` file will be generated.
 * It contains all interfaces.
 * `packages/preload/exposedInMainWorld.d.ts` file is required for TS is `renderer`
 *
 * @see https://github.com/cawa-93/dts-for-context-bridge
 */

/**
 * Expose Environment versions.
 * @example
 * console.log( window.versions )
 */
contextBridge.exposeInMainWorld('versions', process.versions);
contextBridge.exposeInMainWorld('setDispatch', setDispatch);
contextBridge.exposeInMainWorld('novastar', expandTypes(novastar));
contextBridge.exposeInMainWorld('nibus', expandTypes(nibus));
contextBridge.exposeInMainWorld('config', expandTypes(config));
contextBridge.exposeInMainWorld('dialogs', expandTypes(dialogs));
contextBridge.exposeInMainWorld('db', expandTypes(db));
contextBridge.exposeInMainWorld('log', log.log.bind(log));
