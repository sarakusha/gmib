import ReloadIcon from '@mui/icons-material/Refresh';
import React from 'react';

import { useNovastar, useReloadMutation} from '../api/novastar';
import { useSelector } from '../store';
import { selectCurrentDeviceId } from '../store/selectors';

import BusyButton from './BusyButton';

const NovastarToolbar: React.FC = () => {
  const path = useSelector(selectCurrentDeviceId);
  const { novastar } = useNovastar(path);
  const [reload] = useReloadMutation();
  return (
    <BusyButton
      icon={<ReloadIcon />}
      title="Обновить"
      onClick={() => path && reload(path)}
      isBusy={novastar && novastar.isBusy}
      disabled={!novastar || !novastar.connected || novastar.isBusy}
    />
  );
};

export default NovastarToolbar;
