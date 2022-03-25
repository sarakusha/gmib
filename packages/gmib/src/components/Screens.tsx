/*
 * @license
 * Copyright (c) 2022. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */
import { Container, IconButton, Paper, Tab, Tabs } from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import AddToQueue from '@material-ui/icons/AddToQueue';
import CloseIcon from '@material-ui/icons/Close';
import classNames from 'classnames';
import React, { useEffect, useState } from 'react';
import { useSnackbar } from 'notistack';
import { useToolbar } from '../providers/ToolbarProvider';
import { removeScreen, selectScreens, selectSessionVersion } from '../store/configSlice';
import { useDispatch, useSelector } from '../store';
import { selectCurrentScreenId, selectCurrentTab, setCurrentScreen } from '../store/currentSlice';
import { createScreen } from '../store/configThunks';
import { noop } from '../util/helpers';
import Screen from './Screen';
import ScreensToolbar from './ScreensToolbar';

const useStyles = makeStyles(theme => ({
  root: {
    width: '100%',
    // display: 'flex',
    // flexDirection: 'column',
  },
  content: {
    // flexGrow: 1,
    paddingTop: theme.spacing(1),
    paddingBottom: theme.spacing(1),
    paddingLeft: theme.spacing(2),
    paddingRight: theme.spacing(2),
  },
  label: {
    display: 'flex',
    width: '100%',
    '& > *:first-child': {
      flexGrow: 1,
    },
  },
  add: {
    flexGrow: 0,
    minWidth: 48,
    // backgroundColor: theme.palette.secondary.light,
  },
  hidden: {
    // visibility: 'hidden',
    display: 'none',
  },
}));

const Screens: React.FC = () => {
  const classes = useStyles();
  const value = useSelector(selectCurrentScreenId);
  const screens = useSelector(selectScreens);
  const dispatch = useDispatch();
  const { closeSnackbar, enqueueSnackbar } = useSnackbar();
  const sessionVersion = useSelector(selectSessionVersion);
  const tab = useSelector(selectCurrentTab);
  const [, setToolbar] = useToolbar();
  const [readonly, setReadonly] = useState(true);
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
  const removeHandler = (id: string): React.MouseEventHandler<HTMLButtonElement> => e => {
    e.stopPropagation();
    if (e.shiftKey) {
      dispatch(removeScreen(id));
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
    <div className={classes.root}>
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
                <span className={classes.label}>
                  <span>{name || `#${index + 1}`}</span>
                  <IconButton
                    size="small"
                    onClick={removeHandler(id)}
                    title="Удалить"
                    className={classNames({ [classes.hidden]: readonly })}
                    disabled={readonly}
                    color="inherit"
                  >
                    <CloseIcon fontSize="inherit" />
                  </IconButton>
                </span>
              }
              value={id}
              key={id}
              onClick={() => dispatch(setCurrentScreen(id))}
            />
          ))}
          {sessionVersion && (
            <Tab
              icon={<AddToQueue color={readonly ? 'inherit' : 'secondary'} />}
              className={classes.add}
              textColor="secondary"
              onClick={() => dispatch(createScreen())}
              title="Добавить экран"
              value="addScreen"
              disabled={readonly}
            />
          )}
        </Tabs>
      </Paper>
      <Container maxWidth="md" className={classes.content}>
        {screens.map(({ id }) => (
          <Screen id={id} key={id} selected={value} readonly={readonly} single={single} />
        ))}
      </Container>
    </div>
  );
};

export default Screens;
