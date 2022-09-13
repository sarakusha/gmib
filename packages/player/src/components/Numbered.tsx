import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { css } from '@mui/material/styles';
import React from 'react';

type Props = {
  width?: number;
  index?: number;
  text: string;
};

const Numbered: React.FC<Props> = ({ width = 3, index, text }) => (
  <Box sx={{ display: 'flex', flex: 1, minWidth: 0 }}>
    {index != null && (
      <Typography
        variant="body2"
        css={css`
          width: ${width}ch;
          text-align: right;
        `}
      >
        {index}.&nbsp;
      </Typography>
    )}
    <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }} noWrap>
      {text}
    </Typography>
  </Box>
);

export default Numbered;
