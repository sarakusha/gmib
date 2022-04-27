/*
 * @license
 * Copyright (c) 2022. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import Input from '@mui/material/Input';
import extendStyled from '../util/extendStyled';

type AlignType = 'inherit' | 'left' | 'center' | 'right' | 'justify';

export type ExtendedProps = {
  align?: AlignType;
  dirty?: boolean;
};

const StyledInput = extendStyled(Input, { align: 'left', dirty: false } as ExtendedProps)(
  ({ align, dirty }) => ({
    '&.MuiInput-root': {
      fontWight: dirty ? 'bold' : 'normal',
      fontSize: 'inherit',
    },
    '& input': {
      textAlign: align,
    },
  })
);

export default StyledInput;
