/*
 * @license
 * Copyright (c) 2022. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nibus" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */
import { Button } from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
// import withStyles from '@mui/styles/withStyles';
import CheckIcon from '@mui/icons-material/Check';
import LocationOnIconMui from '@mui/icons-material/LocationOn';
import React from 'react';

// const withRoundBorderStyles = withStyles(theme => ({
//   root: {
//     fontSize: '1.5em',
//     marginBottom: '-0.25em',
//     borderRadius: '50%', // theme.shape.borderRadius,
//     borderWidth: 1,
//     borderStyle: 'solid',
//     borderColor: alpha(theme.palette.primary.main, 0.2),
//     padding: 2,
//     color: theme.palette.primary.main, // action.active,
//   },
// }));

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
export const LocationOnIcon = styled(LocationOnIconMui)(({ theme }) => ({
  '&.MuiIcon-root': {
    fontSize: '1.5em',
    marginBottom: '-0.25em',
    borderRadius: '50%', // theme.shape.borderRadius,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: alpha(theme.palette.primary.main, 0.2),
    padding: 2,
    color: theme.palette.primary.main, // action.active,
  },
}));

export const ApplyButton: React.FC = () => (
  <Button color="primary" startIcon={<CheckIcon />} variant="outlined" size="small">
    Применить
  </Button>
);
