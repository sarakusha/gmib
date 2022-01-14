/*
 * @license
 * Copyright (c) 2022. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import {
  FormHelperText,
  FormControl,
  FormLabel,
  FormControlProps,
  FormLabelProps,
} from '@material-ui/core';
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
