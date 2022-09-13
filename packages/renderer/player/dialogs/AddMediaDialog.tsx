import { Box, Collapse, List } from '@mui/material';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import flatten from 'lodash/flatten';
import * as React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { TransitionGroup } from 'react-transition-group';

import { useGetMedia } from '../api/media';
import { useInsertMediaMutation } from '../api/playlists';
import MediaItem from '../components/MediaItem';
import Search from '../components/Search';

import { getStateAsync } from '/@common/helpers';

type Props = {
  id?: number | null;
  open: boolean;
  onClose: () => void;
};

type AddMedia = Record<string, number>;

const AddMediaDialog: React.FC<Props> = ({ id, open, onClose }) => {
  const [insert] = useInsertMediaMutation();
  const { data = [] } = useGetMedia();
  const [state, setState] = useState<AddMedia>({});
  const [search, setSearch] = React.useState('');
  useEffect(() => {
    open && setState({});
  }, [open]);
  const changeHandler = useCallback((md5: string, count: number) => {
    setState(({ [md5]: prev, ...other }) => ({ ...other, [md5]: count }));
  }, []);
  const clickHandler = useCallback((md5: string) => {
    setState(({ [md5]: prev, ...other }) => ({
      ...other,
      [md5]: prev ? 0 : 1,
    }));
  }, []);
  const addHandler = useCallback(async () => {
    if (!id) return;
    const add = await getStateAsync(setState);
    const chunks = Object.entries<number>(add).map<string[]>(([md5, count]) =>
      new Array(count).fill(md5),
    );
    const ids: string[] = flatten(chunks);
    // console.log({ chunks, ids });
    if (ids.length === 0) return;
    insert({ id, insert: ids });
    onClose();
  }, [insert, id, onClose]);
  React.useEffect(() => {
    setSearch('');
  }, [open]);
  const items = search
    ? data.filter(media => media.filename.toLocaleLowerCase().includes(search))
    : data;
  return (
    <Dialog open={open && !!id} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Добавить медиа</DialogTitle>
      <DialogContent>
        <DialogContentText>Выберите медиа для добавления в плейлист</DialogContentText>
        <List sx={{ minHeight: 200 }}>
          <TransitionGroup>
            {items.map(media => (
              <Collapse key={media.md5}>
                <MediaItem
                  media={media}
                  count={state[media.md5]}
                  onChange={changeHandler}
                  onClick={clickHandler}
                />
              </Collapse>
            ))}
          </TransitionGroup>
        </List>
      </DialogContent>
      <DialogActions>
        <Box sx={{ flex: 1 }}>
          <Search value={search} onChange={e => setSearch(e.target.value)} fixed variant="main" />
        </Box>
        <Button onClick={onClose}>Отмена</Button>
        <Button onClick={addHandler}>Добавить</Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddMediaDialog;
