import { Container } from '@mui/material';
import React, { useRef } from 'react';

import Content from './Autobrightness.mdx';
import mdx from './mdx';

const AutobrightnessHelp: React.FC = () => {
  const refContent = useRef<HTMLDivElement>(null);
  return (
    <Container
      maxWidth="md"
      sx={{
        '& p + ul, & p + ol': {
          marginTop: -16,
          marginBottom: 16,
        },
        '& figure': {
          display: 'inline-block',
        },
        '& figcaption': {
          textAlign: 'center',
        },
      }}
      ref={refContent}
    >
      <Content components={mdx} />
      {/* <ScrollUp /> */}
    </Container>
  );
};

export default AutobrightnessHelp;
