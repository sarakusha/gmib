import ReloadIcon from '@mui/icons-material/Refresh';
import React from 'react';

import { useSelector } from '../store';
import { selectCurrentDeviceId, selectNovastarByPath } from '../store/selectors';

import BusyButton from './BusyButton';

const NovastarToolbar: React.FC = () => {
  const path = useSelector(selectCurrentDeviceId);
  const device = useSelector(state =>
    path != null ? selectNovastarByPath(state, path) : undefined,
  );
  return (
    <BusyButton
      icon={<ReloadIcon />}
      title="Обновить"
      onClick={() => path && window.novastar.reload(path)}
      isBusy={device && device.isBusy > 0}
      disabled={!device || !device.connected}
    />
  );
};

export default NovastarToolbar;
