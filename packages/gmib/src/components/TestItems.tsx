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
} from '../store/currentSlice';
import { selectTests } from '../store/testSlice';

const TestItems: React.FC = () => {
  const dispatch = useDispatch();
  const current = useSelector(selectCurrentTest);
  const tests = useSelector(selectTests);
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
      title="Тестирование"
      expanded={tab === 'tests'}
      onChange={currentTab => dispatch(setCurrentTab(currentTab as TabValues))}
    >
      {tests.map(([test, path]) => {
        const [primary, secondary = ''] = test.split('/', 2);
        return (
          <ListItem key={test}>
            <Switch checked={current === path} id={path} onChange={visibleHandler} />
            <ListItemText primary={primary} secondary={secondary} />
          </ListItem>
        );
      })}
    </AccordionList>
  );
};

export default React.memo(TestItems);
