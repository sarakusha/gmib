import CheckIcon from '@mui/icons-material/Check';
import LocationOnIconMui from '@mui/icons-material/LocationOn';
import { Button } from '@mui/material';
import { alpha, styled } from '@mui/material/styles';
import React from 'react';

export const LocationOnIcon = styled(LocationOnIconMui)(({ theme }) => ({
  '&.MuiSvgIcon-root': {
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
