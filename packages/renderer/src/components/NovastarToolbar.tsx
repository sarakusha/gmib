import ReloadIcon from '@mui/icons-material/Refresh';
import React from 'react';

import { useSelector } from '../store';
import { selectCurrentDeviceId, selectNovastarIsBusy } from '../store/selectors';

import BusyButton from './BusyButton';

const NovastarToolbar: React.FC = () => {
  const device = useSelector(selectCurrentDeviceId);
  const isBusy = useSelector(selectNovastarIsBusy);
  return (
    <BusyButton
      icon={<ReloadIcon />}
      title="Обновить"
      onClick={() => device && window.novastar.reloadNovastar(device)}
      isBusy={isBusy}
    />
  );
};

export default NovastarToolbar;
