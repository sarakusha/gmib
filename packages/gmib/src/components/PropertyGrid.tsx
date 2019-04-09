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
// import classNames from 'classnames';
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

const styles = (theme: Theme) => createStyles({
  table: {},
});

type Props = {
  device: IDevice,
};
type InnerProps = Props & WithStyles<typeof styles>;

// type SetPropertyAction = {
//   name: string,
//   value: any,
// };
//
// type PropertyState = Record<string, any>;
//
// const reducer = (state: PropertyState = {}, action: SetPropertyAction) => {
//   console.log(action);
//   state[action.name] = action.value;
//   // console.log('STATE', JSON.stringify(state));
//   return { ...state };
// };
//
// const initializer = (device: IDevice) => {
//   const mibProperties = Reflect.getMetadata('mibProperties', device) as string[];
//   const state: PropertyState = {};
//   mibProperties
//     .filter(name => Reflect.getMetadata('isReadable', device, name))
//     .forEach((name: string) => {
//       state[name] = 0;
//     });
//   console.log('initial', state);
//   return state;
// };
//
// function useForceUpdate() {
//   const [update, set] = useState(true);
//   return [update, () => { set(value => !value); }];
// }

const PropertyGrid = ({ classes, device }: InnerProps) => {
  console.assert(!!device, 'Invalid device');
  const [props, setProps] = useState({});
  // const [props, dispatch] =
  // useReducer<typeof reducer, IDevice>(reducer, device, initializer);
  // const [update, forceUpdate] = useForceUpdate();
  const changeHandler = useCallback(
    (name: string, value: any) => {
      device[name] = value;
      setProps(props => ({
        ...props,
        [name]: device[name],
      }));
      // console.log('CHANGE', name, value);
      // dispatch({
      //   name,
      //   value,
      // });
    },
    [setProps],
  );
  useEffect(
    () => {
      device && device.read()
        .then(props => setProps(props));
        // .then(() => forceUpdate());
    },
    [device, setProps],
  );
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
                  onChangeProperty={changeHandler}
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
