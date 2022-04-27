/*
 * @license
 * Copyright (c) 2022. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import {
  IconButton,
  ListItemIcon,
  ListItemSecondaryAction,
  ListItemText,
  ListItemButton as MuiListItemButton,
  Switch,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { useTheme } from '@emotion/react';
import React, { useCallback, useState } from 'react';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/Edit';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import { nanoid } from '@reduxjs/toolkit';
import { isUri } from 'valid-url';
import HttpPageDialog from '../dialogs/HttpPageDialog';
import { useDispatch, useSelector } from '../store';
import { Page } from '../util/config';
import AccordionList from './AccordionList';
import {
  removeHttpPage,
  selectAllPages,
  selectScreenById,
  showHttpPage,
  upsertHttpPage,
} from '../store/configSlice';
import {
  TabValues,
  selectCurrentScreenId,
  selectCurrentTab,
  setCurrentTab,
} from '../store/currentSlice';
/*
const useStyles = makeStyles(theme => ({
  item: {
    color: 'red',
    '&:hover $actions': {
      visibility: 'visible',
    },
    '& $actions': {
      visibility: 'hidden',
    },
  },
  actions: {},
}));
*/

const ListItemButton = styled(MuiListItemButton)({
  '&.MuiListItemButton-container': {
    '&:hover.MuiListItemButton-secondaryAction ~ *': {
      visibility: 'visible',
    },
    '&.MuiListItemButton-secondaryAction ~ *': {
      visibility: 'hidden',
    },
  },
});

const noWrap = { noWrap: true };

const HttpPages: React.FC = () => {
  const dispatch = useDispatch();
  const screen = useSelector(selectCurrentScreenId);
  const current = useSelector(state => selectScreenById(state, screen))?.output;
  const pages = useSelector(selectAllPages);
  const tab = useSelector(selectCurrentTab);
  const [selected, setSelected] = useState<string>();
  const visibleHandler = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>, checked: boolean) => {
      screen && dispatch(showHttpPage([screen, checked ? event.currentTarget.id : undefined]));
    },
    [dispatch, screen]
  );
  const [open, setOpen] = useState(false);
  const closeDialog = (): void => setOpen(false);
  const changeHandler = (name: keyof Page, value: string): void => {
    if (!selected) return;
    const props = pages.find(page => page.id === selected);
    if (!props) return;
    dispatch(upsertHttpPage({ ...props, [name]: value }));
  };
  const editPage = (id: string) => () => {
    setSelected(id);
    setOpen(true);
  };
  const addPageHandler = (): void => {
    const id = nanoid();
    dispatch(upsertHttpPage({ id, title: id }));
    setSelected(id);
    setOpen(true);
  };
  return (
    <>
      <AccordionList
        name="screens"
        title="Вывод"
        expanded={tab === 'screens'}
        selected={tab === 'screens'}
        onChange={currentTab => dispatch(setCurrentTab(currentTab as TabValues))}
      >
        {pages.map(({ title = '', id, permanent, url }) => {
          const [primary, secondary = ''] = title.split('/', 2);
          const isValid = permanent || (url && isUri(url));
          return (
            <ListItemButton key={id}>
              <ListItemIcon>
                <Switch
                  checked={current === id}
                  id={id}
                  onChange={visibleHandler}
                  disabled={!isValid}
                />
              </ListItemIcon>
              <ListItemText
                primary={primary}
                secondary={permanent ? secondary : url}
                primaryTypographyProps={noWrap}
                secondaryTypographyProps={noWrap}
              />
              {!permanent && (
                <ListItemSecondaryAction>
                  <IconButton
                    edge="end"
                    aria-label="edit"
                    size="small"
                    onClick={editPage(id)}
                    color="primary"
                    title="Изменить"
                  >
                    <EditIcon fontSize="inherit" />
                  </IconButton>
                  <IconButton
                    edge="end"
                    aria-label="remove"
                    size="small"
                    onClick={() => dispatch(removeHttpPage(id))}
                    color="secondary"
                    title="Удалить"
                  >
                    <CloseIcon fontSize="inherit" />
                  </IconButton>
                </ListItemSecondaryAction>
              )}
            </ListItemButton>
          );
        })}
        <ListItemButton onClick={addPageHandler}>
          <ListItemIcon>
            <AddCircleOutlineIcon style={{ margin: 'auto' }} color="primary" />
          </ListItemIcon>
          <ListItemText>Добавить URL</ListItemText>
        </ListItemButton>
      </AccordionList>
      <HttpPageDialog
        open={open}
        onClose={closeDialog}
        onChange={changeHandler}
        pageId={selected}
      />
    </>
  );
};

export default React.memo(HttpPages);
