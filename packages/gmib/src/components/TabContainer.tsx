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
import { makeStyles } from '@material-ui/core/styles';
import classNames from 'classnames';
import { hot } from 'react-hot-loader/root';
import compose from 'recompose/compose';

const useStyles = makeStyles({
  root: {
    width: '100%',
    display: 'flex',
  },
  hidden: {
    display: 'none',
  },
});

export type Props = {
  children?: React.ReactNode;
  value: number | string;
  selected?: boolean;
};

const TabContainer: React.FC<Props> = ({ children, selected = true }) => {
  const classes = useStyles();
  return (
    <div className={classNames(classes.root, { [classes.hidden]: !selected })}>
      {children}
    </div>
  );
};

export default compose<Props, Props>(
  hot,
  React.memo,
)(TabContainer);
