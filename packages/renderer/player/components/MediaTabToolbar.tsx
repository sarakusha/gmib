import Tooltip from '@mui/material/Tooltip';
import React from 'react';
import SortIcon from '@mui/icons-material/Sort';
import MenuItem from '@mui/material/MenuItem';
import Menu from '@mui/material/Menu';
import SortByAlphaIcon from '@mui/icons-material/SortByAlpha';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import TimelapseIcon from '@mui/icons-material/Timelapse';
import StraightenIcon from '@mui/icons-material/Straighten';
import ListItemText from '@mui/material/ListItemText';
import ListItemIcon from '@mui/material/ListItemIcon';
import type { IconButtonProps } from '@mui/material';
import { Box, Divider, IconButton } from '@mui/material';
import Check from '@mui/icons-material/Check';
import CachedIcon from '@mui/icons-material/Cached';

import UploadButton from './UploadButton';
import Search from './Search';
import Toolbar from './StyledToolbar';

import { useGetMedia, useUploadMediaMutation } from '../api/media';
import { useDispatch, useSelector } from '../store';
import { selectDescending, selectSearch, selectSortOrder } from '../store/selectors';
import { setDescending, setSearch, setSortOrder } from '../store/currentSlice';

import type { SortOrder } from '/@common/mediaInfo';

type Props = {
  // upload?: (files: FileList | null) => void;
  size?: IconButtonProps['size'];
};

const MediaTabToolbar: React.FC<Props> = ({ size }) => {
  const [upload] = useUploadMediaMutation();
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const handleClose = () => setAnchorEl(null);
  const handleMenu: React.MouseEventHandler<HTMLElement> = e => setAnchorEl(e.currentTarget);
  const sortOrder = useSelector(selectSortOrder);
  const descending = useSelector(selectDescending);
  const search = useSelector(selectSearch);
  const dispatch = useDispatch();
  const handleMenuItem = (order: SortOrder) => () => {
    handleClose();
    dispatch(setSortOrder(order));
  };
  const toggleDescending = () => {
    handleClose();
    dispatch(setDescending(!descending));
  };
  const handleChangeSearch: React.ChangeEventHandler<HTMLInputElement> = e => {
    dispatch(setSearch(e.target.value.toLocaleLowerCase()));
  };
  const { refetch } = useGetMedia();
  return (
    <Toolbar>
      <Tooltip title="Загрузить медиа">
        <div>
          <UploadButton
            size={size}
            onChange={event => event.target.files && upload(event.target.files)}
          />
        </div>
      </Tooltip>
      <Tooltip title="Сортировка">
        <IconButton size={size} color="inherit" onClick={handleMenu}>
          <SortIcon fontSize="inherit" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Обновить">
        <IconButton size={size} color="inherit" onClick={refetch}>
          <CachedIcon fontSize="inherit" />
        </IconButton>
      </Tooltip>
      <Box flex="1" />
      <Search value={search} onChange={handleChangeSearch} />
      <Menu
        id="menu-sort-item"
        anchorEl={anchorEl}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
        keepMounted
        transformOrigin={{
          vertical: 'top',
          horizontal: 'left',
        }}
        open={!!anchorEl}
        onClose={handleClose}
      >
        <MenuItem onClick={handleMenuItem('filename')} selected={sortOrder === 'filename'}>
          <ListItemIcon>
            <SortByAlphaIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Имя файла</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleMenuItem('uploadTime')} selected={sortOrder === 'uploadTime'}>
          <ListItemIcon>
            <CalendarMonthIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Дата загрузки</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleMenuItem('duration')} selected={sortOrder === 'duration'}>
          <ListItemIcon>
            <TimelapseIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Длительность</ListItemText>
        </MenuItem>
        <MenuItem onClick={handleMenuItem('size')} selected={sortOrder === 'size'}>
          <ListItemIcon>
            <StraightenIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Размер файла</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem onClick={toggleDescending}>
          <ListItemIcon>{descending ? undefined : <Check fontSize="small" />}</ListItemIcon>
          <ListItemText>По возрастанию</ListItemText>
        </MenuItem>
      </Menu>
    </Toolbar>
  );
};

export default MediaTabToolbar;
