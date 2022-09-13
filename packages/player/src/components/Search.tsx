import ClearIcon from '@mui/icons-material/Clear';
import SearchIcon from '@mui/icons-material/Search';
import { Box, IconButton } from '@mui/material';
import type { InputBaseProps } from '@mui/material/InputBase';
import InputBase from '@mui/material/InputBase';
import { alpha, styled } from '@mui/material/styles';
import * as React from 'react';

import extendStyled from './extendStyled';

const SearchRoot = extendStyled(Box, { variant: 'white' })(({ theme, variant = 'white' }) => {
  const bgcolor = variant === 'white' ? theme.palette.common.white : theme.palette.primary.main;
  return {
    position: 'relative',
    borderRadius: theme.shape.borderRadius,
    backgroundColor: alpha(bgcolor, 0.15),
    '&:hover': {
      backgroundColor: alpha(bgcolor, 0.25),
    },
    marginLeft: 0,
    width: '100%',
    display: 'inline-flex',
    [theme.breakpoints.up('sm')]: {
      marginLeft: theme.spacing(1),
      width: 'auto',
    },
  };
});

const SearchIconWrapper = styled('div')(({ theme }) => ({
  padding: theme.spacing(0, 2),
  height: '100%',
  position: 'absolute',
  pointerEvents: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}));

const StyledInputBase = extendStyled(InputBase, { fixed: false })(({ theme, fixed }) => ({
  color: 'inherit',
  '& .MuiInputBase-input': {
    padding: theme.spacing(1, 1, 1, 0),
    // vertical padding + font size from searchIcon
    paddingLeft: `calc(1em + ${theme.spacing(4)})`,
    transition: theme.transitions.create('width'),
    width: '100%',
    [theme.breakpoints.up('sm')]: {
      width: fixed ? '20ch' : '12ch',
      '&:focus': {
        width: '20ch',
      },
    },
  },
}));

const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
  window.HTMLInputElement.prototype,
  'value',
)?.set;

type Props = InputBaseProps & {
  variant?: 'white' | 'main';
  fixed?: boolean;
};

const Search: React.FC<Props> = ({ variant, ...props }) => {
  const refInput = React.useRef<HTMLInputElement>(null);
  return (
    <SearchRoot variant={variant}>
      <SearchIconWrapper>
        <SearchIcon color="inherit" />
      </SearchIconWrapper>
      <StyledInputBase
        placeholder="Поиск…"
        inputProps={{ 'aria-label': 'search', ref: refInput }}
        endAdornment={
          <IconButton
            size="small"
            color="inherit"
            // eslint-disable-next-line react/destructuring-assignment
            sx={{ visibility: props.value ? 'inherit' : 'hidden' }}
            onClick={() => {
              const { current } = refInput;
              if (current && nativeInputValueSetter) {
                nativeInputValueSetter.call(current, '');
                current.dispatchEvent(new Event('input', { bubbles: true }));
              }
            }}
          >
            <ClearIcon fontSize="inherit" />
          </IconButton>
        }
        {...props}
      />
    </SearchRoot>
  );
};

export default Search;
