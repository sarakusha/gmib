import { Box } from '@mui/material';
import React from 'react';

import type { DeviceId } from '@nibus/core';

// const useStyles = makeStyles({
//   root: {
//     width: '100%',
//     display: 'flex',
//   },
//   hidden: {
//     display: 'none',
//   },
// });

export type Props = React.PropsWithChildren<{
  id: string;
  selected?: boolean;
  unmount?: boolean;
}>;

export type MinihostTabProps = {
  id: DeviceId;
  selected?: boolean;
};

const TabContainer: React.FC<Props> = ({ id, children, selected = true, unmount = false }) =>
  selected || !unmount ? (
    <Box
      id={`tabpanel-${id}`}
      aria-labelledby={`tab-${id}`}
      hidden={!selected}
      sx={{ display: selected ? 'flex' : 'none', width: '100%' }}
    >
      {children}
    </Box>
  ) : null;

export default TabContainer;
