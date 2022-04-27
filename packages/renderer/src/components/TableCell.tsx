/*
 * @license
 * Copyright (c) 2022. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import { TableCell as MuiTableCell, TableCellProps } from '@mui/material';
import { styled } from '@mui/material/styles';

export const GuiFontSize = '0.875rem';

const TableCell = styled(MuiTableCell)(({ theme }) => ({
  '&.MuiTableCell-root': {
    fontSize: GuiFontSize,

    '&:last-child': {
      //   paddingRight: theme.spacing(2.5),
      color: theme.palette.text.disabled,
    },
  },
}));
export default TableCell;

export type { TableCellProps };
