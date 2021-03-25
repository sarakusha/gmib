/*
 * @license
 * Copyright (c) 2020. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

export type AppendFlags = {
  input?: boolean;
  tail?: boolean;
  raw?: boolean;
};

export type ExtractFlags = {
  raw?: boolean;
};

export type MaskedState = { _value: string };

export type Direction = 'NONE' | 'LEFT' | 'FORCE_LEFT' | 'RIGHT' | 'FORCE_RIGHT';

export interface AppendTail {
  append(str: string, flags?: AppendFlags): ChangeDetails;
  _appendPlaceholder(): ChangeDetails;
}

export interface TailDetails {
  /** Tail start position */
  from: number;
  /** Start position */
  stop?: number;
  /** */
  state: unknown;

  toString(): string;
  extend(value: string | TailDetails): void;
  appendTo(masked: AppendTail): ChangeDetails;
  shiftBefore(pos: number): string;
}

interface ChangeDetails {
  /** Inserted symbols */
  inserted: string;
  /** Can skip chars */
  skip: boolean;
  /** Additional offset if any changes occurred before tail */
  tailShift: number;
  /** Raw inserted is used by dynamic mask */
  rawInserted: string;

  /*
  constructor (details?: {
    inserted?: $PropertyType<ChangeDetails, 'inserted'>,
    rawInserted?: $PropertyType<ChangeDetails, 'rawInserted'>,
    skip?: $PropertyType<ChangeDetails, 'skip'>,
    tailShift?: $PropertyType<ChangeDetails, 'tailShift'>,
  }) {
*/

  /**
   Aggregate changes
   @returns {ChangeDetails} `this`
   */
  aggregate(details: ChangeDetails): ChangeDetails;

  /** Total offset considering all changes */
  readonly offset: number;
}

export interface MaskedOptions<T extends Mask> {
  mask: T;
  parent: Masked;
  prepare(src: string, masked: Masked<T>, flags: AppendFlags): string;
  validate(src: string, masked: Masked<T>, flags: AppendFlags): boolean;
  commit(src: string, masked: Masked<T>): void;
  format(src: unknown, masked: Masked<T>): string;
  parse(src: string, masked: Masked<T>): unknown;
}

export interface Masked<T extends Mask = any> extends MaskedOptions<T> {
  overwrite?: boolean;
  isInitialized: boolean;

  updateOptions(opts: MaskedOptions<T>): void;
  state: MaskedState;
  reset(): void;
  resolve(value: string): string;
  unmaskedValue: string;
  typedValue: unknown;
  rawInputValue: string;
  readonly isComplete: string;
  nearestInputPos(cursorPos: number, direction?: Direction): number;
  extractInput(fromPos?, toPos?: number, flags?: ExtractFlags): string;
  extractTail(fromPos?: number, toPos?: number): TailDetails;
  appendTail(tail: string | TailDetails): ChangeDetails;
  append(str: string, flags?: AppendFlags, tail?: string | TailDetails): ChangeDetails;
  remove(fromPos?, toPos?: number): ChangeDetails;
  withValueRefresh<U>(fn: () => U): U;
  runIsolated<U>(fn: (masked: any) => U): U;
  doFormat(value: any): any;
  doParse(str: string): string;
  splice(
    start: number,
    deleteCount: number,
    inserted: string,
    removeDirection: Direction
  ): ChangeDetails;
}

export type Mask = string | RegExp | number | Date | unknown[] | Masked['validate'] | Masked;

export type Definitions = Record<string, Mask>;

export interface MaskedPattern extends Masked<string> {
  blocks: Record<string, MaskedOptions<any>>;
  definitions: Definitions;
}

/*
export interface IMaskMixinProps extends Masked {
  /!**
   * events
   *!/
  onAccept: Function;
  oneComplete: Function;

  /!**
   * pattern
   *!/
  placeholderChar: string;
  lazy: boolean;
  definitions: object;
  blocks: object;

  /!**
   * date
   *!/
  pattern: string;
  autofix: boolean;

  /!**
   * number
   *!/
  radix: string;
  thousandSeparator: string;
  mapToRadix: string[];
  scale: number;
  signed: boolean;
  normalizeZeros: boolean;
  min: number | Date;
  max: number | Date;

  /!**
   * dynamic
   *!/
  dispatch: Function;

  /!**
   * ref
   *!/
  inputRef: Function;
}
*/
