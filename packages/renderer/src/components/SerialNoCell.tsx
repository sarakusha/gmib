
import debounce from 'lodash/debounce';
import React, { useCallback, useEffect, useMemo, useState } from 'react';


import type { ExtendedProps } from './StyledInput';
import StyledInput from './StyledInput';
import type { TableCellProps } from './TableCell';
import TableCell from './TableCell';

import { IMaskMixin } from 'react-imask';

// const useStyles = makeStyles(_theme => ({
//   inputDirty: {
//     fontWeight: 'bold',
//   },
//   inputRoot: {
//     fontSize: 'inherit',
//     width: '100%',
//   },
//   inputRight: {
//     textAlign: 'right',
//   },
//   inputCenter: {
//     textAlign: 'center',
//   },
// }));

type Props = {
  name: string;
  value: string;
  dirty?: boolean;
  onChangeProperty?: (name: string, value: unknown) => void;
} & TableCellProps;
const formatChars = {
  X: /[0-9a-fA-F]/,
  O: /0/,
};
const isEmpty = (value: string): boolean => !value || value.replace(/0/g, '') === '';

const MaskedInput = IMaskMixin<IMask.AnyMaskedOptions & ExtendedProps>(({ inputRef, ...props }) => (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  <StyledInput inputRef={inputRef} fullWidth disableUnderline {...(props as any[])} />
));

const toUpper = (str: string): string => str.toUpperCase();

const SerialNoCell: React.FC<Props> = ({
  value: initValue,
  name,
  className,
  onChangeProperty = () => {},
  dirty,
  align,
  ...props
}) => {
  const [value, setValue] = useState(initValue);
  useEffect(() => setValue(initValue), [initValue]);
  const [changing, setChanging] = useState(false);
  const updateValue = useMemo(
    () =>
      debounce((key: string, val: string) => {
        if (!isEmpty(val)) {
          onChangeProperty(key, val);
          setChanging(false);
        }
      }, 5000),
    [onChangeProperty],
  );
  const changeHandler = useCallback(
    (_, { unmaskedValue }) => {
      setValue(prev => {
        const newValue = unmaskedValue.padStart(16, '0');
        if (newValue !== prev) {
          setChanging(true);
          updateValue(name, newValue);
        }
        return newValue;
      });
    },
    [name, updateValue],
  );
  return (
    <TableCell className={className} align={align} {...props}>
      <MaskedInput
        onAccept={changeHandler}
        value={value.slice(-12).padStart(12, '0')}
        dirty={dirty || changing}
        mask="XX:XX:XX:XX:XX:XX"
        definitions={formatChars}
        overwrite
        lazy={false}
        autofix
        placeholderChar="0"
        prepare={toUpper}
        align={align}
      />
    </TableCell>
  );
};

export default React.memo(SerialNoCell);
