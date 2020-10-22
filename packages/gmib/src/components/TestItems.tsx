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
import { useTests } from '../providers/TestProvider';
import useCurrent from '../providers/useCurrent';
import AccordionList from './AccordionList';

const TestItems: React.FC = () => {
  const { current, tests, visible, showTest, hideAll } = useTests();
  const setCurrent = useCurrent('test');
  const currentHandler = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      setCurrent(event.currentTarget.id);
    },
    [setCurrent]
  );
  const visibleHandler = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>, checked: boolean) => {
      if (!checked) {
        hideAll();
      } else {
        showTest(event.currentTarget.value);
      }
    },
    [showTest, hideAll]
  );
  return (
    <AccordionList name="tests" title="Тестирование">
      {tests.map(test => {
        const [primary, secondary] = test.split('/', 2);
        return (
          <ListItem
            id={test}
            button
            key={test}
            onClick={currentHandler}
            selected={test === current}
          >
            <Switch checked={visible === test} value={test} onChange={visibleHandler} />
            <ListItemText primary={primary} secondary={secondary} />
          </ListItem>
        );
      })}
    </AccordionList>
  );
};

export default TestItems;
