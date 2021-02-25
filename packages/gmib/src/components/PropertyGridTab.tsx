/*
 * @license
 * Copyright (c) 2020. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */
import Box from '@material-ui/core/Box';
import Paper from '@material-ui/core/Paper';
import { makeStyles } from '@material-ui/core/styles';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableRow from '@material-ui/core/TableRow';
import groupBy from 'lodash/groupBy';
import React, { useEffect, useMemo, useState } from 'react';
import { useSelector, useDispatch, useDevice } from '../store';
import { selectCurrentTab } from '../store/currentSlice';
import { selectMibByName } from '../store/mibsSlice';
import PropertyGridToolbar from './PropertyGridToolbar';
import TableCell from './TableCell';
import AccordionList from './AccordionList';
import ErrorCard from './ErrorCard';
import PropertyValueCell from './PropertyValueCell';
import { useToolbar } from '../providers/ToolbarProvider';
import type { Props } from './TabContainer';
import { reloadDevice, setDeviceValue, ValueType } from '../store/devicesSlice';

const useStyles = makeStyles(theme => ({
  error: {
    display: 'flex',
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  name: {
    paddingLeft: theme.spacing(4),
  },
  table: {
    '& table': {
      borderCollapse: 'separate',
    },
    borderBottom: 0,
  },
}));

const useSummaryClasses = makeStyles(theme => ({
  expanded: {
    backgroundColor: theme.palette.action.selected,
  },
  root: {
    opacity: 0.7,
    '& > *': {
      backgroundColor: 'transparent',
    },
  },
}));

const propertyGridToolbar = <PropertyGridToolbar />;

const PropertyGridTab: React.FC<Props> = ({ id, selected = false }) => {
  const classes = useStyles();
  const { mib, error, props } = useDevice(id) ?? {};
  const meta = useSelector(state => selectMibByName(state, mib ?? 0));
  const tab = useSelector(selectCurrentTab);
  const active: boolean = selected && tab === 'devices';
  const dispatch = useDispatch();
  const setValue = useMemo(() => {
    const action = setDeviceValue(id);
    return (name: string, value: ValueType) => {
      dispatch(action(name, value));
    };
  }, [id, dispatch]);
  const [, setToolbar] = useToolbar();

  useEffect(
    () =>
      setToolbar((toolbar: React.ReactNode) => {
        if (active) return propertyGridToolbar;
        return toolbar === propertyGridToolbar ? null : toolbar;
      }),
    [active, setToolbar]
  );

  const categories = useMemo(
    () =>
      meta
        ? groupBy(
            Object.entries(meta.properties).filter(([, { isReadable }]) => isReadable),
            ([, { category }]) => category ?? ''
          )
        : null,
    [meta]
  );

  const summaryClasses = useSummaryClasses();
  const [currentCategory, setCurrentCategory] = useState<string>();
  if (!meta || !categories || !props) return null;

  if (error) {
    return (
      <div className={classes.error}>
        <ErrorCard error={error} onAction={() => dispatch(reloadDevice(id))} />
      </div>
    );
  }

  return (
    <Box px={1} width={1} fontSize="body1.fontSize" display={selected ? 'block' : 'none'}>
      <Paper>
        {Object.entries(categories).map(([category, propNames]) => (
          <AccordionList
            key={category}
            name={category || 'other'}
            title={category}
            component={Table}
            summaryClasses={summaryClasses}
            className={classes.table}
            expanded={category === '' || currentCategory === category}
            onChange={setCurrentCategory}
          >
            <TableBody>
              {propNames.map(([name, info]) => (
                <TableRow key={name}>
                  <TableCell className={classes.name}>
                    {`${info.displayName}${info.unit && info.isWritable ? ` в ${info.unit}` : ''}`}
                  </TableCell>
                  <PropertyValueCell
                    meta={info}
                    name={name}
                    state={props[name]}
                    onChangeProperty={setValue}
                  />
                </TableRow>
              ))}
            </TableBody>
          </AccordionList>
        ))}
      </Paper>
    </Box>
  );
};

export default React.memo(PropertyGridTab);
