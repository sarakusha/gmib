/*
 * @license
 * Copyright (c) 2019. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nata" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import { FormControl, Input, InputLabel } from '@material-ui/core';
import React, { useCallback } from 'react';
import { withStyles, createStyles, Theme, WithStyles } from '@material-ui/core/styles';
import { hot } from 'react-hot-loader/root';
import compose from 'recompose/compose';
import produce from 'immer';
import { TestQuery, useTests } from '../providers/TestProvider';

const styles = (theme: Theme) => createStyles({
  root: {
    padding: 2 * theme.spacing.unit,
  },
  params: {
    display: 'grid',
    gridTemplateColumns: '16ch 16ch',
    gridTemplateRows: 'auto auto auto',
    gridColumnGap: `${3 * theme.spacing.unit}px`,
    gridRowGap: `${4 * theme.spacing.unit}px`,
  },
  formControl: {},
  input: {
    textAlign: 'right',
  },
});
type Props = {};
type InnerProps = Props & WithStyles<typeof styles>;

type ParamProps = {
  id: string,
  name: string,
  value: number,
  min?: number,
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void,
} & WithStyles<typeof styles>;

const Param = ({ id, name, value, classes, onChange, min = 2 }: ParamProps) => (
  <FormControl className={classes.formControl}>
    <InputLabel htmlFor={id}>{name}</InputLabel>
    <Input
      id={id}
      value={value}
      onChange={onChange}
      type="number"
      inputProps={{
        min,
        step: 2,
      }}
      classes={{ input: classes.input }}
    />
  </FormControl>
);

type Names = keyof TestQuery;

const TestParams: React.FC<InnerProps> = ({ classes }) => {
  const { query, setQuery } = useTests();
  const changeHandler = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const name = event.currentTarget.id as Names;
      const value = Number(event.currentTarget.value);
      setQuery(produce((query) => {
        query[name] = value;
      }));
    },
    [setQuery],
  );
  return (
    <div className={classes.root}>
      <div className={classes.params}>
        <Param
          id="width"
          classes={classes}
          name="Ширина экрана"
          value={query.width}
          onChange={changeHandler}
        />
        <Param
          id="height"
          classes={classes}
          name="Высота экрана"
          value={query.height}
          onChange={changeHandler}
        />
        <Param
          id="moduleHres"
          classes={classes}
          name="Ширина модуля"
          value={query.moduleHres}
          onChange={changeHandler}
        />
        <Param
          id="moduleVres"
          classes={classes}
          name="Высота модуля"
          value={query.moduleVres}
          onChange={changeHandler}
        />
        <Param
          id="x"
          classes={classes}
          name="Отступ слева"
          value={query.x}
          onChange={changeHandler}
          min={-65000}
        />
        <Param
          id="y"
          classes={classes}
          name="Отступ сверху"
          value={query.y}
          onChange={changeHandler}
          min={-65000}
        />
      </div>
    </div>
  );
};

export default compose<InnerProps, Props>(
  hot,
  React.memo,
  withStyles(styles),
)(TestParams);
