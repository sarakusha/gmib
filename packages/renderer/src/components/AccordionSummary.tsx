/*
 * @license
 * Copyright (c) 2022. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import { AccordionSummary as MuiAccordionSummary } from '@mui/material';
import extendStyled from '../util/extendStyled';

const AccordionSummary = extendStyled(MuiAccordionSummary, {
  selected: false,
})(({ theme, selected }) => ({
  '&.MuiAccordionSummary-root': {
    backgroundColor: selected ? theme.palette.action.selected : theme.palette.background.paper,
    borderBottom: `1px solid ${theme.palette.divider}`,
    minHeight: 56,
    '&.Mui-expanded': {
      minHeight: 56,
    },
  },
  '.MuiAccordionSummary-content.Mui-expanded': {
    margin: '12px 0',
  },
}));

export default AccordionSummary;
