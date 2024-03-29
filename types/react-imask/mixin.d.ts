import type React from 'react';
import type IMask from 'imask';

export declare type Falsy = false | 0 | '' | null | undefined;
export declare type ReactElement = IMask.MaskElement | HTMLTextAreaElement | HTMLInputElement;
export declare type ReactElementProps<MaskElement extends ReactElement = ReactElement> =
  React.HTMLProps<MaskElement>;
export declare type ReactMaskProps<
  Opts extends IMask.AnyMaskedOptions = IMask.AnyMaskedOptions,
  Unmask extends 'typed' | boolean = false,
  Value = Unmask extends 'typed'
    ? IMask.InputMask<Opts>['typedValue']
    : Unmask extends Falsy
    ? IMask.InputMask<Opts>['value']
    : IMask.InputMask<Opts>['unmaskedValue'],
  MaskElement extends ReactElement = ReactElement,
> = {
  onAccept?: (value: Value, maskRef: IMask.InputMask<Opts>, e?: InputEvent) => void;
  onComplete?: (value: Value, maskRef: IMask.InputMask<Opts>, e?: InputEvent) => void;
  unmask?: Unmask;
  value?: Value;
  inputRef?: React.RefCallback<MaskElement>;
  ref?: React.Ref<React.ComponentType<IMaskInputProps<Opts, Unmask, Value, MaskElement>>>;
};
export declare type ReactMixinComponent<MaskElement extends ReactElement = ReactElement> =
  React.ComponentType<
    ReactElementProps<MaskElement> & {
      inputRef: React.RefCallback<MaskElement>;
    }
  >;
export declare type IMaskMixinProps<
  Opts extends IMask.AnyMaskedOptions = IMask.AnyMaskedOptions,
  Unmask extends 'typed' | boolean = false,
  Value = Unmask extends 'typed'
    ? IMask.InputMask<Opts>['typedValue']
    : Unmask extends Falsy
    ? IMask.InputMask<Opts>['value']
    : IMask.InputMask<Opts>['unmaskedValue'],
  MaskElement extends ReactElement = ReactElement,
> = Opts & ReactMaskProps<Opts, Unmask, Value, MaskElement>;
export declare type IMaskInputProps<
  Opts extends IMask.AnyMaskedOptions = IMask.AnyMaskedOptions,
  Unmask extends 'typed' | boolean = false,
  Value = Unmask extends 'typed'
    ? IMask.InputMask<Opts>['typedValue']
    : Unmask extends Falsy
    ? IMask.InputMask<Opts>['value']
    : IMask.InputMask<Opts>['unmaskedValue'],
  MaskElement extends ReactElement = ReactElement,
> = ReactElementProps<MaskElement> & IMaskMixinProps<Opts, Unmask, Value, MaskElement>;
export default function IMaskMixin<
  Opts extends IMask.AnyMaskedOptions = IMask.AnyMaskedOptions,
  Unmask extends 'typed' | boolean = false,
  Value = Unmask extends 'typed'
    ? IMask.InputMask<Opts>['typedValue']
    : Unmask extends Falsy
    ? IMask.InputMask<Opts>['value']
    : IMask.InputMask<Opts>['unmaskedValue'],
  MaskElement extends ReactElement = ReactElement,
>(
  ComposedComponent: ReactMixinComponent<MaskElement>,
): React.ComponentType<IMaskInputProps<Opts, Unmask, Value, MaskElement>>;
