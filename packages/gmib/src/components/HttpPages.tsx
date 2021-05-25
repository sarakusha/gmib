/*
 * @license
 * Copyright (c) 2021. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import { withStyles } from '@material-ui/core/styles';
import {
  ListItemIcon,
  ListItemSecondaryAction,
  ListItem as MuiListItem,
  ListItemText,
  Switch,
  IconButton,
} from '@material-ui/core';
import React, { useCallback, useState } from 'react';
import CloseIcon from '@material-ui/icons/Close';
import EditIcon from '@material-ui/icons/Edit';
import AddCircleOutlineIcon from '@material-ui/icons/AddCircleOutline';
import { nanoid } from '@reduxjs/toolkit';
import { isUri } from 'valid-url';
import HttpPageDialog from '../dialogs/HttpPageDialog';
import { useDispatch, useSelector } from '../store';
import { activateHttpPage } from '../store/configThunks';
import { Page } from '../util/config';
import AccordionList from './AccordionList';
import {
  selectAllPages,
  removeHttpPage,
  upsertHttpPage,
  selectScreenById,
} from '../store/configSlice';
import {
  selectCurrentScreenId,
  selectCurrentTab,
  setCurrentTab,
  TabValues,
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

const ListItem = withStyles({
  container: {
    '&:hover $secondaryAction ~ *': {
      visibility: 'visible',
    },
    '& $secondaryAction ~ *': {
      visibility: 'hidden',
    },
  },
  secondaryAction: {},
})(MuiListItem) as typeof MuiListItem;

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
      screen && dispatch(activateHttpPage(screen, checked ? event.currentTarget.id : undefined));
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
        onChange={currentTab => dispatch(setCurrentTab(currentTab as TabValues))}
      >
        {pages.map(({ title = '', id, permanent, url }) => {
          const [primary, secondary = ''] = title.split('/', 2);
          const isValid = permanent || (url && isUri(url));
          return (
            <ListItem key={id}>
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
            </ListItem>
          );
        })}
        <ListItem button onClick={addPageHandler}>
          <ListItemIcon>
            <AddCircleOutlineIcon style={{ margin: 'auto' }} color="primary" />
          </ListItemIcon>
          <ListItemText>Добавить URL</ListItemText>
        </ListItem>
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
