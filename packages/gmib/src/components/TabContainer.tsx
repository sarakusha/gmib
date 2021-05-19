/*
 * @license
 * Copyright (c) 2021. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import { DeviceId } from '@nibus/core';
import React from 'react';
import { makeStyles } from '@material-ui/core/styles';
import classNames from 'classnames';

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
  id: string;
  selected?: boolean;
};

export type MinihostTabProps = {
  id: DeviceId;
  selected?: boolean;
};

const TabContainer: React.FC<Props> = ({ id, children, selected = true }) => {
  const classes = useStyles();
  return (
    <div
      id={`tabpanel-${id}`}
      aria-labelledby={`tab-${id}`}
      hidden={!selected}
      className={classNames(classes.root, { [classes.hidden]: !selected })}
    >
      {children}
    </div>
  );
};

export default TabContainer;
