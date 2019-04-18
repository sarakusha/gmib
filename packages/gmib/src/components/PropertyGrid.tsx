/*
 * @license
 * Copyright (c) 2019. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nata" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */
import { IconButton } from '@material-ui/core';
// import Fab from '@material-ui/core/Fab';
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
import React, { useEffect, useMemo } from 'react';
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
    // width: '100%',
    // display: 'flex',
    // justifyContent: 'center',
    paddingLeft: theme.spacing.unit,
    paddingRight: theme.spacing.unit,
  },
  table: {
    // marginRight: theme.spacing.unit,
    // marginLeft: theme.spacing.unit,
  },
  fab: {
    position: 'fixed',
    top: theme.spacing.unit, // + Number(theme.mixins.toolbar.minHeight),
    right: theme.spacing.unit * 2,
    zIndex: 10000,
  },
});

type Props = {
  id: string,
  active?: boolean,
};
type InnerProps = Props & WithStyles<typeof styles> & WithTheme;

const PropertyGrid: React.FC<InnerProps> = ({ classes, id, active = true }) => {
  const { current } = useDevicesContext();
  const { props, setValue, error, reload, proto, isDirty } = useDevice(id);
  const reloadToolbar = useMemo(
    () => (
      <IconButton color="inherit" onClick={reload}>
        <ReloadIcon />
      </IconButton>
    ),
    [reload],
  );

  const [, setToolbar] = useToolbar();

  useEffect(
    () =>
      setToolbar((toolbar: React.ReactNode) => {
        if (active && current === id) return reloadToolbar;
        return toolbar === reloadToolbar ? null : toolbar;
      })
    ,
    [active, current],
  );

  // useEffect(() => {
  //   console.log('PROPS CHANGED', id);
  // }, [props]);
  // console.log('PropGrid', id);
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
  );
};

export default compose<InnerProps, Props>(
  hot,
  React.memo,
  withTheme(),
  withStyles(styles),
)(PropertyGrid);
