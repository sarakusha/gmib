import type { TextFieldProps as MuiTextFieldProps } from '@mui/material/TextField';
import MuiTextField from '@mui/material/TextField';
import type { InputBaseProps } from '@mui/material/InputBase';
import type { FieldProps } from 'formik';
import { getIn } from 'formik';
import React from 'react';

export interface FormikTextFieldProps
  extends FieldProps, Omit<MuiTextFieldProps, 'name' | 'value' | 'error'> {
  inputProps?: InputBaseProps['inputProps'];
}

export function fieldToTextField({
  disabled,
  field: { onBlur: fieldOnBlur, ...field },
  form: { isSubmitting, touched, errors },
  onBlur = e => fieldOnBlur(e ?? field.name),
  helperText,
  inputProps,
  slotProps,
  ...props
}: FormikTextFieldProps): MuiTextFieldProps {
  const fieldError = getIn(errors, field.name);
  const showError = getIn(touched, field.name) && !!fieldError;

  return {
    variant: props.variant,
    error: showError,
    helperText: showError ? fieldError : helperText,
    disabled: disabled ?? isSubmitting,
    slotProps: {
      ...slotProps,
      htmlInput: {
        ...inputProps,
        ...slotProps?.htmlInput,
        autoComplete: 'off',
      },
    },
    onBlur,
    ...field,
    ...props,
  };
}

const FormikTextField: React.FC<FormikTextFieldProps> = ({ children, ...props }) => (
  <MuiTextField {...fieldToTextField(props)}>{children}</MuiTextField>
);

export default FormikTextField;

FormikTextField.displayName = 'FormikMaterialUITextField';
