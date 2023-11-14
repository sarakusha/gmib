import AddToQueue from '@mui/icons-material/AddToQueue';
import CloseIcon from '@mui/icons-material/Close';
import { Container, IconButton, Paper, Tab, Tabs } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useSnackbar } from 'notistack';
import React, { useEffect, useState } from 'react';

import FixedHeadLayout from '../../common/FixedHeadLayout';
import { useCreateScreenMutation, useDeleteScreenMutation, useScreens } from '../api/screens';
import { useToolbar } from '../providers/ToolbarProvider';
import { useDispatch, useSelector } from '../store';
// import { removeScreen } from '../store/configSlice';
// import { createScreen } from '../store/configThunks';
import { setCurrentScreen } from '../store/currentSlice';

import { noop } from '/@common/helpers';

import {
  selectCurrentScreenId,
  selectCurrentTab,
  selectInvalidState,
  selectSessionVersion,
} from '../store/selectors';

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
  const { screens = [], isSuccess } = useScreens();
  const value = useSelector(selectCurrentScreenId);
  const needSelect = value == null && isSuccess && screens.length > 0 && screens[0].id;
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
  const invalidState = useSelector(selectInvalidState);
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
    <FixedHeadLayout>
      <Paper square>
        <Tabs
          value={isSuccess && value ? value : false}
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
              disabled={invalidState}
            />
          ))}
          {sessionVersion && !readonly && (
            <Tab
              icon={<AddToQueue color={readonly || invalidState ? 'inherit' : 'secondary'} />}
              sx={{ flexGrow: 0, minWidth: 48 }}
              // textColor="secondary"
              onClick={() => createScreen()}
              title="Добавить экран"
              value={-1}
              disabled={readonly || invalidState}
            />
          )}
        </Tabs>
      </Paper>
      <Container maxWidth="md">
        {screens.map(({ id }) => (
          <Screen id={id} key={id} selected={value} readonly={readonly} single={single} />
        ))}
      </Container>
    </FixedHeadLayout>
  );
};

export default Screens;
