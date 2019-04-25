/*
 * @license
 * Copyright (c) 2019. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nata" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */
import { CircularProgress, IconButton, Tooltip } from '@material-ui/core';
import {
  createStyles,
  Theme,
  withStyles,
  WithStyles,
  withTheme,
  WithTheme,
} from '@material-ui/core/styles';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import Typography from '@material-ui/core/Typography';
import groupBy from 'lodash/groupBy';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { hot } from 'react-hot-loader/root';
import compose from 'recompose/compose';
import ReloadIcon from '@material-ui/icons/refresh';
import { useDevicesContext } from './DevicesProvier';

import ErrorCard from './ErrorCard';
import PropertyValueCell from './PropertyValueCell';
import { useDevice } from './DevicesStateProvider';
import { useToolbar } from './ToolbarProvider';

const styles = (theme: Theme) => createStyles({
  root: {
    width: '100%',
    display: 'flex',
    paddingLeft: theme.spacing.unit,
    paddingRight: theme.spacing.unit,
    overflow: 'auto',
  },
  wrapper: {},
  toolbarWrapper: {
    position: 'relative',
  },
  fabProgress: {
    color: theme.palette.secondary.light,
    position: 'absolute',
    pointerEvents: 'none',
    top: 0,
    left: 0,
    zIndex: 1,
  },
  table: {},
});

type Props = {
  id: string,
  active?: boolean,
};
type InnerProps = Props & WithStyles<typeof styles> & WithTheme;

const PropertyGrid: React.FC<InnerProps> = ({ classes, id, active = true }) => {
  const { current } = useDevicesContext();
  const { props, setValue, error, reload, proto, isDirty } = useDevice(id);
  const [busy, setBusy] = useState(false);
  const reloadHandler = useCallback(
    async () => {
      setBusy(true);
      await reload();
      setBusy(false);
    },
    [reload, setBusy],
  );
  const reloadToolbar = useMemo(
    () => (
      <Tooltip title="Обновить свойства" enterDelay={1000}>
        <div className={classes.toolbarWrapper}>
          <IconButton color="inherit" onClick={reloadHandler} disabled={busy}>
            <ReloadIcon />
          </IconButton>
          {busy && <CircularProgress size={48} className={classes.fabProgress}/>}
        </div>
      </Tooltip>
    ),
    [reloadHandler, busy],
  );

  const [, setToolbar] = useToolbar();

  useEffect(
    () =>
      setToolbar((toolbar: React.ReactNode) => {
        if (active && current === id) return reloadToolbar;
        return toolbar === reloadToolbar ? null : toolbar;
      })
    ,
    [active, current, reloadToolbar],
  );

  const categories = useMemo(
    () => groupBy(
      Object.entries(props),
      ([name]) => Reflect.getMetadata('category', proto, name) as string || '',
    ),
    [props],
  );
  // useEffect(() => {
  //   console.log('ON', document.documentElement.scrollTop);
  //   return () => {
  //     console.log('OFF', document.documentElement.scrollTop);
  //   };
  // });
  // console.log('RENDER');
  if (error) {
    return <ErrorCard error={error} onAction={reload} />;
  }
  return (
    <div className={classes.root}>
      <div className={classes.wrapper}>
        <Table className={classes.table}>
          <TableHead>
            <TableRow>
              <TableCell>Имя</TableCell>
              <TableCell>Значение</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {Object.entries(categories).map(([category, props]) => (
              <React.Fragment key={category}>
                {category && (<TableRow>
                  <TableCell colSpan={2}>
                    <Typography variant="h6">{category}</Typography>
                  </TableCell>
                </TableRow>) || null}
                {props.map(([name, value]) => (
                  <TableRow key={name}>
                    <TableCell>{Reflect.getMetadata('displayName', proto, name)}</TableCell>
                    <PropertyValueCell
                      proto={proto}
                      name={name}
                      value={value}
                      dirty={isDirty(name)}
                      onChangeProperty={setValue}
                    />
                  </TableRow>
                ))}
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default compose<InnerProps, Props>(
  hot,
  React.memo,
  withTheme(),
  withStyles(styles),
)(PropertyGrid);
