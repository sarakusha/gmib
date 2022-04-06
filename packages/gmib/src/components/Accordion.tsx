/*
 * @license
 * Copyright (c) 2022. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */
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
