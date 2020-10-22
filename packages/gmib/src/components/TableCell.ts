/*
 * @license
 * Copyright (c) 2020. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */
import withStyles from '@material-ui/core/styles/withStyles';
import MuiTableCell, { TableCellProps } from '@material-ui/core/TableCell';

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
