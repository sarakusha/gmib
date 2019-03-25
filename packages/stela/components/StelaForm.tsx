import FormGroup from '@material-ui/core/FormGroup';
import MenuItem from '@material-ui/core/MenuItem';
import { createStyles, Theme, WithStyles, withStyles } from '@material-ui/core/styles';
import classNames from 'classnames';
import { TextAlignProperty } from 'csstype';
import {
  ArrayHelpers,
  Field, FieldArray, Form, FormikProps, withFormik,
} from 'formik';
import { CheckboxWithLabel, TextField } from 'formik-material-ui';
import set from 'lodash/set';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { DragDropContext, Draggable, Droppable, DropResult } from 'react-beautiful-dnd';
import { compose } from 'recompose';
import { IStela } from '../pages/_app';
import { PriceItem, StelaProps, BindFormik } from '../src/stela';
import timeid from '../src/timeid';
import ColorPickerField from './ColorPickerField';
import FormFieldSet from './FormFieldSet';
import LockToolbar from './LockToolbar';
import Section from './Section';
import StelaFormRow from './StelaFormRow';

const styles = (theme: Theme) => createStyles({
  form: {
    maxWidth: 800,
    [theme.breakpoints.up('sm')]: {
      marginRight: theme.spacing.unit * 3,
    },
  },
  textField: {
    marginLeft: theme.spacing.unit,
    // marginRight: theme.spacing.unit,
    flex: 2,
  },

  props: {
    display: 'flex',
    flexDirection: 'column',
    [theme.breakpoints.down('xs')]: {
      paddingLeft: theme.spacing.unit,
      paddingRight: theme.spacing.unit,
    },

  },
  numberField: {
    marginLeft: theme.spacing.unit,
    // marginRight: theme.spacing.unit,
    flex: '0 0 5ch',
    [theme.breakpoints.up('sm')]: {
      flex: '0 0 8ch',
    },
  },
  dragHandle: {
    cursor: 'unset',
    backgroundColor: theme.palette.primary.main,
  },
  dragHandleDragging: {
    backgroundColor: theme.palette.primary.light,
  },
  dragHandleLocked: {
    backgroundColor: theme.palette.primary.light,
  },
  draggingRow: {
    backgroundColor: theme.palette.background.default,
    userSelect: 'none',
  },
  fontName: {
    maxWidth: '20ch',
  },
});

type StylesType = WithStyles<typeof styles>;
type InnerType =
  FormikProps<StelaProps>
  & StylesType & BindFormik;

const rightAlign = {
  textAlign: 'right' as TextAlignProperty,
};

const sizeProps = {
  min: 6,
  style: rightAlign,
};

const dimensionProps = {
  min: 20,
  step: 4,
  style: rightAlign,
};

const lineHeightProps = {
  min: 1,
  step: 0.1,
  style: rightAlign,
};

const paddingProps = {
  min: 0,
  step: 1,
  style: rightAlign,
};

const InnerForm = (props: InnerType) => {
  const {
    values: { items },
    classes,
    submitForm,
    errors,
    bindSubmitForm,
    bindResetForm,
    submittingChanged,
    isSubmitting,
    resetForm,
  } = props;
  useEffect(
    () => {
      bindSubmitForm && bindSubmitForm(submitForm);
      return () => {
        bindSubmitForm && bindSubmitForm(() => {});
      };
    },
    [submitForm, bindSubmitForm],
  );
  useEffect(
    () => {
      submittingChanged && submittingChanged(isSubmitting);
    },
    [submittingChanged, isSubmitting],
  );
  useEffect(
    () => {
      bindResetForm && bindResetForm(resetForm);
      return () => {
        bindResetForm && bindResetForm(() => {});
      };
    },
    [resetForm, bindResetForm],
  );
  const arrayHelpersRef = useRef<ArrayHelpers | null>(null);
  const dragEndMemo = useCallback(
    (result: DropResult) => {
      if (!result.destination || !arrayHelpersRef.current) return;
      arrayHelpersRef.current.move(result.source.index, result.destination.index);
    },
    [arrayHelpersRef],
  );
  const addClick = useCallback(
    () => {
      const item: PriceItem = {
        id: timeid(),
        name: '',
        subName: '',
        price: '',
        isVisible: true,
      };
      arrayHelpersRef.current && arrayHelpersRef.current.push(item);
    },
    [arrayHelpersRef],
  );

  const [locked, setLocked] = useState(true);
  const [settingsExpanded, setSettingsExpanded] = useState(false);

  function handleChange(e: React.ChangeEvent<{}>, isLocked: boolean) {
    setLocked(isLocked);
  }

  function handleSettingsChange(e: React.ChangeEvent<{}>, expanded: boolean) {
    setSettingsExpanded(expanded);
  }

  return (
    <Form noValidate className={classes.form} autoComplete="off">
      <Section
        title={(<LockToolbar
          title={'Прайс-лист'}
          onChange={handleChange}
          checked={locked}
          onAdd={addClick}
        />)}
        defaultExpanded={true}
        className={classes.props}
        // actions={<AddAction onClick={addClick} />}
      >
        <FormFieldSet fullWidth={true}>
          <FieldArray name="items">
            {(arrayHelpers) => {
              arrayHelpersRef.current = arrayHelpers;
              return (
                <DragDropContext onDragEnd={dragEndMemo}>
                  <Droppable droppableId="droppable">
                    {provided => (
                      <div
                        ref={provided.innerRef}
                      >
                        {items.map((item, index) => (
                          <Draggable
                            draggableId={item.id || `${index}`}
                            index={index}
                            key={item.id}
                            isDragDisabled={locked}
                          >
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className={classNames(
                                  { [classes.draggingRow]: snapshot.isDragging },
                                )}
                              >
                                <StelaFormRow
                                  item={item}
                                  index={index}
                                  classes={classes}
                                  handleProps={provided.dragHandleProps}
                                  errors={errors.items && errors.items[index] as Partial<PriceItem>}
                                  locked={locked}
                                  isDragging={snapshot.isDragging}
                                  remove={arrayHelpers.handleRemove(index)}
                                />
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
              );
            }}
          </FieldArray>
        </FormFieldSet>
      </Section>
      <Section
        title={'Настройки'}
        className={classes.props}
        disabled={locked}
        onChange={handleSettingsChange}
        expanded={settingsExpanded && !locked}
      >
        <FormFieldSet margin="none" legend={'Шрифт'}>
          <FormGroup row={true}>
            <Field
              name="isBold"
              // type="checkbox"
              Label={{
                label: 'Жирный',
                className: classes.textField,
              }}
              component={CheckboxWithLabel}
            />
            <Field
              name="isCondensed"
              Label={{
                label: 'Уплотненный',
                className: classes.textField,
              }}
              component={CheckboxWithLabel}
            />
            <Field
              name="lineHeight"
              type="number"
              label="Высота"
              component={TextField}
              className={classes.numberField}
              inputProps={lineHeightProps}
            />
          </FormGroup>
          <Field
            name="fontName"
            type="text"
            label="Имя"
            select
            title="Гарнитура"
            component={TextField}
            className={classes.fontName}
            InputLabelProps={{ shrink: true }}
          >
            <MenuItem value="Ubuntu">Ubuntu</MenuItem>
            <MenuItem value="LCDnova">LCD</MenuItem>
          </Field>
        </FormFieldSet>
        <FormFieldSet margin="normal" legend={'Заголовок'} fullWidth={false}>
          <FormGroup row={true}>
            <Field
              name="titleColor"
              label="Цвет"
              component={ColorPickerField}
            />
            <Field
              name="titleSize"
              type="number"
              label="Размер"
              component={TextField}
              className={classes.numberField}
              inputProps={sizeProps}
            />
            <Field
              name="title"
              type="text"
              label="Имя"
              component={TextField}
              className={classes.textField}
            />
          </FormGroup>
        </FormFieldSet>
        <FormFieldSet margin="normal" legend={'Марка'} fullWidth={false}>
          <FormGroup row={true}>
            <Field
              name="nameColor"
              type="text"
              label="Цвет"
              component={ColorPickerField}
            />
            <Field
              name="nameSize"
              type="number"
              label="Размер"
              component={TextField}
              className={classes.numberField}
              inputProps={sizeProps}
            />
          </FormGroup>
        </FormFieldSet>
        <FormFieldSet margin="normal" legend={'Бренд'}>
          <FormGroup row={true}>
            <Field
              name="subColor"
              type="text"
              label="Цвет"
              component={ColorPickerField}
            />
            <Field
              name="subSize"
              type="number"
              label="Размер"
              component={TextField}
              className={classes.numberField}
              inputProps={sizeProps}
            />
          </FormGroup>
        </FormFieldSet>
        <FormFieldSet margin="normal" legend={'Цена'}>
          <FormGroup row={true}>
            <Field
              name="priceColor"
              type="text"
              label="Цвет"
              component={ColorPickerField}
            />
            <Field
              name="priceSize"
              type="number"
              label="Размер"
              component={TextField}
              className={classes.numberField}
              inputProps={sizeProps}
            />
          </FormGroup>
        </FormFieldSet>
        <FormFieldSet legend={'Размер'}>
          <FormGroup row>
            <Field
              name="width"
              type="number"
              label="Ширина"
              component={TextField}
              className={classes.numberField}
              inputProps={dimensionProps}
            />
            <Field
              name="height"
              type="number"
              label="Высота"
              component={TextField}
              className={classes.numberField}
              inputProps={dimensionProps}
            />
            <Field
              name="paddingTop"
              type="number"
              label="Отступ"
              title="Отступ сверху"
              component={TextField}
              className={classes.numberField}
              inputProps={paddingProps}
            />
          </FormGroup>
        </FormFieldSet>
      </Section>
    </Form>
  );
};

export default compose<InnerType, IStela & BindFormik>(
  withStyles(styles),
  withFormik<IStela & StylesType, StelaProps>({
    validateOnChange: true,
    enableReinitialize: true,
    mapPropsToValues: ({ update, classes, items, ...props }) => ({
      ...props,
      items: items.map(({ name, subName, price, ...other }) => ({
        name: name || '',
        subName: subName || '',
        price: typeof price === 'number' ? price.toFixed(2) : price || '',
        ...other,
      })),
    }),
    handleSubmit: (values, { props: { update }, setSubmitting }) => {
      update(values);
      setSubmitting(false);
    },
    validate: (values) => {
      const errors: any = {};
      const { items } = values;
      items.forEach(({ name, price }, index) => {
        if (name.trim().length === 0) {
          set(errors, `items[${index}].name`, `required${index}`);
        }
        const num = Number(price);
        if (price !== '' && (Number.isNaN(num) || num === 0)) {
          set(errors, `items[${index}].price`, 'must be a number');
          // errors[`items[${index}].price`] = 'MUST BE A NUMBER';
        }
      });
      // Object.keys(errors).length > 0 && console.log(errors);
      return errors;
    },
  }),
  // React.memo,
)(InnerForm);
