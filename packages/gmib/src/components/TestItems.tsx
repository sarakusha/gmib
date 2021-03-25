/*
 * @license
 * Copyright (c) 2020. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import ListItem from '@material-ui/core/ListItem';
import ListItemText from '@material-ui/core/ListItemText';
import Switch from '@material-ui/core/Switch';
import React, { useCallback } from 'react';
import { useDispatch, useSelector } from '../store';
import AccordionList from './AccordionList';
import {
  activateTest,
  selectCurrentTab,
  selectCurrentTest,
  setCurrentTab,
  TabValues,
  selectAllTests,
} from '../store/currentSlice';

const TestItems: React.FC = () => {
  const dispatch = useDispatch();
  const current = useSelector(selectCurrentTest);
  const tests = useSelector(selectAllTests);
  const tab = useSelector(selectCurrentTab);
  const visibleHandler = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>, checked: boolean) => {
      dispatch(activateTest(checked ? event.currentTarget.id : undefined));
    },
    [dispatch]
  );
  /*
  const currentHandler = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      // event.stopPropagation();
      // event.preventDefault();
      dispatch(setCurrentTab('tests'));
    },
    [dispatch]
  );
*/
  return (
    <AccordionList
      name="tests"
      title="Вывод"
      expanded={tab === 'tests'}
      onChange={currentTab => dispatch(setCurrentTab(currentTab as TabValues))}
    >
      {tests.map(({ title, id }) => {
        const [primary, secondary = ''] = title.split('/', 2);
        return (
          <ListItem key={id}>
            <Switch checked={current === id} id={id} onChange={visibleHandler} />
            <ListItemText primary={primary} secondary={secondary} />
          </ListItem>
        );
      })}
    </AccordionList>
  );
};

export default React.memo(TestItems);
