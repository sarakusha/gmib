import Box from '@mui/material/Box';
import React from 'react';

type Props = {
  gap?: number;
  className?: string;
};

const FixedHeadLayout: React.FC<React.PropsWithChildren<Props>> = ({
  gap = 1,
  className,
  children,
}) => {
  const [head, ...tail] = React.Children.toArray(children);
  return (
    <Box
      sx={{ display: 'flex', flexDirection: 'column', height: 1, gap, width: 1 }}
      className={className}
    >
      {React.isValidElement(head) && React.cloneElement(head)}
      <Box sx={{ flex: 1, overflowY: 'auto' }}>
        {tail.map(child => React.isValidElement(child) && React.cloneElement(child))}
      </Box>
    </Box>
  );
};

FixedHeadLayout.displayName = 'FixedHeadLayout';

export default FixedHeadLayout;
