import React from 'react';
import FormControl, { FormControlProps } from '@material-ui/core/FormControl';
import FormLabel, { FormLabelProps } from '@material-ui/core/FormLabel';

export interface FormFieldSetProps extends FormControlProps {
  legend?: string;
  form?: string;
  title?: string;
}

export const FormLegend = (props: FormLabelProps) =>
  <FormLabel {...props} component={'legend' as 'label'} />;

const FormFieldSet = ({ legend, children, title, ...props }: FormFieldSetProps) => (
  <FormControl component={'fieldset' as 'div'} {...props} title={title || legend}>
    {legend && <FormLegend>{legend}</FormLegend>}
    {children}
  </FormControl>
);

export default FormFieldSet;
