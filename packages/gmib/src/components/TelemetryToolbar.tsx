/*
 * @license
 * Copyright (c) 2022. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import { makeStyles } from '@material-ui/core/styles';
import { CircularProgress, IconButton, Tooltip } from '@material-ui/core';
import CancelIcon from '@material-ui/icons/Cancel';
import Filter1 from '@material-ui/icons/Filter1';
import Filter2 from '@material-ui/icons/Filter2';
import Filter3 from '@material-ui/icons/Filter3';
import Filter4 from '@material-ui/icons/Filter4';
import Filter5 from '@material-ui/icons/Filter5';
import Filter6 from '@material-ui/icons/Filter6';
import Filter7 from '@material-ui/icons/Filter7';
import StartIcon from '@material-ui/icons/Refresh';
import React, { useCallback, useState } from 'react';
import PropertySelectorDialog, { getEnumValues } from '../dialogs/PropertySelectorDialog';
import { noop } from '../util/helpers';

const useStyles = makeStyles(theme => ({
  fabProgress: {
    color: theme.palette.secondary.light,
    position: 'absolute',
    pointerEvents: 'none',
    top: 0,
    left: 0,
    zIndex: 1,
  },
  wrapper: {
    position: 'relative',
  },
}));

const icons = [Filter1, Filter2, Filter3, Filter4, Filter5, Filter6, Filter7] as const;

type Props = {
  start?: () => void;
  cancel?: () => void;
  loading?: boolean;
  isBusy?: boolean;
  selectors?: Set<number>;
  onSelectorChanged?: (selectors: Set<number>) => void;
  properties?: Record<string, number | string>;
};

const TelemetryToolbar: React.FC<Props> = ({
  start = noop,
  cancel = noop,
  loading = false,
  onSelectorChanged = noop,
  isBusy = 0,
  properties,
  selectors = new Set(properties && getEnumValues(properties)),
}) => {
  const classes = useStyles();
  const [selectorOpen, setSelectorOpen] = useState(false);
  const openSelectorHandler = useCallback(() => setSelectorOpen(true), []);
  const closeSelectorHandler = (value: Set<number>): void => {
    onSelectorChanged(value);
    setSelectorOpen(false);
  };
  const FilterIcon = icons[Math.max(selectors.size - 1, 0)];
  return (
    <>
      {properties && (
        <Tooltip title="Задать переменные">
          <div className={classes.wrapper}>
            <IconButton color="inherit" onClick={openSelectorHandler}>
              <FilterIcon />
            </IconButton>
          </div>
        </Tooltip>
      )}
      {loading || isBusy ? (
        <Tooltip title={loading && 'Отменить опрос'}>
          <div className={classes.wrapper}>
            <IconButton onClick={cancel} color="inherit" disabled={!loading}>
              <CancelIcon />
            </IconButton>
            <CircularProgress size={48} className={classes.fabProgress} />
          </div>
        </Tooltip>
      ) : (
        <Tooltip title="Запустить опрос модулей" enterDelay={500}>
          <div className={classes.wrapper}>
            <IconButton onClick={start} color="inherit">
              <StartIcon />
            </IconButton>
          </div>
        </Tooltip>
      )}
      {properties && (
        <PropertySelectorDialog
          properties={properties}
          open={selectorOpen}
          onClose={closeSelectorHandler}
          initial={selectors}
        />
      )}
    </>
  );
};

export default React.memo(TelemetryToolbar);
