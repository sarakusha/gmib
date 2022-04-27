/*
 * @license
 * Copyright (c) 2022. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import { Box } from '@mui/material';
import { DeviceId } from '@nibus/core';
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
