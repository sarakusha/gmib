import MuiTableCell, { TableCellProps } from '@material-ui/core/TableCell';
import { withStyles } from '@material-ui/core/styles';

export const GuiFontSize = '0.875rem';

export default withStyles(theme => ({
  root: {
    fontSize: GuiFontSize,

    '&:last-child': {
      //   paddingRight: theme.spacing(2.5),
      color: theme.palette.text.disabled,
    },
  },
}))(MuiTableCell);

export type { TableCellProps };
