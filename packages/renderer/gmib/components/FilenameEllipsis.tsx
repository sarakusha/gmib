import { Box, Tooltip, Typography } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';
import React, { memo } from 'react';

export type Props = {
  filename?: string;
  placeholder?: string;
  sx?: SxProps<Theme>;
};

const FilenameEllipsis: React.FC<Props> = ({ filename = '', sx, placeholder }) => {
  const fileIndex = Math.max(filename.lastIndexOf('/'), filename.lastIndexOf('\\'));
  const [pathPrefix, name] =
    fileIndex !== -1 ? [filename.substr(0, fileIndex), filename.slice(fileIndex)] : ['', filename];
  return (
    <Tooltip title={filename} disableHoverListener={!filename}>
      <Box
        sx={{
          display: 'flex',
          flexWrap: 'nowrap',
          minWidth: 0,
          '& > *': {
            minWidth: 0,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          },
          ...sx,
        }}
      >
        {filename.length === 0 && placeholder && (
          <Typography sx={{ opacity: 0.5 }}>{placeholder}</Typography>
        )}
        {pathPrefix.length > 0 && <Typography sx={{ flexShrink: 10000 }}>{pathPrefix}</Typography>}
        <Typography sx={{ flexShrink: 0.1 }}>{name}</Typography>
      </Box>
    </Tooltip>
  );
};

export default memo(FilenameEllipsis);
