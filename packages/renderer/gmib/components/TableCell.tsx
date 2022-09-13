
import type { TableCellProps } from '@mui/material';
import { TableCell as MuiTableCell } from '@mui/material';
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
