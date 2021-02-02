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
import { activateTest, selectCurrentTest } from '../store/currentSlice';
import { selectTests } from '../store/testSlice';

const TestItems: React.FC = () => {
  const dispatch = useDispatch();
  const current = useSelector(selectCurrentTest);
  const tests = useSelector(selectTests);
  const visibleHandler = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>, checked: boolean) => {
      dispatch(activateTest(checked ? event.currentTarget.id : undefined));
    },
    [dispatch]
  );
  return (
    <AccordionList name="tests" title="Тестирование">
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
