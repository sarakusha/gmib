/*
 * @license
 * Copyright (c) 2022. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */
import ReloadIcon from '@mui/icons-material/Refresh';
import React from 'react';
import { useDispatch, useSelector } from '../store';
import { selectCurrentDeviceId, selectNovastarIsBusy } from '../store/currentSlice';
import { reloadNovastar } from '../store/novastarsSlice';
import BusyButton from './BusyButton';

const NovastarToolbar: React.FC = () => {
  const dispatch = useDispatch();
  const device = useSelector(selectCurrentDeviceId);
  const isBusy = useSelector(selectNovastarIsBusy);
  return (
    <BusyButton
      icon={<ReloadIcon />}
      title="Обновить"
      onClick={() => device && dispatch(reloadNovastar(device))}
      isBusy={isBusy}
    />
  );
};

export default NovastarToolbar;
