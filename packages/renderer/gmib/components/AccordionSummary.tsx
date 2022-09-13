
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
