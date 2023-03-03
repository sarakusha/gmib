import CloseIcon from '@mui/icons-material/Close';
import type {
  DialogTitleProps as MuiDialogTitleProps} from '@mui/material';
import {
  IconButton,
  DialogTitle as MuiDialogTitle,
  Typography,
} from '@mui/material';
import React from 'react';
// import { Theme } from '@mui/material/styles';
// import { WithStyles } from '@mui/styles';
// import createStyles from '@mui/styles/createStyles';
// import withStyles from '@mui/styles/withStyles';

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
// const styles = (theme: Theme) =>
//   createStyles({
//     root: {
//       margin: 0,
//       padding: theme.spacing(2),
//     },
//     closeButton: {
//       position: 'absolute',
//       right: theme.spacing(1),
//       top: theme.spacing(1),
//       color: theme.palette.grey[500],
//     },
//   });

export type DialogTitleProps = MuiDialogTitleProps & {
  onClose?: () => void;
};

const DialogTitle: React.FC<DialogTitleProps> = ({ children, onClose, ...other }) => (
  <MuiDialogTitle
    /* disableTypography */
    sx={{
      m: 0,
      p: 2,
    }}
    {...other}
  >
    {children}
    {onClose ? (
      <IconButton
        aria-label="close"
        sx={{
          position: 'absolute',
          right: theme => theme.spacing(1),
          top: theme => theme.spacing(1),
          color: 'grey.500',
        }}
        onClick={onClose}
        size="large"
      >
        <CloseIcon />
      </IconButton>
    ) : null}
  </MuiDialogTitle>
);

export default DialogTitle;
