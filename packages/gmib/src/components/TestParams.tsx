/*
 * @license
 * Copyright (c) 2019. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nata" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import FormControl from '@material-ui/core/FormControl';
import Input from '@material-ui/core/Input';
import InputLabel from '@material-ui/core/InputLabel';
import React, { useCallback } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import { hot } from 'react-hot-loader/root';
import compose from 'recompose/compose';
import produce from 'immer';
import { TestQuery, useTests } from '../providers/TestProvider';

const useStyles = makeStyles(theme => ({
  root: {
    padding: 2 * theme.spacing(1),
  },
  params: {
    display: 'grid',
    gridTemplateColumns: '16ch 16ch',
    gridTemplateRows: 'auto auto auto',
    gridColumnGap: `${3 * theme.spacing(1)}px`,
    gridRowGap: `${4 * theme.spacing(1)}px`,
  },
  formControl: {},
  input: {
    textAlign: 'right',
  },
}));

type ParamProps = {
  id: string;
  name: string;
  value: number;
  min?: number;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
};

const Param: React.FC<ParamProps> = ({
  id, name, value, onChange, min = 2,
}) => {
  const classes = useStyles();
  return (
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
};

type Names = keyof TestQuery;

const TestParams: React.FC = () => {
  const classes = useStyles();
  const { query, setQuery } = useTests();
  const changeHandler = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const name = event.currentTarget.id as Names;
      const value = Number(event.currentTarget.value);
      setQuery(produce(prev => {
        prev[name] = value;
      }));
    },
    [setQuery],
  );
  return (
    <div className={classes.root}>
      <div className={classes.params}>
        <Param
          id="width"
          name="Ширина экрана"
          value={query.width}
          onChange={changeHandler}
        />
        <Param
          id="height"
          name="Высота экрана"
          value={query.height}
          onChange={changeHandler}
        />
        <Param
          id="moduleHres"
          name="Ширина модуля"
          value={query.moduleHres}
          onChange={changeHandler}
        />
        <Param
          id="moduleVres"
          name="Высота модуля"
          value={query.moduleVres}
          onChange={changeHandler}
        />
        <Param
          id="x"
          name="Отступ слева"
          value={query.x}
          onChange={changeHandler}
          min={-65000}
        />
        <Param
          id="y"
          name="Отступ сверху"
          value={query.y}
          onChange={changeHandler}
          min={-65000}
        />
      </div>
    </div>
  );
};

export default compose(
  hot,
  React.memo,
)(TestParams);
