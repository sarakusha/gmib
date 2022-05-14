
import { Box } from '@mui/material';
import type { DeviceId } from '@nibus/core';
import React from 'react';

// const useStyles = makeStyles({
//   root: {
//     width: '100%',
//     display: 'flex',
//   },
//   hidden: {
//     display: 'none',
//   },
// });

export type Props = {
  id: string;
  selected?: boolean;
};

export type MinihostTabProps = {
  id: DeviceId;
  selected?: boolean;
};

const TabContainer: React.FC<Props> = ({ id, children, selected = true }) => (
  <Box
    id={`tabpanel-${id}`}
    aria-labelledby={`tab-${id}`}
    hidden={!selected}
    sx={{ display: selected ? 'flex' : 'none', width: '100%' }}
  >
    {children}
  </Box>
);

export default TabContainer;
