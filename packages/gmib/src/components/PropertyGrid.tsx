/*
 * @license
 * Copyright (c) 2019. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nata" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */
import { IDevice } from '@nata/nibus.js-client/lib/mib';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { hot } from 'react-hot-loader/root';
import { withStyles, createStyles, Theme, WithStyles } from '@material-ui/core/styles';
import compose from 'recompose/compose';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import groupBy from 'lodash/groupBy';
import Typography from '@material-ui/core/Typography';
import PropertyValueCell from './PropertyValueCell';
import debounce from 'lodash/debounce';

const styles = (theme: Theme) => createStyles({
  table: {},
});

type Props = {
  device: IDevice,
};
type InnerProps = Props & WithStyles<typeof styles>;

const useDevice = (device: IDevice) => {
  const [props, setProps] = useState({});
  const [names, setNames] = useState([] as string[]);
  const reload = useCallback(
    () => {
      device.read().then((props) => {
        setNames(Object.keys(props));
        setProps(props);
      });
    },
    [device, setNames, setProps],
  );
  useEffect(
    () => { reload(); },
    [device],
  );
  const update = useCallback(
    () => {
      console.log('UPDATE', names.length);
      setProps(
        names.reduce(
          (props, name) => {
            props[name] = device[name];
            return props;
          },
          {} as Record<string, any>,
        ));
    },
    [device, names],
  );
  const drain = useMemo(
    () => debounce(() => device.drain().then(() => update()), 100),
    [device, update],
  );

  const setValue = useCallback(
    (name: string, value: any) => {
      device[name] = value;
      setProps(props => ({
        ...props,
        [name]: device[name],
      }));
      drain();
    },
    [device, drain],
  );

  return {
    props,
    setValue,
    reload,
    update,
    names,
  };
};

const PropertyGrid = ({ classes, device }: InnerProps) => {
  console.assert(!!device, 'Invalid device');
  const { props, setValue } = useDevice(device);
  const categories = useMemo(
    () => groupBy(
      Object.entries(props),
      ([name]) => Reflect.getMetadata('category', device || {}, name) as string || '',
    ),
    [device, props],
  );
  // console.log('RENDER');
  if (!device) return <div>Выберите устройство</div>;
  return (
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
            <TableRow>
              <TableCell colSpan={2}>
                <Typography variant="h6">{category}</Typography>
              </TableCell>
            </TableRow>
            {props.map(([name, value]) => (
              <TableRow key={name}>
                <TableCell>{Reflect.getMetadata('displayName', device, name)}</TableCell>
                <PropertyValueCell
                  proto={Reflect.getPrototypeOf(device)}
                  name={name}
                  value={value}
                  dirty={device.isDirty(name)}
                  onChangeProperty={setValue}
                />
              </TableRow>
            ))}
          </React.Fragment>
        ))}
      </TableBody>
    </Table>
  );
};

export default compose<InnerProps, Props>(
  hot,
  React.memo,
  withStyles(styles),
)(PropertyGrid);
