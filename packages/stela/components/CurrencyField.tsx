import { TextAlignProperty } from 'csstype';
import React, { useCallback } from 'react';
import MuiTextField from '@material-ui/core/TextField';
import { fieldToTextField, TextFieldProps } from 'formik-material-ui';

const inputProps = {
  step: 0.1,
  min: 0.1,
  style: {
    textAlign: 'right' as TextAlignProperty,
  },
};

const CurrencyField = (props: TextFieldProps & { error?: string }) => {
  const { form: { setFieldValue }, field: { name }, error } = props;
  const format = useCallback(
    ({ target: { value } }: React.FocusEvent<any>) => {
      const numValue = Number(value);
      setFieldValue(
        name,
        Number.isNaN(numValue) || value.trim().length === 0
          ? value
          : numValue.toFixed(2),
      );
    },
    [setFieldValue, name],
  );
  return (
    <MuiTextField
      {...fieldToTextField(props)}
      onBlur={format}
      type={'number'}
      error={!!error}
      helperText={error}
      inputProps={inputProps}
    />
  );
};

export default React.memo(CurrencyField);
