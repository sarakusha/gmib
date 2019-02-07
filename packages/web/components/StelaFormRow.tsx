import React, { useMemo } from 'react';
import FormGroup from '@material-ui/core/FormGroup';
import Avatar from '@material-ui/core/Avatar';
import IconButton from '@material-ui/core/IconButton';
import ClearIcon from '@material-ui/icons/Clear';
import classNames from 'classnames';
import { Field } from 'formik';
import { Checkbox, TextField } from 'formik-material-ui';
import { DraggableProvidedDragHandleProps } from 'react-beautiful-dnd';
import { PriceItem } from '../src/stela';
import CurrencyField from './CurrencyField';
import FormFieldSet from './FormFieldSet';

interface RowProps {
  item: PriceItem;
  index: number;
  handleProps: DraggableProvidedDragHandleProps;
  errors: Partial<PriceItem>;
  locked?: boolean;
  isDragging?: boolean;
  remove: () => void;
  classes: any;
}

const StelaFormRow = (
  {
    item: { id },
    index,
    handleProps,
    classes,
    errors = {},
    locked,
    isDragging,
    remove,
  }: RowProps) => {
  const lockedInput = useMemo(
    () => (locked
      ? {
        readOnly: true,
        inputProps: {
          tabIndex: -1,
          readOnly: true,
        },
      }
      : {}),
    [locked],
  );
  return (
    <FormFieldSet
      margin={'dense'}
      fullWidth={true}
      key={id || index}
    >
      <FormGroup row={true}>
        <Avatar
          {...handleProps}
          className={classNames(
            classes.dragHandle,
            { [classes.dragHandleDragging]: isDragging },
            { [classes.dragHandleLocked]: locked },
          )}
          tabIndex={locked ? -1 : 0}
        >
          {index + 1}
        </Avatar>
        <Field
          name={`items[${index}].isVisible`}
          component={Checkbox}
          title="Вывести на экран"
          disabled={locked}
        />
        <Field
          name={`items[${index}].name`}
          type="text"
          label="Марка"
          component={TextField}
          className={classes.textField}
          InputProps={lockedInput}
        />
        <Field
          name={`items[${index}].subName`}
          type="text"
          label="Бренд"
          component={TextField}
          className={classes.textField}
          InputProps={lockedInput}
        />
        <Field
          error={errors.price}
          name={`items[${index}].price`}
          type="text"
          label="Цена"
          component={CurrencyField}
          className={classes.numberField}
        />
        <IconButton disabled={locked} onClick={remove}>
          <ClearIcon fontSize="small" />
        </IconButton>
      </FormGroup>
    </FormFieldSet>
  );
};

export default React.memo(StelaFormRow);
