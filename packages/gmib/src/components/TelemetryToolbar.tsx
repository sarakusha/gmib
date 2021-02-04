/*
 * @license
 * Copyright (c) 2021. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import CircularProgress from '@material-ui/core/CircularProgress';
import IconButton from '@material-ui/core/IconButton';
import { makeStyles } from '@material-ui/core/styles';
import Tooltip from '@material-ui/core/Tooltip';
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
import Minihost3SelectorDialog from '../dialogs/Minihost3SelectorDialog';
import { initialSelectors, Minihost3Selector } from '../util/Minihost3Loader';

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
  mib?: string;
  selectors?: Set<Minihost3Selector>;
  onSelectorChanged?: (selectors: Set<Minihost3Selector>) => void;
};

const noop = (): void => {};

const TelemetryToolbar: React.FC<Props> = ({
  start = noop,
  cancel = noop,
  loading = false,
  mib,
  onSelectorChanged = noop,
  selectors = new Set(initialSelectors),
}) => {
  const classes = useStyles();
  const [selectorOpen, setSelectorOpen] = useState(false);
  const openSelectorHandler = useCallback(() => setSelectorOpen(true), []);
  const closeSelectorHandler = (value: Set<Minihost3Selector>): void => {
    onSelectorChanged(value);
    setSelectorOpen(false);
  };
  const FilterIcon = icons[Math.max(selectors.size - 1, 0)];
  return (
    <>
      {mib === 'minihost3' && (
        <Tooltip title="Задать переменные">
          <div className={classes.wrapper}>
            <IconButton color="inherit" onClick={openSelectorHandler}>
              <FilterIcon />
            </IconButton>
          </div>
        </Tooltip>
      )}
      {loading ? (
        <Tooltip title="Отменить опрос">
          <div className={classes.wrapper}>
            <IconButton onClick={cancel} color="inherit">
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
      <Minihost3SelectorDialog
        open={selectorOpen}
        onClose={closeSelectorHandler}
        initial={selectors}
      />
    </>
  );
};

export default React.memo(TelemetryToolbar);
