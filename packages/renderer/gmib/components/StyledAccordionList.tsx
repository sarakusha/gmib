import { styled } from '@mui/material/styles';

import AccordionList from './AccordionList';

const StyledAccordionList = styled(AccordionList)(({ theme, title }) => ({
  '&.MuiAccordionSummary-root': {
    display: title ? 'flex' : 'none',
    opacity: 0.6,
    '& > *': {
      backgroundColor: 'transparent',
    },
    '&.Mui-expanded': {
      backgroundColor: theme.palette.action.selected,
    },
  },
  '&.MuiAccordion-root.Mui-expanded': {
    borderBottom: 0,
  },
}));

export default StyledAccordionList;
