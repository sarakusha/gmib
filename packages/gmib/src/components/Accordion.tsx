/*
 * @license
 * Copyright (c) 2020. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */
import React from 'react';
import { withStyles } from '@material-ui/core/styles';
import MuiAccordion from '@material-ui/core/Accordion';

export type { AccordionProps } from '@material-ui/core/Accordion';
const Accordion = withStyles({
  root: {
    // border: '1px solid rgba(0, 0, 0, .125)',
    boxShadow: 'none',
    // '&:not(:last-child)': {
    //   borderBottom: 0,
    // },
    '&:before': {
      display: 'none',
    },
    '&$expanded': {
      margin: 'auto',
    },
  },
  expanded: {
    borderBottom: '1px solid rgba(0, 0, 0, .12)',
  },
})(MuiAccordion);

export default React.memo(Accordion);
