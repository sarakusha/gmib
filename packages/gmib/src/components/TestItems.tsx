/*
 * @license
 * Copyright (c) 2019. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nata" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import { ListItem, ListItemText, ListSubheader, Switch } from '@material-ui/core';
import React, { useCallback } from 'react';
import { withStyles, createStyles, Theme, WithStyles } from '@material-ui/core/styles';
import { hot } from 'react-hot-loader/root';
import compose from 'recompose/compose';
import { useTests } from '../providers/TestProvider';
import useCurrent from '../providers/useCurrent';

const styles = (theme: Theme) => createStyles({
  header: {
    backgroundColor: theme.palette.background.paper,
    borderBottom: `1px solid ${theme.palette.divider}`,
    backgroundClip: 'padding-box',
  },
});
type Props = {};
type InnerProps = Props & WithStyles<typeof styles>;
const TestItems: React.FC<InnerProps> = ({ classes }) => {
  const { current, tests, visible, showTest, hideAll } = useTests();
  const setCurrent = useCurrent('test');
  const currentHandler = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      setCurrent(event.currentTarget.id);
    },
    [setCurrent],
  );
  const visibleHandler = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>, checked: boolean) => {
      if (!checked) {
        hideAll();
      } else {
        showTest(event.currentTarget.value);
      }
    },
    [showTest, hideAll],
  );
  return (
    <>
      <ListSubheader className={classes.header} inset>Тестирование</ListSubheader>
      {tests.map((test) => {
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
    </>
  );
};

export default compose<InnerProps, Props>(
  hot,
  React.memo,
  withStyles(styles),
)(TestItems);
