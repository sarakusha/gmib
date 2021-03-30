/*
 * @license
 * Copyright (c) 2020. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import { AccordionSummary as MuiAccordionSummary } from '@material-ui/core';
import { withStyles } from '@material-ui/core/styles';

const AccordionSummary = withStyles(theme => ({
  root: {
    backgroundColor: theme.palette.background.paper,
    borderBottom: `1px solid ${theme.palette.divider}`,
    minHeight: 56,
    '&$expanded': {
      minHeight: 56,
      // marginBottom: -10,
    },
  },
  content: {
    '&$expanded': {
      margin: '12px 0',
    },
  },
  expanded: {},
}))(MuiAccordionSummary);

export default AccordionSummary;
