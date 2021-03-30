/*
 * @license
 * Copyright (c) 2021. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */
import { Button } from '@material-ui/core';
import { withStyles, fade } from '@material-ui/core/styles';
import CheckIcon from '@material-ui/icons/Check';
import LocationOnIconMui from '@material-ui/icons/LocationOn';
import React from 'react';

const withRoundBorderStyles = withStyles(theme => ({
  root: {
    fontSize: '1.5em',
    marginBottom: '-0.25em',
    borderRadius: '50%', // theme.shape.borderRadius,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: fade(theme.palette.primary.main, 0.2),
    padding: 2,
    color: theme.palette.primary.main, // action.active,
  },
}));

/*
const withIconStyles = withStyles(theme => ({
  root: {
    fontSize: '1.5em',
    marginBottom: '-0.25em',
    // borderRadius: '50%', // theme.shape.borderRadius,
    // borderWidth: 1,
    // borderStyle: 'solid',
    // borderColor: theme.palette.divider,
    // padding: 2,
    color: theme.palette.action.active,
  },
}));
*/

// eslint-disable-next-line import/prefer-default-export
export const LocationOnIcon = withRoundBorderStyles(LocationOnIconMui);
export const SaveButton: React.FC = () => (
  <Button color="primary" startIcon={<CheckIcon />} variant="contained" size="small">
    Сохранить
  </Button>
);
