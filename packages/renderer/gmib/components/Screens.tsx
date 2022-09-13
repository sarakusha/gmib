import AddToQueue from '@mui/icons-material/AddToQueue';
import CloseIcon from '@mui/icons-material/Close';
import { Box, Container, IconButton, Paper, Tab, Tabs } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useSnackbar } from 'notistack';
import React, { useEffect, useState } from 'react';

import {
  selectScreens,
  useCreateScreenMutation,
  useDeleteScreenMutation,
  useGetScreensQuery,
} from '../api/screens';
import { useToolbar } from '../providers/ToolbarProvider';
import { useDispatch, useSelector } from '../store';
// import { removeScreen } from '../store/configSlice';
// import { createScreen } from '../store/configThunks';
import { setCurrentScreen } from '../store/currentSlice';

import { noop } from '/@common/helpers';

import { selectCurrentScreenId, selectCurrentTab, selectSessionVersion } from '../store/selectors';

import Screen from './Screen';
import ScreensToolbar from './ScreensToolbar';

const Label = styled('span')`
  display: flex;
  width: 100%;

  & > span:first-of-type {
    flex-grow: 1;
  }
`;

const Screens: React.FC = () => {
  const value = useSelector(selectCurrentScreenId);
  const { data: screensData, isSuccess } = useGetScreensQuery();
  const screens = screensData ? selectScreens(screensData) : [];
  const needSelect = value == null && isSuccess && screens.length > 0 && screens[0].id;
  // const screens = useSelector(selectScreens);
  const dispatch = useDispatch();
  useEffect(() => {
    if (needSelect) dispatch(setCurrentScreen(needSelect));
  }, [needSelect, dispatch]);
  const { closeSnackbar, enqueueSnackbar } = useSnackbar();
  const sessionVersion = useSelector(selectSessionVersion);
  const tab = useSelector(selectCurrentTab);
  const [, setToolbar] = useToolbar();
  const [readonly, setReadonly] = useState(true);
  const [createScreen] = useCreateScreenMutation();
  const [removeScreen] = useDeleteScreenMutation();
  useEffect(() => {
    if (tab === 'screens') {
      const toolbar = (
        <ScreensToolbar readonly={readonly} toggle={() => setReadonly(val => !val)} />
      );
      setToolbar(toolbar);
      return () => setToolbar(null);
    }
    return noop;
  }, [tab, setToolbar, readonly]);
  const removeHandler =
    (id: number): React.MouseEventHandler<HTMLButtonElement> =>
    e => {
      e.stopPropagation();
      if (e.shiftKey) {
        removeScreen(id);
      } else {
        enqueueSnackbar('Удерживайте клавишу Shift, чтобы удалить безвозвратно', {
          variant: 'info',
          preventDuplicate: true,
          autoHideDuration: 3000,
          onClose: () => closeSnackbar(),
        });
      }
    };
  const single = screens.length === 1;
  return (
    <Box sx={{ width: 1 }}>
      <Paper square>
        <Tabs
          value={value ?? 'addScreen'}
          indicatorColor="primary"
          textColor="primary"
          variant="scrollable"
          aria-label="screens"
          scrollButtons="auto"
        >
          {screens.map(({ id, name }, index) => (
            <Tab
              component="div"
              label={
                <Label>
                  <span>{name || `#${index + 1}`}</span>
                  <IconButton
                    size="small"
                    onClick={removeHandler(id)}
                    title="Удалить"
                    sx={{ display: readonly ? 'none' : undefined, p: '3px' }}
                    disabled={readonly}
                    color="inherit"
                  >
                    <CloseIcon fontSize="inherit" />
                  </IconButton>
                </Label>
              }
              value={id}
              key={id}
              onClick={() => dispatch(setCurrentScreen(id))}
            />
          ))}
          {sessionVersion && !readonly && (
            <Tab
              icon={<AddToQueue color={readonly ? 'inherit' : 'secondary'} />}
              sx={{ flexGrow: 0, minWidth: 48 }}
              // textColor="secondary"
              onClick={() => createScreen()}
              title="Добавить экран"
              value="addScreen"
              disabled={readonly}
            />
          )}
        </Tabs>
      </Paper>
      <Container maxWidth="md" sx={{ px: 2, py: 1 }}>
        {screens.map(({ id }) => (
          <Screen id={id} key={id} selected={value} readonly={readonly} single={single} />
        ))}
      </Container>
    </Box>
  );
};

export default Screens;
