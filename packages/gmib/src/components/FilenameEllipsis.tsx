/*
 * @license
 * Copyright (c) 2022. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */

import { makeStyles } from '@material-ui/core/styles';
import { Typography } from '@material-ui/core';
import classNames from 'classnames';
import React, { memo } from 'react';
import path from 'path';

export type Props = {
  filename?: string;
  className?: string;
  placeholder?: string;
};

const useStyles = makeStyles({
  root: {
    display: 'flex',
    // maxWidth: '100%',
    flexWrap: 'nowrap',
    '& > *': {
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    },
  },
  prefix: { flexShrink: 10000 },
  name: { flexShrink: 0.1 },
  placeholder: {
    opacity: 0.5,
  },
});

const FilenameEllipsis: React.FC<Props> = ({ filename = '', className, placeholder }) => {
  const fileIndex = filename.lastIndexOf(path.sep);
  const pathPrefix = fileIndex !== -1 ? filename.substr(0, fileIndex) : '';
  const name = fileIndex !== -1 ? filename.slice(fileIndex) : filename;
  const classes = useStyles();
  return (
    <div className={classNames(classes.root, className)}>
      {filename.length === 0 && placeholder && (
        <Typography className={classes.placeholder}>{placeholder}</Typography>
      )}
      {pathPrefix.length > 0 && <Typography className={classes.prefix}>{pathPrefix}</Typography>}
      <Typography className={classes.name}>{name}</Typography>
    </div>
  );
};

export default memo(FilenameEllipsis);
