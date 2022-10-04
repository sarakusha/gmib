import type { Theme } from '@mui/material/styles';
import { css, keyframes, styled } from '@mui/material/styles';
import React from 'react';

import type { LogItem } from '../store/logSlice';

const slideIn = (theme: Theme) => keyframes`
  0% {
    margin-left: 100%;
    background-color: ${theme?.palette.action.disabledBackground};
  }
  5% {
    margin-left: 0;
  }
  100% {
    background-color: ${theme?.palette.background.paper};
  }`;

const Line = styled('div')(({ theme }) => ({
  paddingLeft: theme.spacing(1),
  whiteSpace: 'nowrap',
  animation: `${slideIn(theme)} 5s`,
}));

const LogLine: React.FC<LogItem> = ({ prefix, tag, info, delta }) => (
  <Line>
    {prefix}{' '}
    {tag && (
      <b
        css={css`
          ${tag.css}
        `}
      >
        {tag.text.replace('novastar', 'nova')}
      </b>
    )}
    {info &&
      info.map((item, index) => (
        <span
          // eslint-disable-next-line react/no-array-index-key
          key={index}
          css={css`
            ${item.css}
          `}
        >
          {item.text}
        </span>
      ))}
    {tag && delta && (
      <span
        css={css`
          ${tag.css}
        `}
      >
        {delta ?? ''}
      </span>
    )}
  </Line>
);

export default React.memo(LogLine);
