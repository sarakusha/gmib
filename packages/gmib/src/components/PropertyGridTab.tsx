/*
 * @license
 * Copyright (c) 2022. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */
import { Box, Paper, Table, TableBody, TableRow } from '@mui/material';
import { styled, css } from '@mui/material/styles';
import groupBy from 'lodash/groupBy';
import React, { useEffect, useMemo, useState } from 'react';
import { useDevice, useDispatch, useSelector } from '../store';
import { selectCurrentTab } from '../store/currentSlice';
import { selectMibByName } from '../store/mibsSlice';
import { noop } from '../util/helpers';
import PropertyGridToolbar from './PropertyGridToolbar';
import TableCell from './TableCell';
import AccordionList from './AccordionList';
import ErrorCard from './ErrorCard';
import PropertyValueCell from './PropertyValueCell';
import { useToolbar } from '../providers/ToolbarProvider';
import type { MinihostTabProps } from './TabContainer';
import { ValueType, reloadDevice, setDeviceValue } from '../store/devicesSlice';

// const useStyles = makeStyles(theme => ({
//   error: {
//     display: 'flex',
//     width: '100%',
//     justifyContent: 'center',
//     alignItems: 'center',
//   },
//   name: {
//     paddingLeft: theme.spacing(4),
//   },
//   table: {
//     '& table': {
//       borderCollapse: 'separate',
//     },
//     borderBottom: 0,
//   },
// }));

// const useSummaryClasses = makeStyles(theme => ({
//   expanded: {
//     backgroundColor: theme.palette.action.selected,
//   },
//   root: {
//     opacity: 0.7,
//     '& > *': {
//       backgroundColor: 'transparent',
//     },
//   },
// }));

const StyledAccordionList = styled(AccordionList)(({ theme }) => ({
  '&.MuiAccordionSummary-root': {
    opacity: 0.6,
    '& > *': {
      backgroundColor: 'transparent',
    },
    '&.Mui-expanded': {
      backgroundColor: theme.palette.action.selected,
    },
  },
  '&.MuiAccordion-root.Mui-expanded': {
    borderBottom: 0,
  },
}));

const PropertyGridTab: React.FC<MinihostTabProps> = ({ id, selected = false }) => {
  const { mib, error, props } = useDevice(id) ?? {};
  const meta = useSelector(state => selectMibByName(state, mib ?? 0));
  const tab = useSelector(selectCurrentTab);
  const active: boolean = selected && tab === 'devices';
  const dispatch = useDispatch();
  const setValue = useMemo(() => {
    const action = setDeviceValue(id);
    return (name: string, value: unknown) => {
      dispatch(action(name, value as ValueType));
    };
  }, [id, dispatch]);
  const [, setToolbar] = useToolbar();

  useEffect(() => {
    if (active) {
      setToolbar(<PropertyGridToolbar />);
      return () => setToolbar(null);
    }
    return noop;
  }, [active, setToolbar]);

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

  // const summaryClasses = useSummaryClasses();
  const [currentCategory, setCurrentCategory] = useState<string>();
  if (!meta || !categories || !props) return null;

  if (error) {
    return (
      <Box
        sx={{
          display: 'flex',
          width: 1,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <ErrorCard error={error} onAction={() => dispatch(reloadDevice(id))} />
      </Box>
    );
  }

  // TODO: table
  return (
    <Box px={1} width={1} fontSize="body1.fontSize" display={selected ? 'block' : 'none'}>
      {/*
      <GlobalStyles
        styles={theme => ({
          '.MuiAccordionSummary-root.MuiAccordionSummary-root': {
            opacity: 0.7,
            '& > *': {
              backgroundColor: 'transparent',
            },
            '&.Mui-expanded': {
              backgroundColor: theme.palette.action.selected,
            },
          },
          '.MuiAccordion-root.MuiAccordion-root.MuiAccordion-root.Mui-expanded': {
            borderBottom: 0,
          },
        })}
      />
*/}
      <Paper>
        {Object.entries(categories).map(([category, propNames]) => (
          <StyledAccordionList
            key={category}
            name={category || 'other'}
            title={category}
            component={Table}
            // summaryClasses={summaryClasses}
            expanded={category === '' || currentCategory === category}
            onChange={setCurrentCategory}
          >
            <TableBody>
              {propNames.map(([name, info]) => (
                <TableRow key={name}>
                  <TableCell sx={{ pl: 4 }}>
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
          </StyledAccordionList>
        ))}
      </Paper>
    </Box>
  );
};

export default React.memo(PropertyGridTab);
