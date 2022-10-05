import AddCircleOutlinedIcon from '@mui/icons-material/AddCircleOutlined';
import CachedIcon from '@mui/icons-material/Cached';
import FeaturedVideoOutlinedIcon from '@mui/icons-material/FeaturedVideoOutlined';
import LocationSearchingIcon from '@mui/icons-material/LocationSearching';
import SmartDisplayOutlinedIcon from '@mui/icons-material/SmartDisplayOutlined';
import { IconButton } from '@mui/material';
import type { IconButtonProps } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useSnackbar } from 'notistack';
import React from 'react';
// import FeaturedVideoIcon from '@mui/icons-material/FeaturedVideo';

import { useDisplay } from '../../common/displays';
import { useCreatePlayerMutation } from '../api/player';
import usePlayerMappingDialog from '../hooks/usePlayerMappingDialog';
import { useDispatch } from '../store';
import { setSettingsNode } from '../store/currentSlice';

import Toolbar from './StyledToolbar';

type Props = {
  group?: string;
  id?: number;
  size?: IconButtonProps['size'];
};

const AddOverlappedIcon = styled(AddCircleOutlinedIcon)(({ theme }) => ({
  position: 'absolute',
  left: '55%',
  top: '50%',
  fontSize: '60%',
  backgroundColor: theme.palette.primary.main,
  borderRadius: '50%',
}));

const SettingsToolbar: React.FC<Props> = ({ size, group, id }) => {
  const { display = null, refetch } = useDisplay(group === 'displays' ? id : undefined);
  const [highlight, setHighlight] = React.useState<Window | null>();
  const [createPlayer] = useCreatePlayerMutation();
  const { closeSnackbar, enqueueSnackbar } = useSnackbar();
  const dispatch = useDispatch();
  const createPlayerHandler = () => {
    createPlayer({})
      .unwrap()
      .then(player => {
        if (player) setTimeout(() => dispatch(setSettingsNode(`players:${player.id}`)), 0);
      })
      .catch(err => {
        enqueueSnackbar(`Не удалось создать плеер: ${err.message}`, {
          variant: 'error',
          preventDuplicate: true,
          autoHideDuration: 3000,
          onClose: () => closeSnackbar(),
        });
      });
  };
  const highlightDisplay = () => {
    if (highlight && !highlight.closed) highlight.close();
    else if (display) {
      const win = window.open(
        `/output/display.html?width=${display.bounds.width}&height=${display.bounds.height}&display=${id}&transparent=1&kiosk=0`,
      );
      setTimeout(() => {
        if (win && !win.closed) win.close();
      }, 5000);
      setHighlight(win);
    }
  };
  const openPlayerMappingDialog = usePlayerMappingDialog();
  return (
    <Toolbar>
      {group === 'players' && (
        <>
          <IconButton
            color="inherit"
            size={size}
            title="Добавить область вывода"
            disabled={!id}
            onClick={() => id && openPlayerMappingDialog(id)}
          >
            <FeaturedVideoOutlinedIcon fontSize="inherit" />
            <AddOverlappedIcon />
          </IconButton>
          <IconButton
            color="inherit"
            size={size}
            title="Создать новый плеер"
            onClick={createPlayerHandler}
          >
            <SmartDisplayOutlinedIcon fontSize="inherit" />
            <AddOverlappedIcon />
          </IconButton>
        </>
      )}
      {group === 'displays' && (
        <>
          <IconButton
            color="inherit"
            size={size}
            title="Определить дисплей"
            onClick={highlightDisplay}
            disabled={!id}
          >
            <LocationSearchingIcon />
          </IconButton>
          <IconButton color="inherit" size={size} title="Обновить" onClick={refetch}>
            <CachedIcon fontSize="inherit" />
          </IconButton>
        </>
      )}
    </Toolbar>
  );
};

export default SettingsToolbar;
