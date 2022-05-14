
import type {
  FormControlProps,
  FormLabelProps} from '@mui/material';
import {
  FormControl,
  FormHelperText,
  FormLabel,
} from '@mui/material';
import React from 'react';

export interface FormFieldSetProps extends FormControlProps {
  legend?: string;
  // form?: string;
  // title?: string;
  helper?: string;
  radio?: boolean;
}

export const FormLegend: React.FC<FormLabelProps> = props => (
  <FormLabel {...props} component={'legend' as 'label'} />
);

const FormFieldSet: React.FC<FormFieldSetProps> = ({
  legend,
  helper,
  children,
  className,
  ...props
}) => (
  <FormControl component={'fieldset' as 'div'} {...props} className={className}>
    {legend && <FormLegend>{legend}</FormLegend>}
    <div>{children}</div>
    {helper && <FormHelperText>{helper}</FormHelperText>}
  </FormControl>
);

export default FormFieldSet;
