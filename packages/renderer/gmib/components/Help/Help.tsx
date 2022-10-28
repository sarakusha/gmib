import { Container } from '@mui/material';
import React, { useRef } from 'react';

import Content from './Help.mdx';
import mdx from './mdx';

const Help: React.FC = () => {
  const refContent = useRef<HTMLDivElement>(null);
  // const [, setToolbar] = useToolbar();
  // const tab = useSelector(selectCurrentTab);
  // const active = tab === 'help';
  // useEffect(() => {
  //   if (active) {
  //     console.log('HELP');
  //     setToolbar(<Button onClick={() => window.print()}>Print</Button>);
  //     return () => setToolbar(null);
  //   }
  //   return () => {};
  // }, [setToolbar, active]);
  return (
    <Container
      maxWidth="md"
      sx={{
        '& p + ul, & p + ol': {
          marginTop: -2,
          marginBottom: 2,
        },
        '& figure': {
          display: 'inline-block',
        },
        '& figcaption': {
          textAlign: 'center',
        },
        '& p': {
          verticalAlign: 'middle',
        },
        '& svg': {
          display: 'inline-block',
          // fontSize: '16px',
          mb: -0.8,
        },
      }}
      ref={refContent}
    >
      <Content components={mdx} />
      {/* <ScrollUp /> */}
    </Container>
  );
};

export default Help;
