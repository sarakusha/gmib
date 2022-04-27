/*
 * @license
 * Copyright (c) 2022. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import { Box, Typography } from '@mui/material';
import { SxProps, Theme } from '@mui/material/styles';
import React, { memo } from 'react';
import path from 'path';

export type Props = {
  filename?: string;
  // className?: string;
  placeholder?: string;
  sx?: SxProps<Theme>;
};

// const useStyles = makeStyles({
//   root: {
//     display: 'flex',
//     // maxWidth: '100%',
//     flexWrap: 'nowrap',
//     '& > *': {
//       whiteSpace: 'nowrap',
//       overflow: 'hidden',
//       textOverflow: 'ellipsis',
//     },
//   },
//   prefix: { flexShrink: 10000 },
//   name: { flexShrink: 0.1 },
//   placeholder: {
//     opacity: 0.5,
//   },
// });

const FilenameEllipsis: React.FC<Props> = ({ filename = '', sx, placeholder }) => {
  const fileIndex = filename.lastIndexOf(path.sep);
  const pathPrefix = fileIndex !== -1 ? filename.substr(0, fileIndex) : '';
  const name = fileIndex !== -1 ? filename.slice(fileIndex) : filename;
  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'nowrap',
        '& > *': {
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
  );
};

export default memo(FilenameEllipsis);
