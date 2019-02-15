import 'material-ui-color-picker';
import React from 'react';
import { TextFieldProps } from '@material-ui/core/TextField';

declare module 'material-ui-color-picker' {
  type Converters = 'rgba' | 'rgb' | 'rgba_rgb' | 'rgba_hex';

  interface Props {
    defaultValue?: string | number;
    onChange?: (value: string) => void;
    convert?: Converters;
    value?: (string | number | boolean)[] | string | number | boolean;
    name?: string;
    id?: string;
    hintText?: string;
    placeholder?: string;
    label?: React.ReactNode;
    floatingLabelText?: string;
    TextFieldProps?: TextFieldProps;
    // showPicker?: boolean;
    // setShowPicker?: (show: boolean) => void;
    // internalValue?: string;
    // setValue?: (value: string) => void;
  }

  export default class ColorPicker extends React.Component<Props> {}
}
