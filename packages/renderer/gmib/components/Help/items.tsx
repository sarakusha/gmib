import AddCircleOutlinedIcon from '@mui/icons-material/AddCircleOutlined';
import CheckIcon from '@mui/icons-material/Check';
import FeaturedVideoOutlinedIcon from '@mui/icons-material/FeaturedVideoOutlined';
import LocationOnIconMui from '@mui/icons-material/LocationOn';
import SmartDisplayOutlinedIcon from '@mui/icons-material/SmartDisplayOutlined';
import { Button } from '@mui/material';
import { alpha, css, styled } from '@mui/material/styles';
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

const AddOverlappedIcon = styled(AddCircleOutlinedIcon)(() => ({
  position: 'absolute',
  left: '55%',
  top: '50%',
  fontSize: '60%',
  backgroundColor: 'white',
  borderRadius: '50%',
}));

const inline = css`
  position: relative;
  display: inline-block;
  font-size: 32px;
`;

export const PlayerMappingIcon = () => (
  <div css={inline}>
    <FeaturedVideoOutlinedIcon fontSize="inherit" />
    <AddOverlappedIcon />
  </div>
);

export const AddPlayerIcon = () => (
  <div css={inline}>
    <SmartDisplayOutlinedIcon fontSize="inherit" />
    <AddOverlappedIcon />
  </div>
);
