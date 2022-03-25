/*
 * @license
 * Copyright (c) 2022. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */
import { CircularProgress, IconButton, Tooltip } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import ReloadIcon from '@material-ui/icons/Refresh';
import React from 'react';
import { useDispatch, useSelector } from '../store';
import { selectCurrentDeviceId, selectNovastarIsBusy } from '../store/currentSlice';
import { reloadNovastar } from '../store/novastarsSlice';

const useStyles = makeStyles(theme => ({
  toolbarWrapper: {
    position: 'relative',
  },
  fabProgress: {
    color: theme.palette.secondary.light,
    position: 'absolute',
    pointerEvents: 'none',
    top: 0,
    left: 0,
    zIndex: 1,
  },
}));

const NovastarToolbar: React.FC = () => {
  const dispatch = useDispatch();
  const device = useSelector(selectCurrentDeviceId);
  const isBusy = useSelector(selectNovastarIsBusy);
  const classes = useStyles();
  return (
    <Tooltip title="Обновить">
      <div className={classes.toolbarWrapper}>
        <IconButton
          color="inherit"
          onClick={() => device && dispatch(reloadNovastar(device))}
          disabled={isBusy}
        >
          <ReloadIcon />
        </IconButton>
        {isBusy && <CircularProgress size={48} className={classes.fabProgress} />}
      </div>
    </Tooltip>
  );
};

export default NovastarToolbar;
