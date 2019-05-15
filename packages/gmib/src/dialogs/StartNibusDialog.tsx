/*
 * @license
 * Copyright (c) 2019. Nata-Info
 * @author Andrei Sarakeev <avs@nata-info.ru>
 *
 * This file is part of the "@nata" project.
 * For the full copyright and license information, please view
 * the EULA file that was distributed with this source code.
 */
import { Dialog, DialogContent, DialogContentText, DialogTitle, Paper } from '@material-ui/core';
import React from 'react';
import { withStyles, createStyles, Theme, WithStyles } from '@material-ui/core/styles';
import { hot } from 'react-hot-loader/root';
import compose from 'recompose/compose';

const styles = (theme: Theme) => createStyles({
  command: {
    padding: theme.spacing.unit * 2,
    marginTop: theme.spacing.unit,
  },
  paperRoot: {
    backgroundColor: theme.palette.grey[900],
    fontFamily: 'Courier, Monaco, monospace',
    color: 'white',
  },
});
type Props = { open: boolean };
type InnerProps = Props & WithStyles<typeof styles>;
const StartNibusDialog: React.FC<InnerProps> = ({ classes, open }) => {

  return (
    <Dialog
      open={open}
      aria-labelledby="nibus-start-title"
      aria-describedby="nibus-start-description"
    >
      <DialogTitle id="nibus-start-title">Служба NiBUS не запущена</DialogTitle>
      <DialogContent>
        <DialogContentText id="nibus-start-description">
          Вы можете запустить службу командой:<br />
        </DialogContentText>
        <Paper
          className={classes.command}
          classes={{ root: classes.paperRoot }}
          elevation={1}
        >
          > nibus start
        </Paper>
      </DialogContent>
    </Dialog>
  );
};

export default compose<InnerProps, Props>(
  hot,
  React.memo,
  withStyles(styles),
)(StartNibusDialog);
