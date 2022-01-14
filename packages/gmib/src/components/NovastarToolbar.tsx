/*
 * @license
 * Copyright (c) 2021. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */
import { IconButton, Tooltip } from '@material-ui/core';
import ReloadIcon from '@material-ui/icons/Refresh';
import React from 'react';
import { useDispatch, useSelector } from '../store';
import { selectCurrentDeviceId } from '../store/currentSlice';
import { reloadNovastar } from '../store/novastarsSlice';

const NovastarToolbar: React.FC = () => {
  const dispatch = useDispatch();
  const device = useSelector(selectCurrentDeviceId);
  return (
    <Tooltip title="Обновить">
        <IconButton color="inherit" onClick={() => device && dispatch(reloadNovastar(device))}>
          <ReloadIcon />
        </IconButton>
      </Tooltip>
  );
};

export default NovastarToolbar;
