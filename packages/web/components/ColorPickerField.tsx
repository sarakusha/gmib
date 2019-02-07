import React from 'react';
import { fieldToTextField, TextFieldProps } from 'formik-material-ui';
import ColorPicker from 'material-ui-color-picker';

const ColorPickerField = (props: TextFieldProps) => {
  const { form: { setFieldValue }, field: { name, value } } = props;
  const changed = React.useCallback(
    (color) => {
      setFieldValue(name, color || '#fff');
    },
    [setFieldValue, name],
  );
  const textFieldProps = React.useMemo(
    () => ({
      autoComplete: 'off',
      InputProps: {
        disableUnderline: true,
        style: {
          backgroundColor: 'black',
          borderRadius: 8,
          color: value,
          paddingLeft: 5,
          width: '12ch',
        },
      },
    }),
    [value],
  );
  return (
    <ColorPicker
      {...fieldToTextField(props)}
      TextFieldProps={textFieldProps}
      onChange={changed}
    />
  );
};

export default React.memo(ColorPickerField);
