/*
 * @license
 * Copyright (c) 2019. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nata" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import React from 'react';
import FormControl, { FormControlProps } from '@material-ui/core/FormControl';
import FormLabel, { FormLabelProps } from '@material-ui/core/FormLabel';

export interface FormFieldSetProps extends FormControlProps {
  legend?: string;
  // form?: string;
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
