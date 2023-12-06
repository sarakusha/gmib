import { Box, Paper, Table, TableBody, TableRow } from '@mui/material';
import groupBy from 'lodash/groupBy';
import React, { useEffect, useMemo, useState } from 'react';

import { useToolbar } from '../providers/ToolbarProvider';
import { useDevice, useDispatch, useSelector } from '../store';
import { reloadDevice } from '../store/deviceThunks';

import { noop } from '/@common/helpers';

import { selectCurrentTab, selectMibByName } from '../store/selectors';

import ErrorCard from './ErrorCard';
import PropertyGridToolbar from './PropertyGridToolbar';
import PropertyValueCell from './PropertyValueCell';
import StyledAccordionList from './StyledAccordionList';
import type { MinihostTabProps } from './TabContainer';
import TableCell from './TableCell';

const PropertyGridTab: React.FC<MinihostTabProps> = ({ id, selected = false }) => {
  const { mib, error, props } = useDevice(id) ?? {};
  const meta = useSelector(state => selectMibByName(state, mib ?? ''));
  const tab = useSelector(selectCurrentTab);
  const active: boolean = selected && tab === 'devices';
  const dispatch = useDispatch();
  const setValue = useMemo(
    () => window.nibus.setDeviceValue(id) as (name: string, value: unknown) => void,
    [id],
  );
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
            ([, { category }]) => category ?? '',
          )
        : null,
    [meta],
  );

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

  return (
    <Box px={1} width={1} fontSize="body1.fontSize" display={selected ? 'block' : 'none'}>
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
