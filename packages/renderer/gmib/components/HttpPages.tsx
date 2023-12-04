import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/Edit';
import {
  IconButton,
  ListItemIcon,
  ListItemSecondaryAction,
  ListItemText,
  ListItemButton as MuiListItem,
  Switch,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import clsx from 'clsx';
import React, { useCallback, useState } from 'react';

import useShiftAlert from '../../common/useShiftAlert';
import { useCreatePageMutation, useDeletePageMutation, usePages } from '../api/config';
import { updateScreen, useScreen } from '../api/screens';
import HttpPageDialog, { isValidUrl } from '../dialogs/HttpPageDialog';
import { useDispatch, useSelector } from '../store';
import type { TabValues } from '../store/currentSlice';
import { setCurrentTab } from '../store/currentSlice';

import { selectCurrentScreenId, selectCurrentTab } from '../store/selectors';

import AccordionList from './AccordionList';

const ListItemButton = styled(MuiListItem)({
  '& .MuiListItemSecondaryAction-root svg': {
    visibility: 'hidden',
  },
  '&:hover .MuiListItemSecondaryAction-root svg': {
    visibility: 'visible',
  },
});

const noWrap = { noWrap: true };

const HttpPages: React.FC = () => {
  const dispatch = useDispatch();
  const screenId = useSelector(selectCurrentScreenId);
  const showAlert = useShiftAlert();
  /* TODO: ! */
  const { screen } = useScreen(screenId);
  const { pages } = usePages();
  const tab = useSelector(selectCurrentTab);
  const [selected, setSelected] = useState<string>();
  const [createPage] = useCreatePageMutation();
  const [deletePage] = useDeletePageMutation();
  const visibleHandler = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>, checked: boolean) => {
      screenId &&
        dispatch(
          updateScreen(screenId, prev => ({
            ...prev,
            test: checked ? event.currentTarget.id : undefined,
          })),
        );
    },
    [dispatch, screenId],
  );
  const [open, setOpen] = useState(false);
  const closeDialog = (): void => setOpen(false);
  const editPage = (id: string) => {
    setSelected(id);
    setOpen(true);
  };
  const addPageHandler = async (): Promise<void> => {
    const { id } = await createPage('Новая страница').unwrap();
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
          const isValid = permanent || (url && isValidUrl(url));
          return (
            <ListItemButton
              key={id}
              className={clsx({
                'tNX9k9byJD58qNs4nxAIi rlXINR-cZo5bnISD5TaUT MeE8KHrK9KuXZe0HnW47V': !permanent,
              })}
            >
              <ListItemIcon>
                <Switch
                  checked={screen?.test === id}
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
                <ListItemSecondaryAction className="tNX9k9byJD58qNs4nxAIi CG7cBydXFzf6qGSi-xBj8">
                  {/* <ListItemSecondaryAction> */}
                  <IconButton
                    edge="end"
                    aria-label="edit"
                    size="small"
                    onClick={() => editPage(id)}
                    color="primary"
                    title="Изменить"
                  >
                    <EditIcon fontSize="inherit" />
                  </IconButton>
                  <IconButton
                    edge="end"
                    aria-label="remove"
                    size="small"
                    onClick={e => (e.shiftKey ? deletePage(id) : showAlert())}
                    color="secondary"
                    title="Удалить"
                  >
                    <CloseIcon fontSize="inherit" />
                  </IconButton>
                </ListItemSecondaryAction>
              )}
            </ListItemButton>
            // </div>
          );
        })}
        <ListItemButton
          onClick={addPageHandler}
          className="rlXINR-cZo5bnISD5TaUT CG7cBydXFzf6qGSi-xBj8 MeE8KHrK9KuXZe0HnW47V"
        >
          <ListItemIcon>
            <AddCircleOutlineIcon style={{ margin: 'auto' }} color="primary" />
          </ListItemIcon>
          <ListItemText>Добавить URL</ListItemText>
        </ListItemButton>
      </AccordionList>
      <HttpPageDialog open={open} onClose={closeDialog} pageId={selected} />
    </>
  );
};

export default React.memo(HttpPages);
