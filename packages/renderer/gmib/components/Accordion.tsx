import { Accordion as MuiAccordion } from '@mui/material';
import { styled } from '@mui/material/styles';

const Accordion = styled(MuiAccordion)({
  '&.MuiAccordion-root': {
    boxShadow: 'none',
    '&:before': {
      display: 'none',
    },
    '&.Mui-expanded': {
      margin: 'auto',
      borderBottom: '1px solid rgba(0, 0, 0, .12)',
    },
  },
});

export default Accordion;
