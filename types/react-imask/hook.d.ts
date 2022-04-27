import IMask from 'imask';
import { Dispatch } from 'react';
import type { MutableRefObject } from 'react';
import type { ReactMaskProps, Falsy, ReactElement } from './mixin';
export default function useIMask<Opts extends IMask.AnyMaskedOptions = IMask.AnyMaskedOptions, Unmask extends ('typed' | boolean) = false, Value = Unmask extends 'typed' ? IMask.InputMask<Opts>['typedValue'] : Unmask extends Falsy ? IMask.InputMask<Opts>['value'] : IMask.InputMask<Opts>['unmaskedValue'], MaskElement extends ReactElement = ReactElement>(opts: Opts, { onAccept, onComplete }?: Pick<ReactMaskProps<Opts, Unmask, Value, MaskElement>, 'onAccept' | 'onComplete'>): {
    ref: MutableRefObject<MaskElement>;
    maskRef: MutableRefObject<IMask.InputMask<Opts>>;
    value: IMask.InputMask<Opts>['value'];
    setValue: Dispatch<IMask.InputMask<Opts>['value']>;
    unmaskedValue: IMask.InputMask<Opts>['unmaskedValue'];
    setUnmaskedValue: Dispatch<IMask.InputMask<Opts>['unmaskedValue']>;
    typedValue: IMask.InputMask<Opts>['typedValue'];
    setTypedValue: Dispatch<IMask.InputMask<Opts>['typedValue']>;
};
